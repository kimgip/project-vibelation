import { useState } from "react";
import {
  activeConfirmation,
  canConfirmRequirement,
  confirmRequirement,
  hasConfirmedRequirement,
  appliedDocument,
  selectedMock,
  type WorkRequest,
} from "../domain/types";
import { Tag } from "../components/shared";
import type { WorkspaceProps } from "./workspace";
export function RequirementConfirmationPanel({
  r,
  edit,
  update,
  saved,
  go,
}: WorkspaceProps) {
  const [error, setError] = useState("");
  const c = activeConfirmation(r),
    doc = appliedDocument(r),
    mock = selectedMock(r);
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
          합의한 내용을 MD와 함께 고정합니다. Mock 생성·확인과 생략 사유는
          필수가 아닙니다.
        </p>
        <div className="agreement-fields">
          {[
            ["agreement", "합의 범위"],
            ["acceptanceCriteria", "수용 기준"],
            ["exclusions", "제외 범위"],
            ["opinion", "미확정 사항 · 검토 의견"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                aria-label={label}
                value={
                  r[
                    key as
                      | "agreement"
                      | "acceptanceCriteria"
                      | "exclusions"
                      | "opinion"
                  ]
                }
                maxLength={8000}
                placeholder="해당 내용이 없으면 비워두세요."
                onChange={(e) => edit({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="confirmation-summary">
          <b>이번 확정 묶음</b>
          <p>
            요구사항:{" "}
            {doc
              ? `MD 생성 ${doc.generationNumber} · 입력 v${doc.inputRevision}`
              : "협의 기준 MD를 선택해주세요."}
          </p>
          <p>
            Mock:{" "}
            {mock
              ? `Mock ${mock.generationNumber} · ${r.reviewedMockIds.includes(mock.id) ? "확인 완료" : "미확인 (확정 가능)"}`
              : "없음 (확정 가능)"}
          </p>
          <small>
            서버 확정 API 미연결 · 로컬 시연용 불변 스냅샷으로 저장합니다.
          </small>
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
              : r.selectedMockId
                ? "요구사항 확정 후 분석하기"
                : "Mock 없이 요구사항 확정"}
          </button>
        </div>
        {c && (
          <p>
            최근 확정: v{c.version} · MD 생성{" "}
            {c.documentSnapshot.generationNumber} ·{" "}
            {c.mockSnapshot
              ? `Mock 포함 / ${c.mockReviewed ? "확인" : "미확인"}`
              : "Mock 없음"}
            . 변경 후 새로 확정하면 이전 기록은 보존됩니다.
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
                  {item.mockSnapshot
                    ? `Mock ${item.mockSnapshot.generationNumber} / ${item.mockReviewed ? "확인 완료" : "미확인"}`
                    : "Mock 없음"}{" "}
                  ·{" "}
                  {new Date(item.confirmedAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
                <pre>{JSON.stringify(item.agreementSnapshot, null, 2)}</pre>
              </div>
            ))}
          </details>
        )}
      </div>
    </section>
  );
}
