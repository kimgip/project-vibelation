import { systemMockFixture } from "../mocks/fixtures";
import type { MockJob, RequirementDocument } from "../domain/types";
import { generationTransport } from "./generationTransport";
import { sourcesForVersion } from "../storage/legacySources";
const KEY = "vibelation.mock.system-jobs.v1";
function load(): MockJob[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const rows = JSON.parse(raw);
  if (
    !Array.isArray(rows) ||
    rows.some(
      (j) =>
        !j ||
        typeof j.id !== "string" ||
        typeof j.requirementDocumentId !== "string" ||
        !["queued", "running", "succeeded", "failed"].includes(j.status),
    )
  )
    throw new Error(
      "Mock 작업 자료를 읽을 수 없습니다. 요구사항은 Mock 없이 확정할 수 있습니다.",
    );
  return rows;
}
function save(job: MockJob) {
  localStorage.setItem(
    KEY,
    JSON.stringify([job, ...load().filter((j) => j.id !== job.id)]),
  );
}
export const systemMockService = {
  async start(
    doc: RequirementDocument,
    legacyVersion: string,
    key: string,
  ): Promise<MockJob> {
    const rows = load();
    const existing = rows.find((j) => j.idempotencyKey === key);
    if (existing) return existing;
    if (generationTransport) {
      const requestId = doc.inputSnapshot.requestId;
      const archives = await sourcesForVersion(legacyVersion);
      const response = await generationTransport.start(
        `/requests/${encodeURIComponent(requestId)}/system-mock-generations`,
        new File([doc.markdown], "requirements.md", { type: "text/markdown" }),
        archives,
        legacyVersion,
        key,
        new AbortController().signal,
        doc.id,
      );
      if (
        typeof response.id !== "string" ||
        !["queued", "running"].includes(response.status)
      )
        throw new Error("Mock 작업 응답 형식을 확인해주세요.");
      const job: MockJob = {
        id: response.id,
        requestId,
        transport: "server",
        idempotencyKey: key,
        requirementDocumentId: doc.id,
        legacyVersion,
        generationNumber: 1,
        status: response.status,
        createdAt: new Date().toISOString(),
      };
      save(job);
      return job;
    }
    const job: MockJob = {
      id: crypto.randomUUID(),
      idempotencyKey: key,
      requirementDocumentId: doc.id,
      legacyVersion,
      generationNumber:
        Math.max(
          0,
          ...rows
            .filter((j) => j.requirementDocumentId === doc.id)
            .map((j) => j.generationNumber),
        ) + 1,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    save(job);
    return job;
  },
  async get(id: string): Promise<MockJob> {
    const job = load().find((j) => j.id === id);
    if (!job) throw new Error("Mock 작업을 찾을 수 없습니다.");
    if (job.status === "succeeded" || job.status === "failed") return job;
    if (job.transport === "server") {
      if (!generationTransport || !job.requestId)
        throw new Error("Mock 서버 연결 설정을 확인해주세요.");
      const response = await generationTransport.get(
        `/requests/${encodeURIComponent(job.requestId)}/system-mock-generations/${encodeURIComponent(job.id)}`,
        new AbortController().signal,
      );
      if (
        !["queued", "running", "succeeded", "failed"].includes(response.status)
      )
        throw new Error("Mock 상태 응답 형식이 올바르지 않습니다.");
      const next: MockJob = { ...job, status: response.status };
      if (response.status === "failed")
        next.error =
          typeof response.error === "string"
            ? response.error
            : "Mock 생성에 실패했습니다.";
      if (response.status === "succeeded") {
        const artifact =
          response.artifact ||
          (await generationTransport.get(
            `/requests/${encodeURIComponent(job.requestId)}/system-mock`,
            new AbortController().signal,
          ));
        if (
          typeof artifact.html !== "string" ||
          !artifact.html.trim() ||
          artifact.html.length > 2000000 ||
          artifact.requirementDocumentId !== job.requirementDocumentId ||
          artifact.legacyVersion !== job.legacyVersion
        )
          throw new Error("Mock HTML 또는 생성 기준이 요청과 다릅니다.");
        next.artifact = {
          id: typeof artifact.id === "string" ? artifact.id : job.id,
          requirementDocumentId: job.requirementDocumentId,
          legacyVersion: job.legacyVersion,
          generationNumber: job.generationNumber,
          createdAt: new Date().toISOString(),
          source: "server",
          renderer: "server-html",
          html: artifact.html,
          behaviors: [],
          assumptions: [],
          unconnectedFeatures: [],
        };
      }
      save(next);
      return next;
    }
    if (Date.now() - Date.parse(job.createdAt) < 900)
      return { ...job, status: "running" };
    const next: MockJob = {
      ...job,
      status: "succeeded",
      artifact: {
        id: crypto.randomUUID(),
        requirementDocumentId: job.requirementDocumentId,
        legacyVersion: job.legacyVersion,
        generationNumber: job.generationNumber,
        createdAt: new Date().toISOString(),
        source: systemMockFixture.source,
        renderer: systemMockFixture.renderer,
        behaviors: [...systemMockFixture.behaviors],
        assumptions: [...systemMockFixture.assumptions],
        unconnectedFeatures: [...systemMockFixture.unconnectedFeatures],
      },
    };
    save(next);
    return next;
  },
};
