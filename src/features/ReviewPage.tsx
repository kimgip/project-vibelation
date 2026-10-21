import { canRegister, isCurrent } from "../domain/types";
import { ScreenTitle, StepFooter } from "../components/WorkflowShell";
import { ReviewContent } from "./ReviewContent";
import type { WorkspaceProps } from "./workspace";
export function ReviewPage({ r, busy, saved, go, register }: WorkspaceProps) {
  const current = isCurrent(r, r.analysis) && isCurrent(r, r.report);
  return <>
    <ScreenTitle title="[붓기 준비 완료]" description="검토 결과와 입력 자료를 확인하여 최종 협의를 마무리해요." />
    {current ? <ReviewContent r={r} /> : <p role="status">최신 기준의 검토 결과가 필요합니다. 탕도 살피기에서 다시 진행해주세요.</p>}
    <StepFooter back={{ label: "‹ 탕도 살피기", onClick: () => go("analysis") }} next={{ label: "이력에 등록", disabled: !saved || !!busy || !canRegister(r), onClick: register }} reason={!saved ? "저장이 완료되면 진행할 수 있어요" : busy ? "진행 중인 작업이 끝나면 진행할 수 있어요" : "최신 기준의 분석과 리포트가 필요합니다"} />
  </>;
}
