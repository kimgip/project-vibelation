import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { LegacyReference } from "../domain/legacySources";
import { legacyRepository } from "../storage/legacySources";
import { RequestContext, ScreenTitle } from "../components/WorkflowShell";
import type { WorkspaceProps } from "./workspace";

export function LegacyPicker({ r, edit, go, saved }: WorkspaceProps) {
  const [references, setReferences] = useState<LegacyReference[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void legacyRepository
      .references()
      .then((rows) => {
        if (!cancelled) setReferences(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "코드 기준 조회 실패");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <ScreenTitle
        title="[틀 고르기]"
        description="수정해야 할 나의 자원을 선택해 주세요."
      />
      <div className="legacy-picker-heading">
        <h2>① 레거시 자원</h2>
        <Link to="/settings/legacy">+ 기존 코드 ZIP 등록</Link>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="legacy-reference-list">
        <button
          className={r.legacyVersion === "DEMO-2026.10" ? "selected" : ""}
          aria-pressed={r.legacyVersion === "DEMO-2026.10"}
          onClick={() => edit({ legacyVersion: "DEMO-2026.10" })}
        >
          <span>
            <b>다운로드 센터 · 시연용 틀</b>
            <small>실제 코드 ZIP 없이 로컬 시연합니다.</small>
          </span>
          <span>{r.legacyVersion === "DEMO-2026.10" ? "✓" : "○"}</span>
        </button>
        {references
          .slice()
          .reverse()
          .map((ref) => (
            <button
              key={ref.id}
              className={r.legacyVersion === ref.id ? "selected" : ""}
              aria-pressed={r.legacyVersion === ref.id}
              onClick={() => edit({ legacyVersion: ref.id })}
            >
              <span>
                <b>{ref.name}</b>
                <small>
                  {ref.archives
                    .map(
                      (a) =>
                        `${a.role === "frontend" ? "프론트" : "백엔드"}: ${a.name}`,
                    )
                    .join(" · ")}
                </small>
                <small>
                  {new Date(ref.createdAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}{" "}
                  · 적용 당시 코드 보존
                </small>
              </span>
              <span>{r.legacyVersion === ref.id ? "✓" : "○"}</span>
            </button>
          ))}
      </div>
      <h2 className="legacy-request-label">② 요청 정보</h2>
      <RequestContext r={r} edit={edit} />
      {!r.title.trim() && (
        <label className="legacy-title-field">
          화면·요청 제목
          <input
            value={r.title}
            maxLength={160}
            placeholder="예: 다운로드 센터에 미리보기 추가하기"
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
      )}
      <div className="workflow-actions">
        <Link className="button" to="/">
          이전
        </Link>
        <button
          className="primary"
          disabled={!saved}
          onClick={() => go("input?view=materials")}
        >
          다음 &gt;
        </button>
      </div>
    </>
  );
}
