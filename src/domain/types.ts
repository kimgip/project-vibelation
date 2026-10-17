export type ResourceType = "UI" | "Logic" | "API" | "DB" | "Permission";
export interface Basis {
  requestId: string;
  revision: number;
  legacyVersion: string;
  requirementDocumentId?: string;
  confirmationId?: string;
}
export interface Artifact {
  id?: string;
  analysisId?: string;
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
  id?: string;
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
  mocks: MockArtifact[];
  mockJobs: MockJob[];
  selectedMockId?: string;
  reviewedMockIds: string[];
  confirmations: RequirementConfirmation[];
  activeConfirmationId?: string;
  acceptanceCriteria: string;
  exclusions: string;
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
  confirmationId: r.activeConfirmationId,
});
export const sameBasis = (a?: Basis, b?: Basis) =>
  !!a &&
  !!b &&
  a.requestId === b.requestId &&
  a.legacyVersion === b.legacyVersion &&
  a.requirementDocumentId === b.requirementDocumentId &&
  (a.confirmationId || b.confirmationId
    ? a.confirmationId === b.confirmationId
    : a.revision === b.revision);
export const isCurrent = (
  r: WorkRequest,
  a?: { basis: Basis; analysisId?: string },
) =>
  sameBasis(basisOf(r), a?.basis) &&
  (!a?.basis.confirmationId || hasConfirmedRequirement(r)) &&
  (!a?.analysisId || a.analysisId === r.analysis?.id);
export const appliedDocument = (r: WorkRequest) =>
  r.requirements.find((d) => d.id === r.selectedRequirementDocumentId);
export const hasAppliedRequirement = (r: WorkRequest) =>
  !!appliedDocument(r) &&
  appliedDocument(r)!.inputSnapshot.requestId === r.id &&
  appliedDocument(r)!.inputRevision === r.inputRevision &&
  uploadsReady(r);
export const uploadsReady = (r: WorkRequest) =>
  r.attachments.every((a) => a.uploadStatus === "uploaded" && !!a.serverFileId);
export const canGenerate = (r: WorkRequest) =>
  !!r.title.trim() &&
  !!(r.text.trim() || r.html.trim() || r.attachments.length) &&
  uploadsReady(r);
export const readyForReview = (r: WorkRequest) =>
  hasConfirmedRequirement(r) && isCurrent(r, r.analysis);
export const canRegister = (r: WorkRequest) =>
  readyForReview(r) &&
  isCurrent(r, r.report) &&
  r.scopeReviewed &&
  r.estimateReviewed &&
  !!r.analysis?.id &&
  !!r.report?.id &&
  r.report.analysisId === r.analysis.id;
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
    mocks: [],
    mockJobs: [],
    reviewedMockIds: [],
    confirmations: [],
    acceptanceCriteria: "",
    exclusions: "",
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
  if (
    draftFingerprint(next) === draftFingerprint(r) &&
    next.legacyVersion === r.legacyVersion
  ) {
    next.scopeReviewed = r.scopeReviewed;
    next.estimateReviewed = r.estimateReviewed;
  }
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
    selectedMockId: undefined,
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
  return hasConfirmedRequirement(r)
    ? isCurrent(r, r.report)
      ? "최종 검토"
      : isCurrent(r, r.analysis)
        ? "분석 완료"
        : "요구사항 확정"
    : r.activeConfirmationId
      ? "변경 후 재확정 필요"
      : hasAppliedRequirement(r)
        ? "요구사항 협의"
        : r.requirements.length
          ? "문서 생성"
          : "작성 중";
}
export interface MockArtifact {
  id: string;
  requirementDocumentId: string;
  legacyVersion: string;
  generationNumber: number;
  createdAt: string;
  source: "mock";
  renderer: "download-center-demo";
  behaviors: string[];
  assumptions: string[];
  unconnectedFeatures: string[];
}
export interface MockJob {
  id: string;
  idempotencyKey: string;
  requirementDocumentId: string;
  legacyVersion: string;
  generationNumber: number;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  artifact?: MockArtifact;
  error?: string;
}
export interface RequirementConfirmation {
  id: string;
  version: number;
  requestId: string;
  inputRevision: number;
  confirmedAt: string;
  draftFingerprint: string;
  documentSnapshot: RequirementDocument;
  mockSnapshot: MockArtifact | null;
  mockReviewed: boolean | null;
  agreementSnapshot: {
    scope: string;
    acceptanceCriteria: string;
    exclusions: string;
    unresolvedItems: string;
  };
}
export const activeConfirmation = (r: WorkRequest) =>
  r.confirmations.find((c) => c.id === r.activeConfirmationId);
export const selectedMock = (r: WorkRequest) =>
  r.mocks.find((m) => m.id === r.selectedMockId);
export const validSelectedMock = (r: WorkRequest) => {
  const m = selectedMock(r);
  return (
    !!m &&
    m.requirementDocumentId === r.selectedRequirementDocumentId &&
    m.legacyVersion === r.legacyVersion
  );
};
export const draftFingerprint = (r: WorkRequest) =>
  JSON.stringify([r.inputRevision, r.selectedRequirementDocumentId]);
export const hasConfirmedRequirement = (r: WorkRequest) => {
  const c = activeConfirmation(r);
  return (
    !!c &&
    c.requestId === r.id &&
    c.draftFingerprint === draftFingerprint(r) &&
    c.inputRevision === r.inputRevision &&
    uploadsReady(r)
  );
};
export const canConfirmRequirement = (r: WorkRequest) =>
  hasAppliedRequirement(r);
export function confirmRequirement(r: WorkRequest): WorkRequest {
  if (!canConfirmRequirement(r))
    throw new Error("현재 입력 기준 요구사항 MD를 선택해주세요.");
  if (hasConfirmedRequirement(r)) return r;
  const c: RequirementConfirmation = {
    id: crypto.randomUUID(),
    version: Math.max(0, ...r.confirmations.map((c) => c.version)) + 1,
    requestId: r.id,
    inputRevision: r.inputRevision,
    confirmedAt: new Date().toISOString(),
    draftFingerprint: draftFingerprint(r),
    documentSnapshot: structuredClone(appliedDocument(r)!),
    mockSnapshot: null,
    mockReviewed: null,
    agreementSnapshot: {
      scope: "",
      acceptanceCriteria: "",
      exclusions: "",
      unresolvedItems: "",
    },
  };
  return {
    ...r,
    confirmations: [c, ...r.confirmations],
    activeConfirmationId: c.id,
    revision: r.revision + 1,
    scopeReviewed: false,
    estimateReviewed: false,
  };
}
export function mergeMockJob(r: WorkRequest, job: MockJob): WorkRequest {
  return {
    ...r,
    mockJobs: [job, ...r.mockJobs.filter((j) => j.id !== job.id)],
    mocks: job.artifact
      ? [job.artifact, ...r.mocks.filter((m) => m.id !== job.artifact!.id)]
      : r.mocks,
  };
}
