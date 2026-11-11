import { apiBase, ApiError, jsonPost, operationKey } from "./api";
import { backendApi, type Wire } from "./backendApi";
import { blankRequest, snapshotOf, draftFingerprint, basisOf, sameBasis, confirmRequirement, canRegister,
  type WorkRequest, type InputSnapshot, type RequirementDocument, type RequirementConfirmation, type Registration } from "../domain/types";
import { validRequest } from "../storage/repositories";
import { registrationFromServer } from "./history";
import { similarCaseAnalysisFromServer } from "./similarCases";
import { analysisFromServer } from "./contract";
const scope = (base: string) => base.replace(/\/+$/, "").replace(/\/api$/, "");
const stateKey = (id: string, base = apiBase) => `soetmul.server-request:${scope(base)}:${id}`;
export const serverDraftKey = `soetmul.server-drafts:${apiBase}`;
export const dirtyKey = (id: string) => `soetmul.server-dirty:${apiBase}:${id}`;
export function serverDrafts(): WorkRequest[] {
  const rows = JSON.parse(localStorage.getItem(serverDraftKey) || "[]");
  if (!Array.isArray(rows) || !rows.every(validRequest)) throw new Error("서버 작업 캐시가 손상됐습니다. 복구용 자료를 내보낸 뒤 다시 불러와주세요.");
  return rows;
}
export function saveServerDraft(r: WorkRequest) {
  localStorage.setItem(serverDraftKey, JSON.stringify([r, ...serverDrafts().filter(x => x.id !== r.id)]));
}
export function serverState(id: string, base = apiBase): { row: Wire; fingerprint?: string } | undefined {
  const value = localStorage.getItem(stateKey(id, base));
  return value ? JSON.parse(value) : undefined;
}
export function rememberServerRequest(row: Wire, fingerprint?: string, base = apiBase) {
  if (typeof row.id !== "string" || !Number.isInteger(row.requestRevision)) throw new Error("서버 요청 ID·revision 응답을 확인해주세요.");
  localStorage.setItem(stateKey(row.id, base), JSON.stringify({ row, fingerprint }));
  return row;
}
export const inputPayload = (input: InputSnapshot, dueDate = input.desiredDueDate) => ({
  title: input.title, text: input.text, html: input.html, desiredDueDate: dueDate || null,
  attachmentIds: input.attachmentIds, screenType: input.screenType,
});
const fingerprintOf = (input: InputSnapshot, dueDate?: string) => JSON.stringify({ legacyReferenceId: input.legacyReferenceId, input: inputPayload(input, dueDate) });
const queues = new Map<string, Promise<unknown>>();
export async function withServerLock<T>(id: string, operation: () => Promise<T>, base = apiBase): Promise<T> {
  const key = stateKey(id, base), previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation); queues.set(key, next);
  try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
}
export async function mutateRequest<T>(id: string, signal: AbortSignal, operation: (row: Wire) => Promise<T>, api = backendApi): Promise<T> {
  return withServerLock(id, async () => {
    signal.throwIfAborted();
    const cached = serverState(id, api.base);
    const row = cached?.row || await api.getRequest(id, signal);
    const result = await operation(row);
    if (result && typeof result === "object" && "requestRevision" in result) {
      const updated = { ...row, ...result, id };
      rememberServerRequest(updated, serverState(id, api.base)?.fingerprint ?? cached?.fingerprint, api.base);
    }
    return result;
  }, api.base);
}
export async function syncInput(input: InputSnapshot, signal: AbortSignal, dueDate?: string, api = backendApi) {
  return mutateRequest<Wire>(input.requestId, signal, async row => {
    const fingerprint = fingerprintOf(input, dueDate), cached = serverState(input.requestId, api.base);
    if (cached?.fingerprint === fingerprint) return row;
    const saved = await api.patchRequest(input.requestId, {
      expectedRequestRevision: row.requestRevision, legacyReferenceId: input.legacyReferenceId, input: inputPayload(input, dueDate),
    }, signal);
    const updated: Wire = { ...row, ...saved, id: input.requestId };
    rememberServerRequest(updated, fingerprint, api.base);
    return updated;
  }, api);
}
export const syncRequest = (r: WorkRequest, signal: AbortSignal) => syncInput(snapshotOf(r), signal, r.dueDate);
export function documentFromWire(row: Wire, requestId: string): RequirementDocument {
  if (typeof row.id !== "string" || typeof row.markdown !== "string") throw new Error("요구사항 문서 응답 형식이 올바르지 않습니다.");
  if (row.inputSnapshot && row.inputSnapshot.requestId !== requestId) throw new Error("다른 요청의 문서가 포함되어 있습니다.");
  const inputSnapshot = row.inputSnapshot || { unavailable: true, requestId, inputRevision: row.inputRevision,
    title: row.displayTitle || "", text: "", html: "", attachmentIds: [], attachmentNames: [] };
  return { ...row, inputSnapshot, source: "server" } as RequirementDocument;
}
function confirmationFromWire(row: Wire, r: WorkRequest): RequirementConfirmation {
  if ((row.requestId && row.requestId !== r.id) || typeof row.id !== "string") throw new Error("확정 응답의 요청 기준이 다릅니다.");
  const documentSnapshot = documentFromWire(row.documentSnapshot, r.id);
  if (row.requirementDocumentId && row.requirementDocumentId !== documentSnapshot.id) throw new Error("확정 문서 기준이 다릅니다.");
  return { ...row, requestId: r.id, documentSnapshot,
    draftFingerprint: draftFingerprint({ ...r, inputRevision: row.inputRevision, selectedRequirementDocumentId: documentSnapshot.id, requirements: [documentSnapshot] }),
    mockSnapshot: null, mockReviewed: null, agreementSnapshot: { scope: "", acceptanceCriteria: "", exclusions: "", unresolvedItems: "" } } as RequirementConfirmation;
}
export function requestFromWire(row: Wire): WorkRequest {
  if (typeof row.id !== "string" || !Number.isInteger(row.requestRevision) || !Number.isInteger(row.inputRevision)) throw new Error("서버 요청 응답 형식을 확인해주세요.");
  return { ...blankRequest(), id: row.id, title: row.title || "", text: row.text || "", html: row.html || "",
    dueDate: row.desiredDueDate || "", screenType: row.screenType, inputRevision: row.inputRevision, revision: row.requestRevision,
    legacyVersion: row.legacyReferenceId || row.legacyVersion || "", createdAt: row.createdAt || row.updatedAt, updatedAt: row.updatedAt,
    selectedRequirementDocumentId: row.workingRequirementDocumentId || undefined, activeConfirmationId: row.activeConfirmationId || undefined };
}
export async function allPages(path: string, signal: AbortSignal, api = backendApi): Promise<Wire[]> {
  const items: Wire[] = [], seen = new Set<string>(); let cursor: string | undefined;
  do {
    const page = await api.get(path + (cursor ? `${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : ""), signal);
    if (!Array.isArray(page.items)) throw new Error("서버 목록 응답 형식을 확인해주세요.");
    items.push(...page.items); cursor = page.nextCursor || undefined;
    if (cursor && seen.has(cursor)) throw new Error("서버 목록 페이지가 반복되었습니다.");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}
export async function createServerRequest(signal: AbortSignal, api = backendApi): Promise<WorkRequest> {
  const references = await api.listLegacyReferences(signal);
  if (!references.items?.length || typeof references.items[0].id !== "string") throw new Error("서버에 사용 가능한 시스템 코드 기준이 없습니다. 설정에서 등록해주세요.");
  const op = operationKey("create-request", api.base);
  const row = await api.createRequest({ title: "", legacyReferenceId: references.items[0].id }, op.key, signal);
  const r = requestFromWire(row);
  rememberServerRequest(row, fingerprintOf(snapshotOf(r), r.dueDate), api.base); op.done(); return r;
}
export async function restoreRequest(id: string, signal: AbortSignal, api = backendApi): Promise<WorkRequest> {
  const row = await api.getRequest(id, signal);
  if (row.id !== id) throw new Error("서버에서 다른 요청을 반환했습니다.");
  const r = requestFromWire(row), route = `/requests/${encodeURIComponent(id)}`;
  const [docs, confirmations, jobs, attachments] = await Promise.all([
    allPages(route + "/requirement-documents", signal, api), allPages(route + "/requirement-confirmations", signal, api),
    allPages(route + "/requirement-generations", signal, api),
    Promise.all((row.attachmentIds || []).map((f: string) => api.attachmentStatus(id, f, signal))),
  ]);
  r.attachments = attachments.map(a => {
    if (a.requestId && a.requestId !== id) throw new Error("첨부자료의 요청 기준이 다릅니다.");
    return { id: a.id, serverFileId: a.id, name: a.name, size: a.sizeBytes, type: a.contentType,
      uploadStatus: a.usableForGeneration ? "uploaded" : "failed", error: a.usableForGeneration ? undefined : "첨부자료 처리가 완료되지 않았습니다." };
  });
  r.requirements = await Promise.all(docs.map(async d => documentFromWire(typeof d.markdown === "string" ? d : await api.requirementDocument(id, d.id, signal), id)));
  r.requirements.sort((a, b) => b.generationNumber - a.generationNumber);
  r.confirmations = await Promise.all(confirmations.map(async c => confirmationFromWire(c.documentSnapshot ? c : await api.confirmation(id, c.id, signal), r)));
  if (r.selectedRequirementDocumentId && row.hasUnconfirmedChanges === false) r.requirementAppliedAtInputRevision = r.inputRevision;
  const selection = JSON.parse(localStorage.getItem(`soetmul.server-selection:${scope(api.base)}:${id}`) || "null");
  if (selection && selection.id === r.selectedRequirementDocumentId && selection.inputRevision === row.inputRevision) r.requirementAppliedAtInputRevision = r.inputRevision;
  r.generations = jobs.map(j => {
    const document = r.requirements.find(d => d.generationId === j.id);
    return { ...j, idempotencyKey: j.idempotencyKey || "", inputSnapshot: document?.inputSnapshot || j.inputSnapshot || {
      unavailable: true, requestId: id, inputRevision: j.inputRevision, title: "", text: "", html: "", attachmentIds: [], attachmentNames: [] },
      document, error: typeof j.error === "string" ? j.error : j.error?.message } as WorkRequest["generations"][number];
  });
  for (const job of r.generations) localStorage.setItem(`soetmul.md-job:${scope(api.base)}:${id}:${job.id}`, JSON.stringify(job));
  if (r.selectedRequirementDocumentId) {
    try {
      const m = await api.latestMock(id, signal);
      if (m.requestId && m.requestId !== id) throw new Error("생성 화면의 요청 기준이 다릅니다.");
      if (m.requirementDocumentId === r.selectedRequirementDocumentId && m.legacyVersion === r.legacyVersion && m.screenType === r.screenType && typeof m.html === "string" && m.html.length <= 2000000)
        r.mocks = [{ ...m, id: m.id, requirementDocumentId: m.requirementDocumentId, legacyVersion: m.legacyVersion, createdAt: m.createdAt, generationNumber: m.generationNumber || 1, source: "server", renderer: "server-html", behaviors: [], assumptions: [], unconnectedFeatures: [] }];
    } catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  }
  if (row.latestAnalysisResultId) {
    const a = await api.analysisResult(row.latestAnalysisResultId, signal);
    if ((a.requestId && a.requestId !== id) || a.id !== row.latestAnalysisResultId) throw new Error("분석 결과의 요청 기준이 다릅니다.");
    const confirmed = r.confirmations.find(c => c.id === a.confirmationId);
    if (!confirmed || confirmed.documentSnapshot.id !== a.requirementDocumentId) throw new Error("분석 결과의 확정·문서 기준이 다릅니다.");
    r.analysis = await analysisFromServer(a, { basis: { ...basisOf(r), confirmationId: a.confirmationId,
      requirementDocumentId: a.requirementDocumentId, legacyVersion: a.legacyVersion, screenType: a.screenType } });
  }
  if (row.latestSimilarCaseAnalysisResultId && r.analysis && sameBasis(basisOf(r), r.analysis.basis)) {
    r.similarCaseAnalysis = await similarCaseAnalysisFromServer(await api.similarCaseResult(row.latestSimilarCaseAnalysisResultId, signal), r);
  }
  if (!localStorage.getItem(dirtyKey(id)) || !serverState(id, api.base)) rememberServerRequest(row, fingerprintOf(snapshotOf(r), r.dueDate), api.base);
  return r;
}
export async function serverRequests(signal: AbortSignal, api = backendApi): Promise<WorkRequest[]> {
  const items = await allPages("/requests", signal, api);
  return Promise.all(items.map(row => restoreRequest(row.id, signal, api)));
}
export async function confirmServerRequest(r: WorkRequest, signal: AbortSignal, api = backendApi): Promise<WorkRequest> {
  await syncInput(snapshotOf(r), signal, r.dueDate, api);
  return mutateRequest(r.id, signal, async row => {
    const confirmed = confirmRequirement(r), c = confirmed.confirmations.find(x => x.id === confirmed.activeConfirmationId)!;
    const op = operationKey(`confirm:${r.id}:${c.draftFingerprint}`, api.base);
    const wire = await api.request(`/requests/${encodeURIComponent(r.id)}/requirement-confirmations`, signal,
      jsonPost({ requirementDocumentId: c.documentSnapshot.id, expectedInputRevision: row.inputRevision, expectedRequestRevision: row.requestRevision }, op.key));
    if ((wire.requestId && wire.requestId !== r.id) || typeof wire.id !== "string" || !wire.documentSnapshot || wire.documentSnapshot.id !== c.documentSnapshot.id || wire.documentSnapshot.markdown !== c.documentSnapshot.markdown)
      throw new Error("서버 확정의 요구사항 기준이 다릅니다.");
    rememberServerRequest({ ...row, requestRevision: wire.requestRevision ?? row.requestRevision + 1, activeConfirmationId: wire.id }, serverState(r.id, api.base)?.fingerprint, api.base);
    op.done();
    return { ...confirmed, activeConfirmationId: wire.id, confirmations: [{ ...c, ...wire, inputRevision: r.inputRevision,
      documentSnapshot: { ...c.documentSnapshot, ...wire.documentSnapshot }, draftFingerprint: c.draftFingerprint }, ...r.confirmations] };
  }, api);
}
export async function registerServerRequest(r: WorkRequest, signal: AbortSignal, api = backendApi): Promise<Registration> {
  if (!canRegister(r)) throw new Error("현재 확정과 일치하는 영향도·유사사례 분석이 필요합니다.");
  const body = { requestId: r.id, confirmationId: r.activeConfirmationId, analysisResultId: r.analysis!.id, similarCaseAnalysisId: r.similarCaseAnalysis!.id };
  const op = operationKey(`register:${JSON.stringify(body)}`, api.base);
  const created = await api.register(body, op.key, signal);
  if (typeof created.reportId !== "string" || (created.id && created.id !== created.reportId)) throw new Error("등록 결과 reportId가 올바르지 않습니다.");
  const detail = created.confirmationSnapshot ? created : await api.registration(created.reportId, signal);
  const result = registrationFromServer(detail);
  if (result.id !== created.reportId || result.request.id !== r.id || result.request.activeConfirmationId !== r.activeConfirmationId || result.request.analysis?.id !== r.analysis?.id || result.request.similarCaseAnalysis?.id !== r.similarCaseAnalysis?.id)
    throw new Error("등록 결과의 요청·확정·분석 기준이 다릅니다.");
  op.done(); return result;
}
