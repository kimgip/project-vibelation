import { waitForPoll } from "./generationTransport";
import { saveMaterialFile } from "../storage/materialFiles";
import { requirementFixtureForGeneration } from "../mocks/fixtures";
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
  saveDocument(document: RequirementDocument, markdown: string, signal: AbortSignal): Promise<RequirementDocument>;
  select(
    requestId: string,
    documentId: string | null,
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
    context?: RequirementDocument,
    generationNumber?: number,
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
  async saveDocument(document, markdown, signal) {
    ensure(signal);
    const job = jobs().find(j => j.document?.id === document.id && j.inputSnapshot.requestId === document.inputSnapshot.requestId);
    if (!job?.document) throw new Error("저장할 문서를 찾을 수 없습니다.");
    if (job.document.markdown !== document.markdown) throw new Error("다른 곳에서 문서가 수정됐습니다. 편집 내용은 유지됩니다.");
    if (markdown === document.markdown) return document;
    const bytes = new TextEncoder().encode(markdown);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(v=>v.toString(16).padStart(2,"0")).join("");
    const saved = {...document,markdown,contentHash:hash,updatedAt:new Date().toISOString()};
    save({...job,document:saved});
    return saved;
  },
  async select(_requestId, _documentId, _inputRevision, signal) {
    ensure(signal);
  },
  async upload(requestId, file, signal) {
    ensure(signal);
    await file.arrayBuffer();
    ensure(signal);
    const serverFileId = `mock:${requestId}:${crypto.randomUUID()}`;
    await saveMaterialFile(serverFileId, file);
    ensure(signal);
    return {
      serverFileId,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  },
  async start(input, key, signal, context, generationNumber) {
    ensure(signal);
    const all = jobs();
    const existing = all.find(
      (g) =>
        g.idempotencyKey === key &&
        g.inputSnapshot.requestId === input.requestId,
    );
    if (existing) return existing;
    if (context && context.inputSnapshot.requestId !== input.requestId) throw new Error("다른 요청의 MD를 병합할 수 없습니다.");
    const previous = context || all.filter(g => g.inputSnapshot.requestId === input.requestId && g.status === "succeeded" && g.document).sort((a, b) => b.generationNumber - a.generationNumber)[0]?.document;
    const g: RequirementGeneration = {
      displayTitle: input.title || "요구사항",
      contextDocumentIds: previous ? [previous.id] : [],
      phase: "queued",
      id: crypto.randomUUID(),
      idempotencyKey: key,
      inputSnapshot: structuredClone(input),
      generationNumber:
        Math.max(
          (generationNumber || 1) - 1,
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
    if (elapsed < 900) return { ...g, status: "running", phase: "generating" };
    const s = g.inputSnapshot;
    const requirementFixture = requirementFixtureForGeneration(g.generationNumber);
    const document: RequirementDocument = {
      displayTitle: g.displayTitle || s.title || "요구사항",
      contextDocumentIds: g.contextDocumentIds || [],
      contextPolicyVersion: "same-request-latest-success-v1",
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
        title: g.displayTitle || s.title || "요구사항",
        requirements: "- 입력 자료의 기능 요구사항과 수용 조건을 확인합니다.",
        changes: g.contextDocumentIds?.length ? "- 같은 요청의 이전 MD를 참고하는 서버 생성이 필요합니다." : "- 최초 작성",
        inputRevision: s.inputRevision,
        text: s.text || "(미입력)",
        html: s.html || "<!-- 미입력 -->",
        attachments:
          s.attachmentNames.map((n) => "- " + n).join("\n") || "(없음)",
      }),
    };
    const result = { ...g, phase: "completed" as const, status: "succeeded" as const, document };
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

function validateJob(g: RequirementGeneration, requestId: string): RequirementGeneration {
  if (!g || typeof g.id !== "string" || !["queued", "running", "succeeded", "failed"].includes(g.status) || g.inputSnapshot?.requestId !== requestId)
    throw new Error("생성 작업의 요청 기준이 일치하지 않습니다.");
  if (g.phase === "merging_previous" && !g.contextDocumentIds?.length)
    throw new Error("이전 문서 없는 병합 상태를 적용할 수 없습니다.");
  if (g.document && g.document.inputSnapshot.requestId !== requestId)
    throw new Error("다른 요청의 MD 결과를 적용할 수 없습니다.");
  return g;
}

export function createHttpRequirementsService(
  baseUrl: string,
): RequirementsService {
  const base = baseUrl.replace(/\/$/, "").replace(/\/api$/, "");
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
    async saveDocument(document, markdown, signal) {
      const path = `${route(document.inputSnapshot.requestId)}/requirement-documents/${encodeURIComponent(document.id)}`;
      const response = await fetch(base + path, {signal, credentials:"same-origin"});
      if (!response.ok) throw new Error("문서 저장 기준을 조회하지 못했습니다.");
      const current = await response.json();
      if (current.markdown !== document.markdown) throw new Error("다른 곳에서 문서가 수정됐습니다. 새로고침 후 다시 확인해주세요. 편집 내용은 유지됩니다.");
      const etag = response.headers.get("ETag");
      if (!etag) throw new Error("서버가 MD 편집 저장을 지원하지 않습니다 (ETag 없음).");
      const result = await fetch(base + path, {method:"PATCH",signal,credentials:"same-origin",headers:{"Content-Type":"application/json","If-Match":etag},body:JSON.stringify({markdown})});
      if (!result.ok) throw new Error(result.status === 412 ? "다른 곳에서 문서가 수정됐습니다. 편집 내용을 보존한 뒤 새로고침해주세요." : "MD 저장에 실패했습니다. 편집 내용은 유지됩니다.");
      const saved = await result.json();
      if (saved.id !== document.id || saved.markdown !== markdown || saved.generationNumber !== document.generationNumber) throw new Error("저장된 문서 응답이 요청과 다릅니다.");
      return {...document,...saved};
    },
    async select(id, documentId, inputRevision, signal) {
      const current = await request<{requestRevision: number; inputRevision: number}>(route(id), signal);
      await request(route(id), signal, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingRequirementDocumentId: documentId, expectedInputRevision: current.inputRevision, expectedRequestRevision: current.requestRevision }),
      });
    },
    async upload(id, file, signal) {
      const data = new FormData(); data.append("file", file);
      let result = await request<UploadedFile & { id?: string; usableForGeneration?: boolean; extractionStatus?: string; error?: {message?: string} }>(`${route(id)}/attachments`, signal, { method: "POST", body: data });
      const fileId = result.serverFileId || result.id;
      if (!fileId) throw new Error("업로드 파일 ID를 확인할 수 없습니다.");
      for (let n = 0; result.usableForGeneration === false; n++) {
        if (result.extractionStatus === "failed" || n >= 600) throw new Error(result.error?.message || "첨부 자료 처리 상태를 확인해주세요.");
        await waitForPoll(signal);
        result = await request(`${route(id)}/attachments/${encodeURIComponent(fileId)}`, signal);
      }
      return { serverFileId: fileId, name: file.name, size: file.size, type: file.type };
    },
    async start(input, key, signal) {
      // A retry must reuse the same server snapshot, not capture a newer draft.
      const ticketKey = `soetmul.md-input:${input.requestId}:${key}`;
      let snapshotId = localStorage.getItem(ticketKey);
      if (!snapshotId) {
        const current = await request<{requestRevision: number}>(route(input.requestId), signal);
        const saved = await request<{inputRevision: number; inputSnapshotId?: string; inputSnapshot?: {id: string}}>(route(input.requestId), signal, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedRequestRevision: current.requestRevision, legacyReferenceId: input.legacyReferenceId, input: { title: input.title, text: input.text, html: input.html, attachmentIds: input.attachmentIds, desiredDueDate: input.desiredDueDate || null, screenType: input.screenType } }),
        });
        snapshotId = saved.inputSnapshotId || saved.inputSnapshot?.id || null;
        if (!snapshotId) throw new Error("저장된 입력 스냅샷을 확인할 수 없습니다.");
        localStorage.setItem(ticketKey, JSON.stringify({ id: snapshotId, inputRevision: saved.inputRevision }));
      }
      const ticket = JSON.parse(localStorage.getItem(ticketKey)!);
      const result = await request<RequirementGeneration>(`${route(input.requestId)}/requirement-generations`, signal, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ inputSnapshotId: ticket.id, expectedInputRevision: ticket.inputRevision }),
      });
      const hydrated = validateJob({ ...result, idempotencyKey: result.idempotencyKey || key, inputSnapshot: result.inputSnapshot || input }, input.requestId);
      localStorage.setItem(`soetmul.md-job:${input.requestId}:${hydrated.id}`, JSON.stringify(hydrated));
      return hydrated;
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
      const previous = JSON.parse(localStorage.getItem(`soetmul.md-job:${id}:${job}`) || "null") || {};
      const hydrated = validateJob({ ...previous, ...result }, id);
      localStorage.setItem(`soetmul.md-job:${id}:${job}`, JSON.stringify(hydrated));
      return hydrated;
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
        const detailed = await Promise.all(page.items.map(doc => doc.inputSnapshot && typeof doc.markdown === "string" ? doc : request<RequirementDocument>(`${route(id)}/requirement-documents/${encodeURIComponent(doc.id)}`, signal)));
        if (detailed.some(doc => doc.inputSnapshot?.requestId !== id)) throw new Error("다른 요청의 문서 이력이 포함되어 있습니다.");
        documents.push(...detailed);
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new Error("이력 페이지 응답이 반복되었습니다.");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return documents;
    },
  };
}
const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const base = env?.VITE_API_URL || env?.VITE_REQUIREMENTS_API_URL;
export const requirementsService = base
  ? createHttpRequirementsService(base)
  : mockRequirementsService;
// File objects stay in memory only. On reload a pending upload must be reselected.
export const pendingFiles = new Map<string, File>();
