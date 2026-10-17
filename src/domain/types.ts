export type ResourceType = "UI" | "Logic" | "API" | "DB" | "Permission";
export interface Basis {
  requestId: string;
  revision: number;
  legacyVersion: string;
  requirementDocumentId?: string;
}
export interface Artifact {
  basis: Basis;
  markdown: string;
}
export interface Impact {
  id: string;
  name: string;
  type: ResourceType;
  path: string;
  current: string;
  proposed: string;
  reason: string;
  days: number;
}
export interface Analysis {
  basis: Basis;
  impacts: Impact[];
  totalDays: number;
  durationDays: number;
  bufferDays: number;
}
export interface Attachment {
  id?: string;
  name: string;
  size: number;
  type: string;
  uploadStatus?:
    "pending" | "uploading" | "uploaded" | "failed" | "needsReselect";
  serverFileId?: string;
  error?: string;
}
export interface InputSnapshot {
  requestId: string;
  inputRevision: number;
  title: string;
  text: string;
  html: string;
  attachmentIds: string[];
  attachmentNames: string[];
}
export interface RequirementDocument {
  id: string;
  generationId: string;
  generationNumber: number;
  inputRevision: number;
  inputSnapshot: InputSnapshot;
  markdown: string;
  createdAt: string;
  source: "mock" | "server" | "legacy";
  formatVersion: string;
}
export interface RequirementGeneration {
  id: string;
  idempotencyKey: string;
  generationNumber: number;
  status: "queued" | "running" | "succeeded" | "failed";
  inputSnapshot: InputSnapshot;
  document?: RequirementDocument;
  error?: string;
  createdAt: string;
}
export interface WorkRequest {
  id: string;
  title: string;
  text: string;
  html: string;
  dueDate: string;
  revision: number;
  inputRevision: number;
  legacyVersion: string;
  agreement: string;
  opinion: string;
  attachments: Attachment[];
  updatedAt: string;
  requirements: RequirementDocument[];
  generations: RequirementGeneration[];
  selectedRequirementDocumentId?: string;
  requirement?: Artifact;
  analysis?: Analysis;
  systemMock?: { basis: Basis };
  report?: Artifact;
  scopeReviewed: boolean;
  estimateReviewed: boolean;
}
export interface Registration {
  id: string;
  key: string;
  registeredAt: string;
  request: WorkRequest;
}
export const basisOf = (r: WorkRequest): Basis => ({
  requestId: r.id,
  revision: r.revision,
  legacyVersion: r.legacyVersion,
  requirementDocumentId: r.selectedRequirementDocumentId,
});
export const sameBasis = (a?: Basis, b?: Basis) =>
  !!a &&
  !!b &&
  a.requestId === b.requestId &&
  a.revision === b.revision &&
  a.legacyVersion === b.legacyVersion &&
  a.requirementDocumentId === b.requirementDocumentId;
export const isCurrent = (r: WorkRequest, a?: { basis: Basis }) =>
  sameBasis(basisOf(r), a?.basis);
export const appliedDocument = (r: WorkRequest) =>
  r.requirements.find((d) => d.id === r.selectedRequirementDocumentId);
export const hasAppliedRequirement = (r: WorkRequest) =>
  !!appliedDocument(r) &&
  appliedDocument(r)!.inputRevision === r.inputRevision &&
  isCurrent(r, r.requirement) &&
  uploadsReady(r);
export const uploadsReady = (r: WorkRequest) =>
  r.attachments.every((a) => a.uploadStatus === "uploaded" && !!a.serverFileId);
export const canGenerate = (r: WorkRequest) =>
  !!r.title.trim() &&
  !!(r.text.trim() || r.html.trim() || r.attachments.length) &&
  uploadsReady(r);
export const readyForReview = (r: WorkRequest) =>
  hasAppliedRequirement(r) &&
  isCurrent(r, r.analysis) &&
  isCurrent(r, r.systemMock) &&
  !!r.agreement.trim();
export const canRegister = (r: WorkRequest) =>
  readyForReview(r) &&
  isCurrent(r, r.report) &&
  r.scopeReviewed &&
  r.estimateReviewed;
export function blankRequest(): WorkRequest {
  return {
    id: crypto.randomUUID(),
    title: "",
    text: "",
    html: "",
    dueDate: "",
    revision: 1,
    inputRevision: 1,
    legacyVersion: "DEMO-2026.10",
    agreement: "",
    opinion: "",
    attachments: [],
    requirements: [],
    generations: [],
    updatedAt: new Date().toISOString(),
    scopeReviewed: false,
    estimateReviewed: false,
  };
}
export function editRequest(
  r: WorkRequest,
  patch: Partial<WorkRequest>,
): WorkRequest {
  const inputChanged = ["title", "text", "html", "attachments", "dueDate"].some(
    (k) => k in patch,
  );
  const next = {
    ...r,
    ...patch,
    revision: r.revision + 1,
    inputRevision: r.inputRevision + (inputChanged ? 1 : 0),
    updatedAt: new Date().toISOString(),
    scopeReviewed: false,
    estimateReviewed: false,
  };
  if (!inputChanged && r.requirement && hasAppliedRequirement(r))
    next.requirement = { ...r.requirement, basis: basisOf(next) };
  return next;
}
export function applyRequirement(r: WorkRequest, id: string): WorkRequest {
  const doc = r.requirements.find((d) => d.id === id);
  if (
    !doc ||
    doc.inputSnapshot.requestId !== r.id ||
    doc.inputRevision !== r.inputRevision ||
    !uploadsReady(r)
  )
    throw new Error("현재 입력 기준의 문서를 생성한 후 적용해주세요.");
  if (r.selectedRequirementDocumentId === id && hasAppliedRequirement(r))
    return r;
  const next = {
    ...r,
    selectedRequirementDocumentId: id,
    revision: r.revision + 1,
    scopeReviewed: false,
    estimateReviewed: false,
  };
  next.requirement = { basis: basisOf(next), markdown: doc.markdown };
  return next;
}
export function snapshotOf(r: WorkRequest): InputSnapshot {
  return {
    requestId: r.id,
    inputRevision: r.inputRevision,
    title: r.title,
    text: r.text,
    html: r.html,
    attachmentIds: r.attachments.map((a) => a.serverFileId!),
    attachmentNames: r.attachments.map((a) => a.name),
  };
}
export function mergeGeneration(
  r: WorkRequest,
  g: RequirementGeneration,
): WorkRequest {
  if (g.inputSnapshot.requestId !== r.id)
    throw new Error("다른 요청의 생성 결과입니다.");
  return {
    ...r,
    generations: [g, ...r.generations.filter((x) => x.id !== g.id)],
    requirements: g.document
      ? [g.document, ...r.requirements.filter((d) => d.id !== g.document!.id)]
      : r.requirements,
  };
}
export function statusOf(r: WorkRequest) {
  return isCurrent(r, r.report)
    ? "최종 검토"
    : isCurrent(r, r.systemMock)
      ? "협의 진행 중"
      : isCurrent(r, r.analysis)
        ? "분석 완료"
        : hasAppliedRequirement(r)
          ? "요구사항 적용"
          : r.requirements.length
            ? "요구사항 생성"
            : "작성 중";
}
