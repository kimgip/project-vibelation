import { useState } from "react";
import {
  activeConfirmation,
  canConfirmRequirement,
  confirmRequirement,
  hasConfirmedRequirement,
  appliedDocument,
} from "../domain/types";
import { Tag } from "../components/shared";
import type { WorkspaceProps } from "./workspace";
export function RequirementConfirmationPanel({
  r,
  update,
  saved,
  go,
}: WorkspaceProps) {
  const [error, setError] = useState("");
  const c = activeConfirmation(r),
    doc = appliedDocument(r);
  function confirm() {
    try {
      update((latest) => confirmRequirement(latest));
      setError("");
      go("analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "요구사항 확정 실패");
    }
  }
  return (
    <section className="panel requirement-confirmation" id="confirmation">
      <div className="panel-heading">
        <span>협의 및 요구사항 확정</span>
        <Tag green={hasConfirmedRequirement(r)}>
          {hasConfirmedRequirement(r)
            ? `확정 v${c!.version}`
            : "미확정 변경사항"}
        </Tag>
      </div>
      <div className="panel-content">
        <p>
          레거시 분석에는 확정한 요구사항 MD 파일 하나만 전달합니다. 협의한
          변경사항은 요구사항 MD에 반영한 후 확정해주세요.
        </p>
        <div className="confirmation-summary">
          <b>분석에 사용할 요구사항 MD</b>
          <p>
            {doc
              ? `MD 생성 ${doc.generationNumber} · 입력 v${doc.inputRevision}`
              : "협의 기준 MD를 선택해주세요."}
          </p>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="document-actions">
          <button
            className="primary"
            disabled={!saved || !canConfirmRequirement(r)}
            onClick={confirm}
          >
            {hasConfirmedRequirement(r)
              ? "확정된 요구사항으로 분석하기"
              : "요구사항 확정 후 분석하기"}
          </button>
        </div>
        {c && (
          <p>
            최근 확정: v{c.version} · MD 생성{" "}
            {c.documentSnapshot.generationNumber}. 변경 후 새로 확정하면 이전
            기록은 보존됩니다.
          </p>
        )}
        {r.confirmations.length > 0 && (
          <details>
            <summary>요구사항 확정 이력 ({r.confirmations.length})</summary>
            {r.confirmations.map((item) => (
              <div className="confirmation-history-row" key={item.id}>
                <b>
                  확정 v{item.version} · MD 생성{" "}
                  {item.documentSnapshot.generationNumber}
                </b>
                <p>
                  {new Date(item.confirmedAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
              </div>
            ))}
          </details>
        )}
      </div>
    </section>
  );
}
