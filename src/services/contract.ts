import {
  basisOf,
  isCurrent,
  hasAppliedRequirement,
  readyForReview,
  type WorkRequest,
  type Artifact,
  type Analysis,
} from "../domain/types";
import { impacts, sample } from "../mocks/download-center";
const wait = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("취소됨", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, 500);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("취소됨", "AbortError"));
      },
      { once: true },
    );
  });
export const agreementMarkdown = (r: WorkRequest) =>
  `# 최종 협의사항\n\n요청: ${r.title}\n검토 기준: v${r.revision} / ${r.legacyVersion}\n적용 요구사항 문서: ${r.selectedRequirementDocumentId || "미적용"}\n\n> 시연용 협의 문서 · 실제 승인 기록 아님\n\n## 합의·수용 기준·제외 범위\n${r.agreement}\n\n## 검토 의견\n${r.opinion || "별도 의견 없음"}\n`;
export interface VibelationService {
  analyze(r: WorkRequest, s: AbortSignal): Promise<Analysis>;
  systemMock(
    r: WorkRequest,
    s: AbortSignal,
  ): Promise<{ basis: ReturnType<typeof basisOf> }>;
  report(r: WorkRequest, s: AbortSignal): Promise<Artifact>;
}
export const mockService: VibelationService = {
  async analyze(r, s) {
    if (!hasAppliedRequirement(r))
      throw new Error(
        "현재 입력 기준의 요구사항 MD를 먼저 생성하고 적용해주세요.",
      );
    await wait(s);
    return {
      basis: basisOf(r),
      impacts: structuredClone(impacts),
      totalDays: 8.5,
      durationDays: 9,
      bufferDays: 2,
    };
  },
  async systemMock(r, s) {
    if (!isCurrent(r, r.analysis))
      throw new Error("현재 버전의 레거시 분석이 필요합니다.");
    await wait(s);
    return { basis: basisOf(r) };
  },
  async report(r, s) {
    if (!readyForReview(r))
      throw new Error(
        "요구사항 MD 적용·레거시 분석·시스템 Mock을 현재 버전으로 갱신하고 협의 내용을 입력해주세요.",
      );
    await wait(s);
    return {
      basis: basisOf(r),
      markdown: `# 검토결과 리포트\n\n${r.title}\n검토 기준: v${r.revision} / ${r.legacyVersion}\n적용 요구사항 문서: ${r.selectedRequirementDocumentId || "미적용"}\n양식: mock-v2\n\n> 고정 시나리오의 시연용 제안입니다. 실제 분석·산정 결과가 아닙니다.\n\n${agreementMarkdown(r)}\n## 영향 후보와 근거\n${r.analysis!.impacts.map((i) => `- ${i.type} · ${i.name}: ${i.proposed}\n  근거: ${i.reason}\n  샘플 경로: ${i.path} / 예상 ${i.days}일`).join("\n")}\n\n## 공수·일정\n자원 작업 7.5일 + 통합 검증 1일 = 예상 공수 8.5일.\n1인 순차 작업의 예시 기간 9근무일 + 버퍼 2근무일 = 11근무일.\n1일 기준시간 미확정. 시작일·휴일 미적용으로 마감 가능성은 판단하지 않습니다.\n\n## 유사사례\n자료 상세 안내 개선: 모달 재사용이 공통점이나 ZIP·권한 처리 범위는 다릅니다. 실제 수행 공수는 미연결입니다.\n\n## 남은 위험\n용량·파일 접근 권한·이력 정책은 운영 연결 전에 확정합니다. SR·운영보고와 실제 수행 결과 수집은 후속 범위입니다.\n`,
    };
  },
};
export { sample };
