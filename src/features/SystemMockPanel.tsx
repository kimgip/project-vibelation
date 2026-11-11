import { useEffect, useRef } from "react";
import { appliedDocument, hasAppliedRequirement, mergeMockJob, type WorkRequest, type MockJob } from "../domain/types";
import { systemMockService } from "../services/systemMocks";
import { Empty } from "../components/shared";
import { communicationHtml } from "../utils/communicationHtml";
import { downloadHtml } from "../utils/downloads";
import { StaticHtmlFrame } from "../components/StaticHtmlFrame";
export function useSystemMock(r: WorkRequest, update: (fn: (r: WorkRequest) => WorkRequest) => void, saved: boolean) {
  const lock = useRef(false);
  const doc = appliedDocument(r);
  const matches = (m: { requirementDocumentId: string; legacyVersion: string; screenType?: string }) => m.requirementDocumentId === doc?.id && m.legacyVersion === r.legacyVersion && m.screenType === r.screenType;
  const displayed = r.mocks.find(matches);
  const job = r.mockJobs.find(j => matches(j) && ["queued", "running", "failed"].includes(j.status));
  useEffect(() => { lock.current = false; }, [job?.id, displayed?.id, doc?.id, r.legacyVersion, r.screenType]);
  useEffect(() => {
    if (!job || job.error || job.status === "failed" || !saved) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const d = r.requirements.find(d => d.id === job.requirementDocumentId);
        if (!d) throw new Error("기준 문서를 찾을 수 없습니다.");
        const next = job.id.startsWith("pending:") ? await systemMockService.start(d, job.legacyVersion, job.idempotencyKey, job.screenType) : await systemMockService.get(job.id);
        if (!cancelled) update(latest => mergeMockJob({ ...latest, mockJobs: latest.mockJobs.filter(j => j.id !== job.id) }, next));
      } catch (e) {
        if (!cancelled) update(latest => mergeMockJob(latest, { ...job, error: e instanceof Error ? e.message : "예상 화면 생성 실패" }));
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [job, saved, r.id]);
  function start() {
    if (!doc || !hasAppliedRequirement(r) || !saved || !r.screenType || displayed || lock.current) return;
    lock.current = true;
    if (job && job.status !== "failed") {
      update(latest => mergeMockJob(latest, { ...job, error: undefined }));
      lock.current = false;
      return;
    }
    const key = crypto.randomUUID();
    update(latest => mergeMockJob(latest, { id: `pending:${key}`, requestId: r.id, idempotencyKey: key, requirementDocumentId: doc.id, legacyVersion: r.legacyVersion, screenType: r.screenType, generationNumber: 1, status: "queued", createdAt: new Date().toISOString() }));
  }
  return { displayed, job, start };
}
export function SystemMockPanel({ r }: { r: WorkRequest }) {
  const doc = appliedDocument(r);
  const displayed = r.mocks.find(m => m.requirementDocumentId === doc?.id && m.legacyVersion === r.legacyVersion && m.screenType === r.screenType);
  const html = displayed?.source === "server" ? displayed.html || "" : communicationHtml();
  return <section className="panel system-mock-panel" id="system-mock">
    <div className="panel-heading"><span>시스템 적용 예상 화면</span></div>
    <div className="panel-content">
      {displayed ? <>
        <div className="mock-toolbar"><button onClick={() => downloadHtml(r.title, html)}>HTML 코드 다운로드</button></div>
        {displayed.source === "server" ? <StaticHtmlFrame html={html} /> : <iframe className="communication-preview" title="시스템 적용 예상 화면 미리보기" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={html} />}
      </> : <Empty>성분 보기에서 예상 화면을 준비해주세요.</Empty>}
    </div>
  </section>;
}
