import { systemMockFixture } from "../mocks/fixtures";
import type { MockJob, RequirementDocument } from "../domain/types";
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
