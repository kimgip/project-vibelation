import {
  activeConfirmation,
  hasConfirmedRequirement,
  appliedDocument,
} from "../domain/types";
import { Tag } from "../components/shared";
import type { WorkspaceProps } from "./workspace";
export function RequirementConfirmationPanel({ r }: WorkspaceProps) {
  const c = activeConfirmation(r),
    doc = appliedDocument(r);
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
          확정한 요구사항 MD와 선택한 코드 ZIP을 분석 서버로 전달합니다. Mock
          생성은 선택 사항입니다. 협의한 내용은 MD에 반영한 후 확정해주세요.
        </p>
        <div className="confirmation-summary">
          <b>분석에 사용할 요구사항 MD</b>
          <p>
            {doc
              ? `요구사항 v${doc.generationNumber} · 입력 자료 v${doc.generationNumber}`
              : "협의 기준 MD를 선택해주세요."}
          </p>
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
