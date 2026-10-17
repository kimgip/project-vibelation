import { useEffect } from "react";
import {
  appliedDocument,
  mergeMockJob,
  type WorkRequest,
  type MockJob,
} from "../domain/types";
import { systemMockService } from "../services/systemMocks";
import { Tag, Empty } from "../components/shared";
import { communicationHtml } from "../utils/communicationHtml";
import { downloadHtml } from "../utils/downloads";
export function SystemMockPanel({
  r,
  update,
  saved,
}: {
  r: WorkRequest;
  update: (fn: (r: WorkRequest) => WorkRequest) => void;
  saved: boolean;
}) {
  const html = communicationHtml();
  const doc = appliedDocument(r);
  const job = r.mockJobs.find(
    (j) => j.status === "queued" || j.status === "running",
  );
  useEffect(() => {
    if (!job || !saved) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        let next: MockJob;
        if (job.id.startsWith("pending:")) {
          const d = r.requirements.find(
            (d) => d.id === job.requirementDocumentId,
          );
          if (!d) throw new Error("기준 문서를 찾을 수 없습니다.");
          next = await systemMockService.start(
            d,
            job.legacyVersion,
            job.idempotencyKey,
          );
        } else next = await systemMockService.get(job.id);
        if (!cancelled)
          update((latest) =>
            mergeMockJob(
              {
                ...latest,
                mockJobs: latest.mockJobs.filter((j) => j.id !== job.id),
              },
              next,
            ),
          );
      } catch (e) {
        if (!cancelled)
          update((latest) =>
            mergeMockJob(latest, {
              ...job,
              status: "failed",
              error: e instanceof Error ? e.message : "Mock 생성 실패",
            }),
          );
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job, saved, r.id]);
  const displayed = r.mocks.find(
    (m) =>
      m.requirementDocumentId === doc?.id &&
      m.legacyVersion === r.legacyVersion,
  );
  function generate() {
    if (!doc || job || !saved) return;
    const key = crypto.randomUUID();
    update((latest) =>
      mergeMockJob(latest, {
        id: `pending:${key}`,
        idempotencyKey: key,
        requirementDocumentId: doc.id,
        legacyVersion: r.legacyVersion,
        generationNumber: 1,
        status: "queued",
        createdAt: new Date().toISOString(),
      }),
    );
  }
  return (
    <section className="panel system-mock-panel" id="system-mock">
      <div className="panel-heading">
        <span>시스템 적용 예상 화면</span>
        <Tag>현업 소통용</Tag>
      </div>
      <div className="panel-content">
        <div className="mock-toolbar">
          <button
            className="primary"
            disabled={
              !doc || doc.inputRevision !== r.inputRevision || !!job || !saved
            }
            onClick={generate}
          >
            {job ? "예상 화면 생성 중…" : "시스템 적용 Mock 생성"}
          </button>
          <button
            disabled={!displayed}
            onClick={() => downloadHtml(r.title, html)}
          >
            HTML 코드 다운로드
          </button>
        </div>
        {r.mockJobs
          .filter((j) => j.status === "failed")
          .map((j) => (
            <p role="alert" key={j.id}>
              {j.error} · 다시 생성해주세요.
            </p>
          ))}
        {displayed ? (
          <iframe
            className="communication-preview"
            title="시스템 적용 예상 화면 미리보기"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={html}
          />
        ) : (
          <Empty>
            요구사항 MD로 현업과 소통할 예상 화면을 생성할 수 있습니다.
          </Empty>
        )}
      </div>
    </section>
  );
}
