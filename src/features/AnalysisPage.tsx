import { ImpactGraph } from "../components/ImpactGraph";
import { useState } from "react";
import {
  hasConfirmedRequirement,
  isCurrent,
  readyForReview,
} from "../domain/types";
import {
  ScreenTitle,
  RequestContext,
  StepFooter,
} from "../components/WorkflowShell";
import { Empty, LaneBadge, Tag } from "../components/shared";
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
  return (
    <>
      <ScreenTitle
        title="[탕도 살피기]"
        description="탕도는 쇳물이 틀 곳곳으로 흘러가는 길이에요. 요구사항이 닿는 화면·로직·API·DB를 찾아요."
      />
      <RequestContext r={r} edit={edit} />
      <div className="workflow-notice">
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
      {isCurrent(r, r.analysis) && r.analysis?.impactGraphError && <p role="alert">영향도 지도 데이터 오류 ({r.analysis.impactGraphError}). 자원 상세를 확인해주세요.</p>}
      {isCurrent(r, r.analysis) && r.analysis?.impactGraph && <ImpactGraph graph={r.analysis.impactGraph} analysisId={r.analysis.id} />}
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
                <LaneBadge type={resource.type} />
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
      <StepFooter
        back={{
          label: "‹ 미리 붓기",
          onClick: () => go("input?view=preview"),
        }}
        next={{
          label: "붓기 준비 완료 ›",
          disabled: !saved || !!busy || !readyForReview(r),
          onClick: () => run("report"),
        }}
        reason={
          !saved
            ? "저장이 완료되면 진행할 수 있어요"
            : busy === "analysis"
              ? "분석이 끝나면 진행할 수 있어요"
              : busy
                ? "리포트 생성이 끝나면 진행할 수 있어요"
                : !hasConfirmedRequirement(r)
                  ? "요구사항을 확정하면 진행할 수 있어요"
                  : "분석 결과를 받으면 진행할 수 있어요"
        }
      />
    </>
  );
}
