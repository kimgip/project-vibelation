import { analysisFixture, reportFixture } from "../mocks/fixtures";
import { renderMockTemplate } from "../mocks/template";
import {
  basisOf,
  hasConfirmedRequirement,
  activeConfirmation,
  readyForReview,
  type WorkRequest,
  type Artifact,
  type Analysis,
  type Basis,
} from "../domain/types";
import { sample } from "../mocks/download-center";
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
/** Local provenance stays in the FE; the multipart payload contains one MD file only. */
export function analysisInput(r: WorkRequest) {
  if (!hasConfirmedRequirement(r))
    throw new Error("Step 01에서 현재 요구사항을 먼저 확정해주세요.");
  const c = activeConfirmation(r)!;
  return {
    basis: basisOf(r),
    file: new File([c.documentSnapshot.markdown], "requirements.md", {
      type: "text/markdown;charset=utf-8",
    }),
  };
}
export function analysisFormData(input: AnalysisInput): FormData {
  const body = new FormData();
  body.append("file", input.file);
  return body;
}
export interface AnalysisInput {
  basis: Basis;
  file: File;
}
export const agreementMarkdown = (r: WorkRequest) =>
  activeConfirmation(r)?.documentSnapshot.markdown || "";
export interface VibelationService {
  analyze(input: AnalysisInput, s: AbortSignal): Promise<Analysis>;
  report(r: WorkRequest, s: AbortSignal): Promise<Artifact>;
}
export const mockService: VibelationService = {
  async analyze(input, s) {
    const body = analysisFormData(input);
    if (!(body.get("file") instanceof File) || !input.file.name.endsWith(".md"))
      throw new Error("요구사항 MD 파일이 필요합니다.");
    await wait(s);
    return {
      basis: input.basis,
      id: crypto.randomUUID(),
      ...structuredClone(analysisFixture),
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
      markdown: renderMockTemplate(reportFixture.markdownTemplate, {
        title: r.title,
        revision: r.revision,
        legacyVersion: r.legacyVersion,
        documentId: r.selectedRequirementDocumentId || "미적용",
        requirements: agreementMarkdown(r),
        impacts: r
          .analysis!.impacts.map((i) =>
            renderMockTemplate(reportFixture.impactTemplate, { ...i }),
          )
          .join("\n"),
      }),
    };
  },
};
export { sample };
