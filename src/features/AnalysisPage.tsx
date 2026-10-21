import { ImpactGraph } from "../components/ImpactGraph";

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
  return (
    <>
      <ScreenTitle
        title="[탕도 살피기]"
        description="탕도는 쇳물이 틀 곳곳으로 흘러가는 길이에요. 요구사항이 닿는 화면·로직·API·DB를 찾아요."
      />
      <RequestContext r={r} edit={edit} />
      {isCurrent(r, r.analysis) && r.analysis?.impactGraphError && <p role="alert">영향도 지도 데이터 오류 ({r.analysis.impactGraphError}). 자원 상세를 확인해주세요.</p>}
      {isCurrent(r, r.analysis) && r.analysis?.impactGraph && <ImpactGraph graph={r.analysis.impactGraph} analysisId={r.analysis.id} />}
      {!r.analysis?.impactGraph && <Empty>{busy === "analysis" ? "확정한 요구사항과 코드를 분석하고 있습니다." : "지도 데이터가 없습니다. 성분 보기에서 요구사항을 확인한 뒤 다시 진행해주세요."}</Empty>}
      <StepFooter
        back={{
          label: "‹ 미리 붓기",
          onClick: () => go("input?view=preview"),
        }}
        next={{
          label: "붓기 준비 완료 ›",
          disabled: !saved || !!busy || !readyForReview(r),
          onClick: () => run("similarCaseAnalysis"),
        }}
        reason={
          !saved
            ? "저장이 완료되면 진행할 수 있어요"
            : busy === "analysis"
              ? "분석이 끝나면 진행할 수 있어요"
              : busy
                ? "유사사례 분석이 끝나면 진행할 수 있어요"
                : !hasConfirmedRequirement(r)
                  ? "요구사항을 확정하면 진행할 수 있어요"
                  : "분석 결과를 받으면 진행할 수 있어요"
        }
      />
    </>
  );
}
