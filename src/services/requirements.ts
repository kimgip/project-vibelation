import { requirementFixture } from "../mocks/fixtures";
import { renderMockTemplate } from "../mocks/template";
import type {
  InputSnapshot,
  RequirementGeneration,
  RequirementDocument,
} from "../domain/types";
export interface UploadedFile {
  serverFileId: string;
  name: string;
  size: number;
  type: string;
}
export interface RequirementsService {
  readonly mode: "mock" | "server";
  select(
    requestId: string,
    documentId: string,
    inputRevision: number,
    signal: AbortSignal,
  ): Promise<void>;
  upload(
    requestId: string,
    file: File,
    signal: AbortSignal,
  ): Promise<UploadedFile>;
  start(
    input: InputSnapshot,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<RequirementGeneration>;
  get(
    requestId: string,
    generationId: string,
    signal: AbortSignal,
  ): Promise<RequirementGeneration>;
  list(requestId: string, signal: AbortSignal): Promise<RequirementDocument[]>;
}
export const FILE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  maxCount: 5,
  extensions: [
    "txt",
    "md",
    "html",
    "pdf",
    "docx",
    "pptx",
    "png",
    "jpg",
    "jpeg",
  ],
};
export function validateFiles(files: File[], existingCount: number) {
  if (existingCount + files.length > FILE_POLICY.maxCount)
    throw new Error("시연에서는 최대 5개 파일을 첨부할 수 있습니다.");
  for (const f of files) {
    if (f.size > FILE_POLICY.maxBytes)
      throw new Error(`${f.name}: 시연 파일당 최대 5MiB입니다.`);
    if (
      !FILE_POLICY.extensions.includes(f.name.split(".").pop()!.toLowerCase())
    )
      throw new Error(`${f.name}: 지원하지 않는 시연 파일 형식입니다.`);
  }
}
const JOBS = "vibelation.mock.requirement-jobs.v1";
function jobs(): RequirementGeneration[] {
  const raw = localStorage.getItem(JOBS);
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (
    !Array.isArray(data) ||
    data.some((g) => !g || typeof g.id !== "string" || !g.inputSnapshot)
  )
    throw new Error("Mock 생성 작업 저장 자료가 손상되었습니다.");
  return data;
}
function save(job: RequirementGeneration) {
  localStorage.setItem(
    JOBS,
    JSON.stringify([job, ...jobs().filter((g) => g.id !== job.id)]),
  );
}
const ensure = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("조회 취소", "AbortError");
};
export const mockRequirementsService: RequirementsService = {
  mode: "mock",
  async select(_requestId, _documentId, _inputRevision, signal) {
    ensure(signal);
  },
  async upload(requestId, file, signal) {
    ensure(signal);
    await file.arrayBuffer();
    ensure(signal);
    return {
      serverFileId: `mock:${requestId}:${crypto.randomUUID()}`,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  },
  async start(input, key, signal) {
    ensure(signal);
    const all = jobs();
    const existing = all.find(
      (g) =>
        g.idempotencyKey === key &&
        g.inputSnapshot.requestId === input.requestId,
    );
    if (existing) return existing;
    const g: RequirementGeneration = {
      id: crypto.randomUUID(),
      idempotencyKey: key,
      inputSnapshot: structuredClone(input),
      generationNumber:
        Math.max(
          0,
          ...all
            .filter((g) => g.inputSnapshot.requestId === input.requestId)
            .map((g) => g.generationNumber),
        ) + 1,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    save(g);
    return g;
  },
  async get(requestId, id, signal) {
    ensure(signal);
    const g = jobs().find(
      (g) => g.id === id && g.inputSnapshot.requestId === requestId,
    );
    if (!g) throw new Error("생성 작업을 찾을 수 없습니다.");
    if (g.status === "succeeded" || g.status === "failed") return g;
    const elapsed = Date.now() - Date.parse(g.createdAt);
    if (elapsed < 900) return { ...g, status: "running" };
    const s = g.inputSnapshot;
    const document: RequirementDocument = {
      id: crypto.randomUUID(),
      generationId: g.id,
      generationNumber: g.generationNumber,
      inputRevision: s.inputRevision,
      inputSnapshot: s,
      source: requirementFixture.source,
      formatVersion: requirementFixture.formatVersion,
      createdAt: new Date().toISOString(),
      markdown: renderMockTemplate(requirementFixture.markdownTemplate, {
        generationNumber: g.generationNumber,
        title: s.title,
        inputRevision: s.inputRevision,
        text: s.text || "(미입력)",
        html: s.html || "<!-- 미입력 -->",
        attachments:
          s.attachmentNames.map((n) => "- " + n).join("\n") || "(없음)",
      }),
    };
    const result = { ...g, status: "succeeded" as const, document };
    save(result);
    return result;
  },
  async list(requestId, signal) {
    ensure(signal);
    const result: RequirementDocument[] = [];
    for (const j of jobs().filter(
      (g) => g.inputSnapshot.requestId === requestId,
    )) {
      const g = await this.get(requestId, j.id, signal);
      if (g.document) result.push(g.document);
    }
    return result.sort((a, b) => b.generationNumber - a.generationNumber);
  },
};
export function createHttpRequirementsService(
  baseUrl: string,
): RequirementsService {
  const base = baseUrl.replace(/\/$/, "");
  async function request<T>(
    path: string,
    signal: AbortSignal,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(base + path, {
      ...init,
      signal,
      credentials: "same-origin",
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: `서버 오류 (${response.status})` }));
      throw new Error(error.message || `서버 오류 (${response.status})`);
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  const route = (id: string) => `/api/requests/${encodeURIComponent(id)}`;
  return {
    mode: "server",
    async select(id, documentId, inputRevision, signal) {
      await request(`${route(id)}/selected-requirement`, signal, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          expectedInputRevision: inputRevision,
        }),
      });
    },
    upload(id, file, signal) {
      const data = new FormData();
      data.append("file", file);
      return request(`${route(id)}/attachments`, signal, {
        method: "POST",
        body: data,
      });
    },
    start(input, key, signal) {
      return request(
        `${route(input.requestId)}/requirement-generations`,
        signal,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify(input),
        },
      );
    },
    async get(id, job, signal) {
      const result = await request<
        RequirementGeneration & { documentId?: string }
      >(
        `${route(id)}/requirement-generations/${encodeURIComponent(job)}`,
        signal,
      );
      if (
        result.status === "succeeded" &&
        !result.document &&
        result.documentId
      ) {
        result.document = await request<RequirementDocument>(
          `${route(id)}/requirement-documents/${encodeURIComponent(result.documentId)}`,
          signal,
        );
      }
      if (result.status === "succeeded" && !result.document)
        throw new Error(
          "완료된 문서 응답을 확인할 수 없습니다. 작업 상태를 다시 확인해주세요.",
        );
      return result;
    },
    async list(id, signal) {
      let cursor: string | undefined;
      const documents: RequirementDocument[] = [];
      const seen = new Set<string>();
      do {
        const page = await request<{
          items: RequirementDocument[];
          nextCursor?: string;
        }>(
          `${route(id)}/requirement-documents${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`,
          signal,
        );
        documents.push(...page.items);
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new Error("이력 페이지 응답이 반복되었습니다.");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return documents;
    },
  };
}
const base = (import.meta as ImportMeta & { env?: Record<string, string> }).env
  ?.VITE_REQUIREMENTS_API_URL;
export const requirementsService = base
  ? createHttpRequirementsService(base)
  : mockRequirementsService;
// File objects stay in memory only. On reload a pending upload must be reselected.
export const pendingFiles = new Map<string, File>();
