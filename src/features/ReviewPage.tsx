import { useState } from "react";
import {
  activeConfirmation,
  canRegister,
  isCurrent,
  readyForReview,
} from "../domain/types";
import { ScreenTitle } from "../components/WorkflowShell";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Empty, Tag } from "../components/shared";
import { downloadMarkdown } from "../utils/downloads";
import { cases } from "../mocks/download-center";
import type { WorkspaceProps } from "./workspace";
const tabs = [
  ["summary", "검토 요약"],
  ["resources", "영향 자원"],
  ["cases", "유사사례"],
  ["report", "리포트 원문"],
];
export function ReviewPage({
  r,
  run,
  busy,
  saved,
  check,
  go,
  register,
}: WorkspaceProps) {
  const [tab, setTab] = useState("summary");
  const reportCurrent = isCurrent(r, r.report),
    analysisCurrent = isCurrent(r, r.analysis);
  const analysis = analysisCurrent ? r.analysis : undefined;
  return (
    <>
      <ScreenTitle
        title="[붓기 준비 완료]"
        description="예상 공수, 유사사례를 확인하여 최종 협의를 마무리해요."
      />
      <div className="report-tabs" role="tablist" aria-label="검토 리포트">
        {tabs.map(([id, name]) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${tab}`}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        className="review-content"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "summary" ? (
          <>
            <h2>{r.title || "새 개선 요청"}, 붓기 준비를 확인해요</h2>
            <p className="review-estimate">
              예상 공수 {analysis?.totalDays ?? "—"}일 · 예상 기간{" "}
              {analysis?.durationDays ?? "—"}근무일 · 버퍼{" "}
              {analysis?.bufferDays ?? "—"}근무일
            </p>
            <section>
              <h3>합의한 요구사항</h3>
              <MarkdownPreview
                markdown={
                  activeConfirmation(r)?.documentSnapshot.markdown ||
                  "확정한 문서가 없습니다."
                }
              />
            </section>
            <section>
              <h3>손댈 곳</h3>
              <div className="resource-counts">
                {(["UI", "Logic", "API", "DB", "Permission"] as const).map(
                  (type) => (
                    <Tag key={type}>
                      {type}{" "}
                      {analysis?.impacts.filter((i) => i.type === type)
                        .length ?? 0}
                    </Tag>
                  ),
                )}
              </div>
            </section>
            <section>
              <h3>개발 전에 확인할 것</h3>
              <p>
                변경 후보·공수는 검토 기준입니다. 미확정 사항과 수용 기준을
                확인하고, 내용이 달라지면 MD를 다시 선택·확정해주세요.
              </p>
              <small>
                {analysis?.source === "server"
                  ? "서버 분석 결과 기준"
                  : "실제 수행 실적·인력 달력 미연결 · 시연 산정"}{" "}
                · 리포트 문서 생성과 이력 등록은 로컬 시연입니다.
              </small>
            </section>
          </>
        ) : tab === "resources" ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>자원</th>
                  <th>유형</th>
                  <th>변경 방향 · 근거</th>
                  <th>예상 공수</th>
                </tr>
              </thead>
              <tbody>
                {analysis?.impacts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      <small>{item.path}</small>
                    </td>
                    <td>
                      <Tag>{item.type}</Tag>
                    </td>
                    <td>
                      {item.proposed}
                      <small>{item.reason}</small>
                    </td>
                    <td>{item.days}일</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!analysis && <Empty>현재 기준의 분석이 필요합니다.</Empty>}
          </div>
        ) : tab === "cases" ? (
          <>
            <p className="workflow-info">
              참고용 고정 시연 사례입니다. 업로드한 코드와의 실제 유사도 검색
              결과가 아닙니다.
            </p>
            {cases.map((item) => (
              <section className="similar-case" key={item.title}>
                <Tag>시연용 사례</Tag>
                <h3>{item.title}</h3>
                <p>{item.reason}</p>
                <small>차이점: {item.difference}</small>
              </section>
            ))}
          </>
        ) : reportCurrent && r.report ? (
          <MarkdownPreview markdown={r.report.markdown} />
        ) : (
          <Empty>최신 기준의 검토 리포트를 생성해주세요.</Empty>
        )}
      </div>
      <div className="workflow-actions">
        <button onClick={() => go("analysis")}>
          &lt; 탕도 살피기로 돌아가기
        </button>
        <div>
          <button
            disabled={!saved || !!busy || !readyForReview(r)}
            onClick={() => run("report")}
          >
            {busy === "report"
              ? "리포트 생성 중…"
              : reportCurrent
                ? "리포트 다시 생성"
                : "리포트 생성"}
          </button>
          <button
            disabled={!reportCurrent}
            onClick={() =>
              r.report &&
              downloadMarkdown(
                r.title,
                "검토리포트",
                r.report.basis.revision,
                r.report.markdown,
              )
            }
          >
            준비서 내려받기
          </button>
        </div>
      </div>
      <section className="final-checks">
        <h3>최종 검토 확인</h3>
        <label>
          <input
            type="checkbox"
            checked={r.scopeReviewed}
            disabled={!reportCurrent}
            onChange={(e) => check({ scopeReviewed: e.target.checked })}
          />
          합의 범위와 제외 범위를 확인했습니다.
        </label>
        <label>
          <input
            type="checkbox"
            checked={r.estimateReviewed}
            disabled={!reportCurrent}
            onChange={(e) => check({ estimateReviewed: e.target.checked })}
          />
          수정 자원·예상 공수·미확정 사항을 검토했습니다.
        </label>
        <button
          className="primary"
          disabled={!saved || !!busy || !canRegister(r)}
          onClick={register}
        >
          검토 이력에 등록하기
        </button>
      </section>
    </>
  );
}
