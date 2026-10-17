import {
  basisOf,
  isCurrent,
  hasConfirmedRequirement,
  activeConfirmation,
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
export const agreementMarkdown = (r: WorkRequest) => {
  const c = activeConfirmation(r);
  if (!c) return "# 협의사항\n아직 요구사항을 확정하지 않았습니다.";
  return `# 확정 협의사항\n\n확정 ID: ${c.id}\n확정 v${c.version}\nMD: ${c.documentSnapshot.id}\nMock: ${c.mockSnapshot ? `${c.mockSnapshot.id} (${c.mockReviewed ? "확인" : "미확인"})` : "없음"}\n\n## 합의 범위\n${c.agreementSnapshot.scope || "없음"}\n\n## 수용 기준\n${c.agreementSnapshot.acceptanceCriteria || "없음"}\n\n## 제외 범위\n${c.agreementSnapshot.exclusions || "없음"}\n\n## 미확정 사항\n${c.agreementSnapshot.unresolvedItems || "없음"}\n`;
};
export interface VibelationService {
  analyze(r: WorkRequest, s: AbortSignal): Promise<Analysis>;
  report(r: WorkRequest, s: AbortSignal): Promise<Artifact>;
}
export const mockService: VibelationService = {
  async analyze(r, s) {
    if (!hasConfirmedRequirement(r))
      throw new Error("Step 01에서 현재 요구사항을 먼저 확정해주세요.");
    await wait(s);
    return {
      basis: basisOf(r),
      id: crypto.randomUUID(),
      impacts: structuredClone(impacts),
      totalDays: 8.5,
      durationDays: 9,
      bufferDays: 2,
    };
  },
  async report(r, s) {
    if (!readyForReview(r))
      throw new Error(
        "현재 요구사항 확정과 해당 확정 기준의 영향도 분석이 필요합니다. Mock은 필수가 아닙니다.",
      );
    await wait(s);
    return {
      basis: basisOf(r),
      id: crypto.randomUUID(),
      analysisId: r.analysis!.id,
      markdown: `# 검토결과 리포트\n\n${r.title}\n검토 기준: v${r.revision} / ${r.legacyVersion}\n적용 요구사항 문서: ${r.selectedRequirementDocumentId || "미적용"}\n양식: mock-v2\n\n> 고정 시나리오의 시연용 제안입니다. 실제 분석·산정 결과가 아닙니다.\n\n${agreementMarkdown(r)}\n## 영향 후보와 근거\n${r.analysis!.impacts.map((i) => `- ${i.type} · ${i.name}: ${i.proposed}\n  근거: ${i.reason}\n  샘플 경로: ${i.path} / 예상 ${i.days}일`).join("\n")}\n\n## 공수·일정\n자원 작업 7.5일 + 통합 검증 1일 = 예상 공수 8.5일.\n1인 순차 작업의 예시 기간 9근무일 + 버퍼 2근무일 = 11근무일.\n1일 기준시간 미확정. 시작일·휴일 미적용으로 마감 가능성은 판단하지 않습니다.\n\n## 유사사례\n자료 상세 안내 개선: 모달 재사용이 공통점이나 ZIP·권한 처리 범위는 다릅니다. 실제 수행 공수는 미연결입니다.\n\n## 남은 위험\n용량·파일 접근 권한·이력 정책은 운영 연결 전에 확정합니다. SR·운영보고와 실제 수행 결과 수집은 후속 범위입니다.\n`,
    };
  },
};
export { sample };
