import { backendApi, apiBase, operationKey, ApiError, type Wire } from "./backendApi";
import { blankRequest, snapshotOf, draftFingerprint, basisOf, canRegister, type WorkRequest, type InputSnapshot, type RequirementDocument, type RequirementConfirmation, type Registration } from "../domain/types";
import { waitForPoll } from "./generationTransport";
const storageKey = (id: string) => `soetmul.server-request:${apiBase}:${id}`;
export function serverState(id: string): Wire {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw)
        throw new Error("서버 요청을 먼저 불러와주세요. 로컬 요청은 서버 모드에서 자동 전송하지 않습니다.");
    return JSON.parse(raw);
}
export function rememberServerRequest(row: Wire, fingerprint?: string) {
    localStorage.setItem(storageKey(row.id), JSON.stringify({ row, fingerprint }));
    return row;
}
export const inputPayload = (input: InputSnapshot, dueDate?: string) => ({ title: input.title, text: input.text, html: input.html, desiredDueDate: dueDate || null, attachmentIds: input.attachmentIds, ...(input.screenType ? {screenType:input.screenType} : {}) });
const queues = new Map<string, Promise<unknown>>();
export async function withServerLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const prior = queues.get(id) || Promise.resolve();
    const next = prior.catch(() => { }).then(operation);
    queues.set(id, next);
    try {
        return await next;
    }
    finally {
        if (queues.get(id) === next)
            queues.delete(id);
    }
}
export async function syncInput(input: InputSnapshot, signal: AbortSignal, dueDate?: string, api = backendApi!) {
    return withServerLock(input.requestId, async () => {
        signal.throwIfAborted();
        const state = serverState(input.requestId), payload = inputPayload(input, dueDate ?? state.row.desiredDueDate);
        const fingerprint = JSON.stringify(payload);
        if (state.fingerprint === fingerprint)
            return state.row;
        const row = await api.patchRequest(input.requestId, { expectedRequestRevision: state.row.requestRevision, input: payload }, signal);
        rememberServerRequest(row, fingerprint);
        return row;
    });
}
export async function syncRequest(r: WorkRequest, signal: AbortSignal) {
    localStorage.setItem(`soetmul.screen-type:${apiBase}:${r.id}`,r.screenType || "");
    localStorage.setItem(`soetmul.code-version:${apiBase}:${r.id}`, r.legacyVersion);
    return syncInput(snapshotOf(r), signal, r.dueDate);
}
export function documentFromWire(row: Wire, requestId: string, snapshot?: InputSnapshot): RequirementDocument {
    if (typeof row.id !== "string" || typeof row.markdown !== "string")
        throw new Error("요구사항 문서 응답 형식이 올바르지 않습니다.");
    const key = `soetmul.document-input:${apiBase}:${row.id}`;
    const stored = localStorage.getItem(key);
    const input = snapshot || row.inputSnapshot || (stored ? JSON.parse(stored) : {
        unavailable: true, requestId, inputRevision: row.inputRevision, title: row.title || "", text: "", html: "", attachmentIds: [], attachmentNames: []
    });
    localStorage.setItem(key, JSON.stringify(input));
    return { ...row, inputSnapshot: input, inputRevision: input.inputRevision, source: row.source || "server" } as RequirementDocument;
}
export function confirmationFromWire(row: Wire, r: WorkRequest): RequirementConfirmation {
    const doc = documentFromWire(row.documentSnapshot, r.id, r.requirements.find(d => d.id === row.requirementDocumentId)?.inputSnapshot);
    return { ...row, requestId: r.id, inputRevision: r.inputRevision, draftFingerprint: draftFingerprint({ ...r, selectedRequirementDocumentId: doc.id }), documentSnapshot: doc,
        mockSnapshot: null, mockReviewed: null, agreementSnapshot: { scope: "", acceptanceCriteria: "", exclusions: "", unresolvedItems: "" } } as RequirementConfirmation;
}
export async function createServerRequest(signal: AbortSignal): Promise<WorkRequest> {
    const refs = await backendApi!.listLegacyReferences(signal);
    if (!refs.items?.length)
        throw new Error("서버에 사용 가능한 레거시 코드 기준이 없습니다.");
    const op = operationKey("create-request");
    const row = await backendApi!.createRequest({ title: "", legacyReferenceId: refs.items[0].id }, op.key, signal);
    op.done();
    rememberServerRequest(row, JSON.stringify({ title: row.title, text: row.text, html: row.html, desiredDueDate: row.desiredDueDate, attachmentIds: row.attachmentIds, ...(row.screenType ? {screenType:row.screenType} : {}) }));
    return requestFromWire(row);
}
export function requestFromWire(row: Wire): WorkRequest {
    const screenType=row.screenType || localStorage.getItem(`soetmul.screen-type:${apiBase}:${row.id}`) || undefined;
    return { ...blankRequest(), screenType, createdAt:row.createdAt || row.updatedAt, id: row.id, title: row.title, text: row.text || "", html: row.html || "", dueDate: row.desiredDueDate || "", inputRevision: row.inputRevision,
        revision: row.requestRevision, legacyVersion: localStorage.getItem(`soetmul.code-version:${apiBase}:${row.id}`) || row.legacyVersion, updatedAt: row.updatedAt,
        selectedRequirementDocumentId: row.workingRequirementDocumentId || undefined, activeConfirmationId: row.activeConfirmationId || undefined };
}
export async function restoreRequest(id: string, signal: AbortSignal): Promise<WorkRequest> {
    const row = await backendApi!.getRequest(id, signal);
    rememberServerRequest(row, JSON.stringify({ title: row.title, text: row.text, html: row.html, desiredDueDate: row.desiredDueDate, attachmentIds: row.attachmentIds, ...(row.screenType ? {screenType:row.screenType} : {}) }));
    let r = requestFromWire(row);
    const [docs, confirmations, jobs, attachments] = await Promise.all([
        backendApi!.requirementDocuments(id, undefined, signal), backendApi!.confirmations(id, signal), backendApi!.requirementJobs(id, signal),
        Promise.all((row.attachmentIds || []).map((a: string) => backendApi!.attachmentStatus(id, a, signal)))
    ]);
    r.attachments = attachments.map(a => ({ id: a.id, serverFileId: a.id, name: a.name, size: a.sizeBytes, type: a.contentType, uploadStatus: a.usableForGeneration ? "uploaded" : "failed", error: a.usableForGeneration ? undefined : "첨부 자료 처리가 완료되지 않았습니다." }));
    const documentRows: Wire[] = [...docs.items];
    const cursors = new Set<string>();
    let cursor = docs.nextCursor;
    while (cursor) {
        if (cursors.has(cursor))
            throw new Error("문서 페이지가 반복되었습니다.");
        cursors.add(cursor);
        const page = await backendApi!.requirementDocuments(id, cursor, signal);
        documentRows.push(...page.items);
        cursor = page.nextCursor;
    }
    r.requirements = await Promise.all(documentRows.map(async (d: Wire) => documentFromWire(d.markdown === undefined ? await backendApi!.requirementDocument(id, d.id, signal) : d, id)));
    if (r.selectedRequirementDocumentId) {
        try {
            const artifact = await backendApi!.latestMock(id, signal);
            if (artifact.requirementDocumentId === r.selectedRequirementDocumentId && artifact.legacyVersion === r.legacyVersion && typeof artifact.html === "string" && artifact.html.length <= 2000000) {
                r.mocks = [{ id: artifact.id, requirementDocumentId: artifact.requirementDocumentId, legacyVersion: artifact.legacyVersion, createdAt: artifact.createdAt, html: artifact.html, generationNumber: artifact.generationNumber || 1, source: "server", renderer: "server-html", behaviors: [], assumptions: [], unconnectedFeatures: [] } as WorkRequest["mocks"][number]];
            }
        }
        catch (e) {
            if (!(e instanceof ApiError && e.status === 404))
                throw e;
        }
    }
    r.confirmations = confirmations.items.map((c: Wire) => {
        const result = confirmationFromWire(c, r);
        result.inputRevision = c.inputRevision;
        result.draftFingerprint = JSON.stringify([c.inputRevision, c.requirementDocumentId]);
        return result;
    });
    if (r.selectedRequirementDocumentId && !row.hasUnconfirmedChanges)
        r.requirementAppliedAtInputRevision = r.inputRevision;
    const applied = localStorage.getItem(`soetmul.server-selection:${apiBase}:${id}`);
    if (applied) {
        const selected = JSON.parse(applied);
        if (selected.id === r.selectedRequirementDocumentId && selected.inputRevision === row.inputRevision)
            r.requirementAppliedAtInputRevision = r.inputRevision;
    }
    r.generations = jobs.items.map((j: Wire) => ({ ...j, idempotencyKey: "", inputSnapshot: r.requirements.find(d => d.generationId === j.id)?.inputSnapshot || snapshotOf(r), document: r.requirements.find(d => d.generationId === j.id), error: typeof j.error === "string" ? j.error : j.error?.message }));
    if (row.latestAnalysisResultId) {
        const a = await backendApi!.analysisResult(row.latestAnalysisResultId, signal);
        r.analysis = { ...a, basis: { ...basisOf(r), confirmationId: a.confirmationId, requirementDocumentId: a.requirementDocumentId, legacyVersion: a.legacyVersion }, source: "server" } as WorkRequest["analysis"];
    }
    if (row.latestReportId) {
        const p = await backendApi!.report(row.latestReportId, signal);
        r.report = { ...p, basis: { ...basisOf(r), confirmationId: p.confirmationId }, analysisId: p.analysisResultId } as WorkRequest["report"];
    }
    return r;
}
export async function serverRequests(signal: AbortSignal) {
    const rows: WorkRequest[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
        const page = await backendApi!.listRequests({ cursor }, signal);
        for (const row of page.items)
            rows.push(await restoreRequest(row.id, signal));
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
            throw new Error("요청 페이지가 반복되었습니다.");
        if (cursor)
            seen.add(cursor);
    } while (cursor);
    return rows;
}
export async function confirmServerRequest(r: WorkRequest, signal: AbortSignal): Promise<WorkRequest> {
    await syncRequest(r, signal);
    return withServerLock(r.id, async () => {
        const row = serverState(r.id).row;
        const body = { requirementDocumentId: r.selectedRequirementDocumentId, expectedInputRevision: row.inputRevision, expectedRequestRevision: row.requestRevision };
        const op = operationKey(`confirm:${r.id}:${JSON.stringify(body)}`);
        const wire = await backendApi!.confirm(r.id, body, op.key, signal);
        // The returned revision avoids silently accepting another editor's changes.
        rememberServerRequest({ ...row, requestRevision: wire.requestRevision ?? row.requestRevision + 1, activeConfirmationId: wire.id }, serverState(r.id).fingerprint);
        op.done();
        const c = confirmationFromWire(wire, r);
        return { ...r, confirmations: [c, ...r.confirmations.filter(x => x.id !== c.id)], activeConfirmationId: c.id, scopeReviewed: false, estimateReviewed: false };
    });
}
export class JobFailure extends Error {
}
export async function pollJob(get: () => Promise<Wire>, signal: AbortSignal): Promise<Wire> {
    for (let n = 0; n < 600; n++) {
        const job = await get();
        if (job.status === "failed")
            throw new JobFailure(typeof job.error === "string" ? job.error : job.error?.message || "서버 작업에 실패했습니다.");
        if (job.status === "succeeded")
            return job;
        if (!["queued", "running"].includes(job.status))
            throw new Error("작업 상태 응답이 올바르지 않습니다.");
        await waitForPoll(signal, Math.min(30000, Math.max(200, Number(job.pollAfterMs) || 1000)));
    }
    throw new Error("서버 작업이 진행 중입니다. 다시 조회해주세요.");
}
export async function serverReport(r: WorkRequest, signal: AbortSignal) {
    const body = { requestId: r.id, confirmationId: r.activeConfirmationId, analysisResultId: r.analysis!.id };
    const op = operationKey(`report:${JSON.stringify(body)}`);
    const ticket = `soetmul.report-job:${apiBase}:${JSON.stringify(body)}`;
    let id = localStorage.getItem(ticket);
    if (!id) {
        const started = await backendApi!.startReport(body, op.key, signal);
        id = started.id;
        localStorage.setItem(ticket, id!);
    }
    let job: Wire;
    try {
        job = await pollJob(() => backendApi!.reportJob(id!, signal), signal);
    }
    catch (e) {
        if (e instanceof JobFailure) {
            op.done();
            localStorage.removeItem(ticket);
        }
        throw e;
    }
    const result = job.result?.markdown !== undefined ? job.result : await backendApi!.report(job.reportId || job.result?.id, signal);
    if (result.confirmationId !== r.activeConfirmationId || result.analysisResultId !== r.analysis!.id || typeof result.markdown !== "string")
        throw new Error("리포트 생성 기준이 일치하지 않습니다.");
    op.done();
    localStorage.removeItem(ticket);
    return { id: result.id, analysisId: result.analysisResultId, markdown: result.markdown, basis: basisOf(r) };
}
export function registrationFromWire(row: Wire): Registration {
    const c = row.confirmationSnapshot, a = row.analysisSnapshot, p = row.reportSnapshot;
    if (!c || !a || !p)
        throw new Error("등록 스냅샷 응답이 누락되었습니다.");
    const r = { ...blankRequest(), id: row.requestId, title: row.title, inputRevision: c.inputRevision, legacyVersion: a.legacyVersion, selectedRequirementDocumentId: c.requirementDocumentId, activeConfirmationId: c.id };
    const confirmation = confirmationFromWire(c, r);
    r.confirmations = [confirmation];
    r.requirements = [confirmation.documentSnapshot];
    r.requirementAppliedAtInputRevision = r.inputRevision;
    r.analysis = { ...a, basis: basisOf(r), source: "server" };
    r.report = { id: p.id, analysisId: p.analysisResultId, basis: basisOf(r), markdown: p.markdown };
    r.scopeReviewed = true;
    r.estimateReviewed = true;
    return { id: row.id, key: row.id, registeredAt: row.registeredAt, request: r };
}
export async function registerServerRequest(r: WorkRequest, signal: AbortSignal) {
    if (!canRegister(r))
        throw new Error("현재 기준의 분석·리포트와 최종 검토 확인이 필요합니다.");
    const body = { requestId: r.id, confirmationId: r.activeConfirmationId, analysisResultId: r.analysis!.id, reportId: r.report!.id, reviewChecks: { scopeReviewed: r.scopeReviewed, estimateReviewed: r.estimateReviewed } };
    const op = operationKey(`register:${JSON.stringify(body)}`);
    const created = await backendApi!.register(body, op.key, signal);
    const result = registrationFromWire(created.confirmationSnapshot ? created : await backendApi!.registration(created.id, signal));
    op.done();
    return result;
}
