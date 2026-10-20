import { apiBase, createBackendApi, operationKey, type Wire } from "./backendApi";
import { syncInput, serverState, documentFromWire, withServerLock } from "./serverWorkspace";
import { waitForPoll } from "./generationTransport";
import { requirementFixture, localMockSettings } from "../mocks/fixtures";
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
  ): Promise<RequirementGeneration>;
  get(
    requestId: string,
    generationId: string,
    signal: AbortSignal,
  ): Promise<RequirementGeneration>;
  list(requestId: string, signal: AbortSignal): Promise<RequirementDocument[]>;
}
export const FILE_POLICY = localMockSettings.filePolicy;
export function validateFiles(files: File[], existingCount: number) {
  if (existingCount + files.length > FILE_POLICY.maxCount)
    throw new Error(renderMockTemplate(FILE_POLICY.messages.count,{count:FILE_POLICY.maxCount}));
  for (const f of files) {
    if (f.size > FILE_POLICY.maxBytes)
      throw new Error(renderMockTemplate(FILE_POLICY.messages.size,{name:f.name,mib:FILE_POLICY.maxBytes/1024/1024}));
    if (
      !FILE_POLICY.extensions.includes(f.name.split(".").pop()!.toLowerCase())
    )
      throw new Error(renderMockTemplate(FILE_POLICY.messages.extension,{name:f.name}));
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
    if (elapsed < localMockSettings.timing.requirementReadyMs) return { ...g, status: "running" };
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
        screenType: localMockSettings.screenTypes.find(item=>item.value===s.screenType)?.name || localMockSettings.requirementFallbacks.screenType,
        inputRevision: s.inputRevision,
        text: s.text || localMockSettings.requirementFallbacks.text,
        html: s.html || localMockSettings.requirementFallbacks.html,
        attachments:
          s.attachmentNames.map((n) => "- " + n).join("\n") || localMockSettings.requirementFallbacks.attachments,
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
export function createHttpRequirementsService(baseUrl: string): RequirementsService {
  const root=baseUrl.replace(/\/+$/, "");
  const api = createBackendApi(new URL(root, "http://local").pathname === "/" ? root+"/api" : root);
  const keyFor = (id:string) => `soetmul.md-job-input:${apiBase}:${id}`;
  function jobFromWire(row:Wire,input:InputSnapshot,key=""):RequirementGeneration {
    localStorage.setItem(keyFor(row.id),JSON.stringify({input,key}));
    return {...row,inputSnapshot:input,idempotencyKey:key,error:typeof row.error === "string" ? row.error : row.error?.message} as RequirementGeneration;
  }
  return {
    mode:"server",
    async select(id,documentId,inputRevision,signal) {
      await withServerLock(id,async()=>{
      const state=serverState(id);
      const row=await api.patchRequest(id,{expectedRequestRevision:state.row.requestRevision,expectedInputRevision:state.row.inputRevision,workingRequirementDocumentId:documentId},signal);
      localStorage.setItem(`soetmul.server-request:${apiBase}:${id}`,JSON.stringify({...state,row}));
      localStorage.setItem(`soetmul.server-selection:${apiBase}:${id}`,JSON.stringify({id:documentId,inputRevision:row.inputRevision}));
      });
    },
    async upload(id,file,signal) {
      const policy=await api.attachmentPolicy(signal);
      const ext=file.name.split(".").pop()!.toLowerCase();
      if(!policy.allowedExtensions.includes(ext) || file.size>policy.maxFileBytes)throw new Error("서버의 첨부 형식·크기 정책을 확인해주세요.");
      const op=operationKey(`upload:${id}:${file.name}:${file.size}:${file.lastModified}`);
      let row=await api.uploadAttachment(id,file,op.key,signal);
      for(let i=0; !row.usableForGeneration; i++) {
        if(row.extractionStatus==="failed" || row.uploadStatus==="failed"){op.done();throw new Error(row.error?.message || "첨부 처리에 실패했습니다. 다시 업로드해주세요.");}
        if(i>=600)throw new Error("첨부 처리가 진행 중입니다. 같은 파일로 재시도하면 상태를 다시 조회합니다.");
        await waitForPoll(signal);row=await api.attachmentStatus(id,row.id,signal);
      }
      op.done();return {serverFileId:row.id,name:row.name,size:row.sizeBytes,type:row.contentType};
    },
    async start(input,key,signal) {
      const ticket=`soetmul.md-ticket:${apiBase}:${input.requestId}:${key}`;
      const stored=localStorage.getItem(ticket);
      if(stored) return this.get(input.requestId,stored,signal);
      const row=await syncInput(input,signal,undefined,api);
      const job=await api.startRequirements(input.requestId,{inputSnapshotId:row.inputSnapshotId,expectedInputRevision:row.inputRevision},key,signal);
      localStorage.setItem(ticket,job.id);
      const result=jobFromWire(job,input,key);
      return job.status==="succeeded" ? this.get(input.requestId,job.id,signal) : result;
    },
    async get(id,jobId,signal) {
      const row=await api.requirementJob(id,jobId,signal);
      const stored=localStorage.getItem(keyFor(jobId));
      const context=stored ? JSON.parse(stored) : undefined;
      let document:RequirementDocument|undefined;
      if(row.status==="succeeded") {
        const docId=row.documentId || row.result?.id;
        document=documentFromWire(row.document || await api.requirementDocument(id,docId,signal),id,context?.input);
      }
      const input=context?.input || document?.inputSnapshot || {unavailable:true,requestId:id,inputRevision:row.basis?.inputRevision || 1,title:"",text:"",html:"",attachmentIds:[],attachmentNames:[]};
      return {...jobFromWire(row,input,context?.key),document};
    },
    async list(id,signal) {
      const result:RequirementDocument[]=[];let cursor:string|undefined;const seen=new Set<string>();
      do {
        const page=await api.requirementDocuments(id,cursor,signal);
        for(const row of page.items)result.push(documentFromWire(row.markdown===undefined ? await api.requirementDocument(id,row.id,signal):row,id));
        cursor=page.nextCursor;if(cursor && seen.has(cursor))throw new Error("문서 페이지 응답이 반복됩니다.");if(cursor)seen.add(cursor);
      }while(cursor);
      return result;
    },
  };
}
export const requirementsService = apiBase ? createHttpRequirementsService(apiBase) : mockRequirementsService;
// File objects stay in memory only. On reload a pending upload must be reselected.
export const pendingFiles = new Map<string, File>();
