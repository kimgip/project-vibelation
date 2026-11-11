import { apiJson, serverMode } from "./api";
import { blankRequest, basisOf, draftFingerprint, type RequirementConfirmation } from "../domain/types";
import historyFixture from "../mocks/history.json" with { type: "json" };
import { validRegistration } from "../storage/repositories";
import type { Registration } from "../domain/types";

export interface HistoryService {
  list(signal: AbortSignal): Promise<{ items: Registration[]; nextCursor: null }>;
  get(id: string, signal: AbortSignal): Promise<Registration | undefined>;
}
const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException("조회 취소", "AbortError"));
  const abort = () => { clearTimeout(timer); reject(new DOMException("조회 취소", "AbortError")); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 200);
  signal.addEventListener("abort", abort, { once: true });
});
/** Local registrations override fixtures with the same ID. Fixtures are never persisted. */
export function createMockHistoryService(localItems: Registration[]): HistoryService {
  function rows(): Registration[] {
    const fixtures: unknown[] = historyFixture.items;
    if (!fixtures.every(validRegistration)) throw new Error("검토 이력 Mock JSON 형식을 확인해주세요.");
    const merged = new Map(fixtures.map(item => [item.id, item]));
    localItems.forEach(item => merged.set(item.id, item));
    return structuredClone([...merged.values()].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)));
  }
  return {
    async list(signal) { await wait(signal); return {items: rows(), nextCursor: null}; },
    async get(id, signal) { await wait(signal); return rows().find(item => item.id === id); },
  };
}

/** Server mode uses only immutable registered snapshots, never local fixtures/current drafts. */
export function registrationFromServer(row: Record<string, any>): Registration {
  row = {...row, id: row.reportId || row.id};
  if (row.request && validRegistration(row)) return row;
  const c = row.confirmationSnapshot, a = row.analysisSnapshot, p = row.similarCaseAnalysisSnapshot || row.reportSnapshot;
  if (!c?.documentSnapshot || !a?.id || !p?.id || typeof c.documentSnapshot.markdown !== "string") throw new Error("등록 당시 산출물 스냅샷이 없습니다.");
  if ((c.requestId && c.requestId !== row.requestId) || (c.documentSnapshot.inputSnapshot && c.documentSnapshot.inputSnapshot.requestId !== row.requestId) || (a.confirmationId && a.confirmationId !== c.id) || (p.confirmationId && p.confirmationId !== c.id) || p.analysisResultId !== a.id) throw new Error("등록 산출물의 확정·분석 기준이 다릅니다.");
  const r = blankRequest();
  r.id = row.requestId;
  r.title = row.title || c.documentSnapshot.displayTitle || c.documentSnapshot.inputSnapshot?.title || "";
  r.inputRevision = c.inputRevision;
  r.screenType = a.screenType;
  r.legacyVersion = a.legacyVersion;
  r.selectedRequirementDocumentId = c.documentSnapshot.id;
  r.activeConfirmationId = c.id;
  const document = { ...c.documentSnapshot, source: "server" as const, inputSnapshot: c.documentSnapshot.inputSnapshot || { unavailable: true, requestId: r.id, inputRevision: c.inputRevision, title: r.title, text: "", html: "", attachmentIds: [], attachmentNames: [] } };
  r.requirements = [document];
  const confirmation: RequirementConfirmation = { ...c, requestId: r.id, draftFingerprint: draftFingerprint(r), documentSnapshot: document, mockSnapshot: null, mockReviewed: null, agreementSnapshot: { scope: "", acceptanceCriteria: "", exclusions: "", unresolvedItems: "" } };
  r.confirmations = [confirmation]; r.requirements = [document]; r.requirementAppliedAtInputRevision = r.inputRevision;
  r.analysis = { ...a, source: "server", basis: basisOf(r) };
  if (row.similarCaseAnalysisSnapshot) r.similarCaseAnalysis = {id:p.id,analysisId:p.analysisResultId,basis:basisOf(r),status:p.similarCaseMap?.status || 'no_matches',source:'server',cases:(p.similarCaseMap?.cases || []).map((v:any)=>({historyId:v.historyId,title:v.title,reason:v.summary,difference:'',business:v.business?.score,resource:v.resource?.score,registeredAt:v.registeredAt}))};
  else r.report = { ...p, analysisId: p.analysisResultId, basis: basisOf(r) };
  r.scopeReviewed = row.reviewChecks?.scopeReviewed === true;
  r.estimateReviewed = row.reviewChecks?.estimateReviewed === true;
  return { id: row.id, reportId: row.reportId || row.id, key: row.id, registeredAt: row.registeredAt, request: r,
    reviewSummarySnapshot: typeof row.reviewSummarySnapshot === "string" ? row.reviewSummarySnapshot : undefined,
    similarCasesSnapshot: Array.isArray(row.similarCasesSnapshot) ? row.similarCasesSnapshot : r.similarCaseAnalysis?.cases };
}
export function createHistoryService(localItems: Registration[]): HistoryService {
  if (!serverMode) return createMockHistoryService(localItems);
  const get = async (id: string, signal: AbortSignal) => registrationFromServer(await apiJson(`/review-registrations/${encodeURIComponent(id)}`, signal));
  return {
    get,
    async list(signal) {
      const items: Registration[] = [], seen = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await apiJson(`/review-registrations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, signal);
        if (!Array.isArray(page.items)) throw new Error("검토 이력 목록 형식을 확인해주세요.");
        for (const row of page.items) items.push(row.confirmationSnapshot ? registrationFromServer(row) : await get(row.id, signal));
        cursor = page.nextCursor || undefined;
        if (cursor && seen.has(cursor)) throw new Error("이력 페이지가 반복됩니다.");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return { items, nextCursor: null };
    },
  };
}
