import { useEffect, useState } from "react";
import {
  appliedDocument,
  editRequest,
  mergeMockJob,
  validSelectedMock,
  type WorkRequest,
  type MockJob,
} from "../domain/types";
import { systemMockService } from "../services/systemMocks";
import { ProductPreview, Tag, Empty } from "../components/shared";
export function SystemMockPanel({
  r,
  update,
  saved,
}: {
  r: WorkRequest;
  update: (fn: (r: WorkRequest) => WorkRequest) => void;
  saved: boolean;
}) {
  const [viewId, setViewId] = useState<string>(),
    [error, setError] = useState(""),
    [scenario, setScenario] = useState<"success" | "partial" | "failure">(
      "success",
    );
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
  const list = r.mocks.filter((m) => m.requirementDocumentId === doc?.id);
  const displayed = list.find((m) => m.id === viewId) || list[0];
  const current = displayed && displayed.legacyVersion === r.legacyVersion;
  const change = (patch: Partial<WorkRequest>) =>
    update((latest) => editRequest(latest, patch));
  function generate() {
    if (!doc || job || !saved) return;
    const key = crypto.randomUUID();
    const pending: MockJob = {
      id: `pending:${key}`,
      idempotencyKey: key,
      requirementDocumentId: doc.id,
      legacyVersion: r.legacyVersion,
      generationNumber: 1,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    update((latest) => mergeMockJob(latest, pending));
  }
  return (
    <section className="panel system-mock-panel" id="system-mock">
      <div className="panel-heading">
        <span>시스템 적용 예상 화면</span>
        <Tag>선택 기능 · 확인 필수 아님</Tag>
      </div>
      <div className="panel-content">
        <p>
          협의 기준 MD와 연결된 예상 동작을 확인합니다. Mock 없이도 요구사항을
          확정할 수 있습니다.
        </p>
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
            disabled={!r.selectedMockId || !saved}
            onClick={() => change({ selectedMockId: undefined })}
          >
            Mock 없이 확정하기로 선택
          </button>
          <Tag>
            {r.selectedMockId
              ? validSelectedMock(r)
                ? "확정에 포함할 Mock 선택됨"
                : "선택 Mock 재검토 필요"
              : "Mock 포함 안 함"}
          </Tag>
        </div>
        {job && (
          <p role="status">
            선택적 Mock 생성 중입니다. 기다리지 않고 Mock 없이 확정할 수
            있습니다.
          </p>
        )}
        {r.mockJobs
          .filter((j) => j.status === "failed")
          .map((j) => (
            <p className="inline-error" role="alert" key={j.id}>
              {j.error} · Mock 없이 확정하거나 다시 생성해주세요.
            </p>
          ))}
        {error && <p role="alert">{error}</p>}
        {list.length ? (
          <>
            <div className="mock-toolbar">
              {list.map((m) => (
                <button
                  aria-pressed={displayed?.id === m.id}
                  key={m.id}
                  onClick={() => setViewId(m.id)}
                >
                  Mock {m.generationNumber}
                  {r.selectedMockId === m.id ? " · 포함 선택" : ""}
                </button>
              ))}
            </div>
            {displayed && (
              <>
                <div className="info-strip">
                  사전 작성된 신뢰된 동작 시연입니다. 서버 AI 생성·레거시
                  분석·생성 JavaScript 실행은 미연결입니다.
                </div>
                <div className="mock-grid">
                  <div>
                    <label>
                      시연할 다운로드 결과
                      <select
                        aria-label="시연할 다운로드 결과"
                        value={scenario}
                        onChange={(e) =>
                          setScenario(e.target.value as typeof scenario)
                        }
                      >
                        <option value="success">성공</option>
                        <option value="partial">일부 파일 누락</option>
                        <option value="failure">실패</option>
                      </select>
                    </label>
                    <ProductPreview
                      key={displayed.id}
                      applied
                      resultScenario={scenario}
                    />
                  </div>
                  <div>
                    <h3>시연할 동작</h3>
                    <ul>
                      {displayed.behaviors.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <h3>가정</h3>
                    {displayed.assumptions.map((a) => (
                      <p key={a}>{a}</p>
                    ))}
                    <h3>미연결 기능</h3>
                    <p>{displayed.unconnectedFeatures.join(" · ")}</p>
                    <small>
                      기준 MD: {displayed.requirementDocumentId}
                      <br />
                      코드 기준: {displayed.legacyVersion}
                    </small>
                    <div className="mock-toolbar">
                      <button
                        disabled={!current || !saved}
                        onClick={() => {
                          setError("");
                          change({ selectedMockId: displayed.id });
                        }}
                      >
                        이 Mock을 확정 묶음에 포함
                      </button>
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={r.reviewedMockIds.includes(displayed.id)}
                        disabled={!saved}
                        onChange={(e) =>
                          change({
                            reviewedMockIds: e.target.checked
                              ? [...r.reviewedMockIds, displayed.id]
                              : r.reviewedMockIds.filter(
                                  (id) => id !== displayed.id,
                                ),
                          })
                        }
                      />
                      예상 동작을 확인했습니다 (선택)
                    </label>
                    {!current && (
                      <p>
                        이전 코드 기준입니다. 새로 생성하거나 Mock 없이
                        확정해주세요.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <Empty>
            선택한 요구사항 MD의 Mock이 없습니다. 생성하지 않고 확정해도 됩니다.
          </Empty>
        )}
      </div>
    </section>
  );
}
