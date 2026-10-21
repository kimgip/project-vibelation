import { validateImpactGraph } from "../domain/impactGraph";
import graphFixture from "../mocks/step02-impact-graph.json" with { type: "json" };
import type { ImpactGraph } from "../domain/impactGraph";
import { apiJson, jsonPost, serverMode } from "./api";
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
  const body = generationFormData(input.file, input.sources || [], input.basis.legacyVersion);
  if (input.basis.screenType) body.append("screenType", input.basis.screenType);
  if (input.sources?.length) body.append("legacyReferenceId", input.basis.legacyVersion);
  return body;
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
    const id = crypto.randomUUID();
    return {
      basis: input.basis,
      id,
      impactGraph: { ...structuredClone(graphFixture), id: `graph-${id}`, analysisId: id } as ImpactGraph,
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
        undefined,
        input.basis.screenType,
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
        result.screenType !== input.basis.screenType ||
        result.confirmationId !== input.basis.confirmationId ||
        result.legacyVersion !== input.basis.legacyVersion ||
        result.requirementDocumentId !== input.basis.requirementDocumentId
      )
        throw new Error("서버 결과의 MD·코드 기준이 요청과 다릅니다.");
      const html = result.html, artifact = result.analysisHtmlArtifact;
      if (typeof html !== "string" || !html.trim() || !artifact || typeof artifact.id !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error("서버 분석 HTML 파일을 확인할 수 없습니다.");
      const bytes = new TextEncoder().encode(html);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
      if (bytes.byteLength !== artifact.sizeBytes || hash !== artifact.sha256) throw new Error("분석 HTML 파일 크기 또는 해시가 일치하지 않습니다.");
      localStorage.removeItem(ticketKey);
      const graphError = result.impactGraph === undefined ? null : validateImpactGraph(result.impactGraph, result.id, input.sources);
      return { ...result, impactGraph: graphError ? undefined : result.impactGraph, impactGraphError: graphError || undefined, basis: input.basis, source: "server" };
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

export async function generateReport(r: WorkRequest, signal: AbortSignal): Promise<Artifact> {
  if (!serverMode) return mockService.report(r, signal);
  if (!readyForReview(r) || !r.analysis?.analysisHtmlArtifact?.id) throw new Error("분석 HTML 파일이 필요합니다. 탕도 살피기에서 다시 분석해주세요.");
  const body = { requestId: r.id, confirmationId: r.activeConfirmationId, analysisResultId: r.analysis.id, analysisHtmlArtifactId: r.analysis.analysisHtmlArtifact.id };
  const ticketKey = `soetmul.report-job:${JSON.stringify(body)}`;
  const ticket = JSON.parse(localStorage.getItem(ticketKey) || "null") || { key: crypto.randomUUID() };
  localStorage.setItem(ticketKey, JSON.stringify(ticket));
  let job = ticket.id ? await apiJson(`/report-jobs/${encodeURIComponent(ticket.id)}`, signal) : await apiJson("/review-reports", signal, jsonPost(body, ticket.key));
  if (typeof job.id !== "string") throw new Error("리포트 작업 ID를 확인해주세요.");
  ticket.id = job.id; localStorage.setItem(ticketKey, JSON.stringify(ticket));
  for (let n = 0; n < 600; n++) {
    if (job.status === "failed") { localStorage.removeItem(ticketKey); throw new Error(job.error?.message || job.error || "리포트 생성 실패"); }
    if (job.status === "succeeded") {
      const result = job.report || job.artifact || job.result || (job.reportId ? await apiJson(`/review-reports/${encodeURIComponent(job.reportId)}`, signal) : undefined);
      if (!result || typeof result.markdown !== "string" || typeof result.id !== "string" || result.confirmationId !== r.activeConfirmationId || result.analysisResultId !== r.analysis.id || result.analysisHtmlArtifactId !== body.analysisHtmlArtifactId) throw new Error("리포트 산출물의 분석·확정 기준이 다릅니다.");
      localStorage.removeItem(ticketKey);
      return { ...result, analysisId: r.analysis.id, basis: basisOf(r) };
    }
    if (!["queued", "running"].includes(job.status)) throw new Error("리포트 작업 응답을 확인해주세요.");
    await waitForPoll(signal);
    job = await apiJson(`/report-jobs/${encodeURIComponent(job.id)}`, signal);
  }
  throw new Error("리포트 생성 대기 중입니다. 같은 작업을 다시 확인해주세요.");
}
