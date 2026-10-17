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
import {
  generationFormData,
  type SourceArchive,
} from "../domain/legacySources";
import { generationTransport, waitForPoll } from "./generationTransport";
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
/** Requirements use one confirmed MD; code ZIP bytes are added separately. */
export function analysisInput(r: WorkRequest, sources: SourceArchive[] = []) {
  if (!hasConfirmedRequirement(r))
    throw new Error("Step 01에서 현재 요구사항을 먼저 확정해주세요.");
  const c = activeConfirmation(r)!;
  return {
    basis: basisOf(r),
    sources,
    file: new File([c.documentSnapshot.markdown], "requirements.md", {
      type: "text/markdown;charset=utf-8",
    }),
  };
}
export function analysisFormData(input: AnalysisInput): FormData {
  return generationFormData(
    input.file,
    input.sources || [],
    input.basis.legacyVersion,
  );
}
export interface AnalysisInput {
  basis: Basis;
  file: File;
  sources?: SourceArchive[];
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
      source: "mock",
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
export async function analyzeRequirements(
  input: AnalysisInput,
  signal: AbortSignal,
): Promise<Analysis> {
  if (!generationTransport) return mockService.analyze(input, signal);
  const requestId = encodeURIComponent(input.basis.requestId);
  const confirmationId = encodeURIComponent(input.basis.confirmationId!);
  const ticketKey = `soetmul.analysis-job:${JSON.stringify(input.basis)}`;
  const stored = localStorage.getItem(ticketKey);
  const ticket = stored
    ? (JSON.parse(stored) as { key: string; id?: string })
    : { key: crypto.randomUUID(), id: undefined as string | undefined };
  if (
    typeof ticket.key !== "string" ||
    (ticket.id !== undefined && typeof ticket.id !== "string")
  )
    throw new Error("분석 복구 정보가 손상됐습니다. 저장 자료를 확인해주세요.");
  localStorage.setItem(ticketKey, JSON.stringify(ticket));
  let job = ticket.id
    ? await generationTransport.get(
        `/analysis-jobs/${encodeURIComponent(ticket.id)}`,
        signal,
      )
    : await generationTransport.start(
        `/requests/${requestId}/requirement-confirmations/${confirmationId}/analysis-jobs`,
        input.file,
        input.sources || [],
        input.basis.legacyVersion,
        ticket.key,
        signal,
      );
  if (typeof job.id === "string") {
    ticket.id = job.id;
    localStorage.setItem(ticketKey, JSON.stringify(ticket));
  }
  for (let count = 0; count < 600; count++) {
    if (job.status === "failed") {
      localStorage.removeItem(ticketKey);
      throw new Error(
        typeof job.error === "string" ? job.error : "서버 분석에 실패했습니다.",
      );
    }
    if (job.status === "succeeded") {
      const result =
        job.result ||
        (typeof job.analysisId === "string"
          ? await generationTransport.get(
              `/analysis-results/${encodeURIComponent(job.analysisId)}`,
              signal,
            )
          : undefined);
      if (
        !result ||
        !Array.isArray(result.impacts) ||
        ![result.totalDays, result.durationDays, result.bufferDays].every(
          (v) => typeof v === "number" && Number.isFinite(v),
        ) ||
        typeof result.id !== "string" ||
        !result.impacts.every(
          (v: Record<string, unknown>) =>
            typeof v?.id === "string" &&
            ["UI", "Logic", "API", "DB", "Permission"].includes(
              String(v.type),
            ) &&
            ["name", "path", "current", "proposed", "reason"].every(
              (k) => typeof v[k] === "string",
            ) &&
            typeof v.days === "number",
        )
      )
        throw new Error("서버 분석 결과 형식이 올바르지 않습니다.");
      if (
        result.confirmationId !== input.basis.confirmationId ||
        result.legacyVersion !== input.basis.legacyVersion ||
        result.requirementDocumentId !== input.basis.requirementDocumentId
      )
        throw new Error("서버 결과의 MD·코드 기준이 요청과 다릅니다.");
      localStorage.removeItem(ticketKey);
      return { ...result, basis: input.basis, source: "server" };
    }
    if (
      !["queued", "running"].includes(job.status) ||
      typeof job.id !== "string"
    )
      throw new Error("서버 작업 응답 형식을 확인해주세요.");
    await waitForPoll(signal);
    job = await generationTransport.get(
      `/analysis-jobs/${encodeURIComponent(job.id)}`,
      signal,
    );
  }
  throw new Error(
    "분석 대기 시간이 길어졌습니다. 서버 작업 상태를 확인해주세요.",
  );
}
export { sample };
