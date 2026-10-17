import { useState } from "react";
import {
  hasConfirmedRequirement,
  isCurrent,
  readyForReview,
  appliedDocument,
} from "../domain/types";
import { ScreenTitle, RequestContext } from "../components/WorkflowShell";
import { Empty, Tag } from "../components/shared";
import { generationBase } from "../services/generationTransport";
import type { WorkspaceProps } from "./workspace";
export function AnalysisPage({
  r,
  edit,
  run,
  busy,
  saved,
  go,
}: WorkspaceProps) {
  const [selected, setSelected] = useState("");
  const resources = isCurrent(r, r.analysis) ? r.analysis?.impacts || [] : [];
  const item = resources.find((i) => i.id === selected) || resources[0];
  const hasPreview = r.mocks.some(
    (m) =>
      m.requirementDocumentId === appliedDocument(r)?.id &&
      m.legacyVersion === r.legacyVersion,
  );
  return (
    <>
      <ScreenTitle
        title="[탕도 살피기]"
        description="탕도는 쇳물이 틀 곳곳으로 흘러가는 길이에요. 요구사항이 닿는 화면·로직·API·DB를 찾아요."
      />
      <RequestContext r={r} edit={edit} />
      <div className="workflow-notice">
        <span>
          {generationBase
            ? "분석 실행 시 확정 MD와 선택한 코드 ZIP을 서버로 전송합니다."
            : "로컬 시연 · 다운로드 센터 고정 시나리오이며 실제 코드 ZIP을 분석하지 않습니다."}
        </span>
        <button
          disabled={!saved || !!busy || !hasConfirmedRequirement(r)}
          onClick={() => run("analysis")}
        >
          {busy === "analysis"
            ? "분석 중…"
            : resources.length
              ? "다시 분석"
              : "레거시 분석"}
        </button>
      </div>
      {item ? (
        <div className="analysis-grid">
          <section className="panel">
            <div className="panel-heading">
              <span>수정 · 검토 자원</span>
              <Tag>{resources.length}개 후보</Tag>
            </div>
            {resources.map((resource) => (
              <button
                className={`resource ${item.id === resource.id ? "selected" : ""}`}
                key={resource.id}
                aria-pressed={item.id === resource.id}
                onClick={() => setSelected(resource.id)}
              >
                <span className={`type-icon type-${resource.type}`}>
                  {resource.type}
                </span>
                <span>
                  <b>{resource.name}</b>
                  <small>{resource.path}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span>상세보기</span>
              <Tag>변경 제안</Tag>
            </div>
            <div className="resource-detail">
              <code>{item.path}</code>
              <div className="diff before">
                <b>
                  현재 구조
                  {r.analysis?.source !== "server" ? " · 시연 가정" : ""}
                </b>
                <p>{item.current}</p>
              </div>
              <div className="diff after">
                <b>변경 방향</b>
                <p>{item.proposed}</p>
              </div>
              <h3>연결 근거</h3>
              <p>{item.reason || "제공된 근거 없음"}</p>
              <h3>대상</h3>
              <p>{item.name}</p>
              <code>{item.path}</code>
              <p>
                <Tag>잠정 공수 {item.days}일</Tag>
              </p>
              <small>
                출처:{" "}
                {r.analysis?.source === "server"
                  ? "서버 분석 결과"
                  : "다운로드 센터 샘플"}
                . 실제 변경 전 담당자 검토가 필요합니다.
              </small>
            </div>
          </section>
        </div>
      ) : (
        <Empty>
          {busy === "analysis"
            ? "확정한 요구사항과 코드 기준으로 분석 중입니다."
            : "요구사항을 먼저 확정한 뒤 분석해주세요."}
        </Empty>
      )}
      <div className="workflow-actions">
        <button
          onClick={() =>
            go(hasPreview ? "input?view=preview" : "input?view=requirements")
          }
        >
          &lt; {hasPreview ? "미리 붓기" : "성분 보기"}로 돌아가기
        </button>
        <button
          className="primary"
          disabled={!saved || !!busy || !readyForReview(r)}
          onClick={() => run("report")}
        >
          {busy === "report" ? "리포트 생성 중…" : "최종 리포트 생성하기 >"}
        </button>
      </div>
    </>
  );
}
