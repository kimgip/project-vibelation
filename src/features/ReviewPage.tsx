import { canRegister, isCurrent } from "../domain/types";
import { ScreenTitle, StepFooter } from "../components/WorkflowShell";
import { ReviewContent } from "./ReviewContent";
import type { WorkspaceProps } from "./workspace";
export function ReviewPage({ r, busy, saved, go, register }: WorkspaceProps) {
  const current = canRegister(r);
  return <>
    <ScreenTitle title="[붓기 준비 완료]" description="쇳물을 부을 준비가 됐어요. 정리된 결과를 확인하고, 비슷한 사례도 참고해 보세요." />
    {current ? <ReviewContent r={r} /> : <p role="status">최신 기준의 검토 결과가 필요합니다. 탕도 살피기에서 다시 진행해주세요.</p>}
    <StepFooter back={{ label: "‹ 탕도 살피기", onClick: () => go("analysis") }} next={{ label: "이력에 등록", disabled: !saved || !!busy || !canRegister(r), onClick: register }} reason={!saved ? "저장이 완료되면 진행할 수 있어요" : busy ? "진행 중인 작업이 끝나면 진행할 수 있어요" : "최신 기준의 영향도·유사사례 분석이 필요합니다"} />
  </>;
}
