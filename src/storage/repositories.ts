import { reviewSummary } from "../domain/reviewSummary";
import { cases } from "../mocks/download-center";
import {
  blankRequest,
  canRegister,
  type Registration,
  type WorkRequest,
} from "../domain/types";
export const REQUEST_KEY = "vibelation.requests.v4",
  HISTORY_KEY = "vibelation.history.v4";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function validRequest(v: unknown): v is WorkRequest {
  if (!object(v)) return false;
  const strings = [
    "id",
    "title",
    "text",
    "html",
    "dueDate",
    "legacyVersion",
    "agreement",
    "opinion",
    "updatedAt",
  ];
  if (
    !strings.every((k) => typeof v[k] === "string") ||
    !Number.isInteger(v.revision) ||
    Number(v.revision) < 1 ||
    typeof v.scopeReviewed !== "boolean" ||
    typeof v.estimateReviewed !== "boolean" ||
    !Array.isArray(v.attachments)
  )
    return false;
  if (
    !v.attachments.every(
      (a) =>
        object(a) &&
        typeof a.name === "string" &&
        typeof a.size === "number" &&
        typeof a.type === "string",
    )
  )
    return false;
  const snapshotValid = (s: unknown) =>
    object(s) &&
    typeof s.requestId === "string" &&
    Number.isInteger(s.inputRevision) &&
    ["title", "text", "html"].every((k) => typeof s[k] === "string") &&
    Array.isArray(s.attachmentIds) &&
    s.attachmentIds.every((x) => typeof x === "string") &&
    Array.isArray(s.attachmentNames) &&
    s.attachmentNames.every((x) => typeof x === "string");
  const documentValid = (d: unknown) =>
    object(d) &&
    ["id", "generationId", "markdown", "createdAt", "formatVersion"].every(
      (k) => typeof d[k] === "string",
    ) &&
    Number.isInteger(d.generationNumber) &&
    Number.isInteger(d.inputRevision) &&
    ["mock", "server", "legacy"].includes(String(d.source)) &&
    snapshotValid(d.inputSnapshot);
  if (
    v.inputRevision !== undefined &&
    (!Number.isInteger(v.inputRevision) || Number(v.inputRevision) < 1)
  )
    return false;
  if (
    v.requirements !== undefined &&
    (!Array.isArray(v.requirements) || !v.requirements.every(documentValid))
  )
    return false;
  if (
    v.generations !== undefined &&
    (!Array.isArray(v.generations) ||
      !v.generations.every(
        (g) =>
          object(g) &&
          typeof g.id === "string" &&
          typeof g.idempotencyKey === "string" &&
          Number.isInteger(g.generationNumber) &&
          ["queued", "running", "succeeded", "failed"].includes(
            String(g.status),
          ) &&
          snapshotValid(g.inputSnapshot) &&
          (g.document === undefined || documentValid(g.document)),
      ))
  )
    return false;
  if (v.requirementAppliedAtInputRevision !== undefined &&
    (!Number.isInteger(v.requirementAppliedAtInputRevision) || Number(v.requirementAppliedAtInputRevision) < 1)) return false;
  if (
    v.selectedRequirementDocumentId !== undefined &&
    typeof v.selectedRequirementDocumentId !== "string"
  )
    return false;
  const mockValid = (m: unknown) =>
    object(m) &&
    ["id", "requirementDocumentId", "legacyVersion", "createdAt"].every(
      (k) => typeof m[k] === "string",
    ) &&
    Number.isInteger(m.generationNumber) &&
    ((m.source === "mock" && m.renderer === "download-center-demo") ||
      (m.source === "server" && m.renderer === "server-html" && typeof m.html === "string" && m.html.length <= 2000000)) &&
    ["behaviors", "assumptions", "unconnectedFeatures"].every(
      (k) =>
        Array.isArray(m[k]) &&
        (m[k] as unknown[]).every((x) => typeof x === "string"),
    );
  if (
    v.mocks !== undefined &&
    (!Array.isArray(v.mocks) || !v.mocks.every(mockValid))
  )
    return false;
  if (
    v.mockJobs !== undefined &&
    (!Array.isArray(v.mockJobs) ||
      !v.mockJobs.every(
        (j) =>
          object(j) &&
          [
            "id",
            "idempotencyKey",
            "requirementDocumentId",
            "legacyVersion",
            "createdAt",
          ].every((k) => typeof j[k] === "string") &&
          Number.isInteger(j.generationNumber) &&
          ["queued", "running", "succeeded", "failed"].includes(
            String(j.status),
          ) &&
          (j.artifact === undefined || mockValid(j.artifact)),
      ))
  )
    return false;
  if (
    v.reviewedMockIds !== undefined &&
    (!Array.isArray(v.reviewedMockIds) ||
      !v.reviewedMockIds.every((id) => typeof id === "string"))
  )
    return false;
  for (const key of [
    "acceptanceCriteria",
    "exclusions",
    "selectedMockId",
    "activeConfirmationId",
  ])
    if (v[key] !== undefined && typeof v[key] !== "string") return false;
  if (
    v.confirmations !== undefined &&
    (!Array.isArray(v.confirmations) ||
      !v.confirmations.every(
        (c) =>
          object(c) &&
          ["id", "requestId", "confirmedAt", "draftFingerprint"].every(
            (k) => typeof c[k] === "string",
          ) &&
          Number.isInteger(c.version) &&
          Number.isInteger(c.inputRevision) &&
          documentValid(c.documentSnapshot) &&
          (c.mockSnapshot === null || mockValid(c.mockSnapshot)) &&
          (c.mockReviewed === null || typeof c.mockReviewed === "boolean") &&
          object(c.agreementSnapshot) &&
          [
            "scope",
            "acceptanceCriteria",
            "exclusions",
            "unresolvedItems",
          ].every(
            (k) =>
              typeof (c.agreementSnapshot as Record<string, unknown>)[k] ===
              "string",
          ),
      ))
  )
    return false;
  for (const key of ["requirement", "analysis", "systemMock", "report"]) {
    const a = v[key];
    if (a === undefined) continue;
    if (
      !object(a) ||
      !object(a.basis) ||
      typeof a.basis.requestId !== "string" ||
      !Number.isInteger(a.basis.revision) ||
      typeof a.basis.legacyVersion !== "string"
    )
      return false;
    if (
      (key === "requirement" || key === "report") &&
      typeof a.markdown !== "string"
    )
      return false;
    if (
      key === "analysis" &&
      (!Array.isArray(a.impacts) ||
        !a.impacts.every(
          (i) =>
            object(i) &&
            [
              "id",
              "name",
              "type",
              "path",
              "current",
              "proposed",
              "reason",
            ].every((k) => typeof i[k] === "string") &&
            (i.days === undefined || typeof i.days === "number"),
        ) ||
        !["totalDays", "durationDays", "bufferDays"].every(
          (k) => (a[k] === undefined || typeof a[k] === "number"),
        ))
    )
      return false;
  }
  return Number.isFinite(Date.parse(String(v.updatedAt)));
}
function read<T>(
  key: string,
  validate: (v: unknown) => v is T,
): T[] | undefined {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "저장 자료가 손상되었습니다. 기존 자료는 보존했습니다. 복구용 내보내기를 이용해주세요.",
    );
  }
  if (
    !object(data) ||
    ![2, 3, 4].includes(Number(data.schemaVersion)) ||
    !Array.isArray(data.items) ||
    !data.items.every(validate)
  )
    throw new Error(
      "저장 자료 형식을 확인할 수 없습니다. 기존 자료를 보존했습니다.",
    );
  return data.items;
}
function migrate(v: unknown): WorkRequest {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    typeof v.title !== "string" ||
    typeof v.description !== "string" ||
    typeof v.version !== "number" ||
    !Array.isArray(v.items)
  )
    throw new Error(
      "이전 자료 형식을 확인할 수 없습니다. 원본을 보존했습니다.",
    );
  return {
    ...blankRequest(),
    createdAt: undefined,
    id: v.id,
    title: v.title,
    text: String(v.conversation || v.description),
    html: String(v.html || ""),
    dueDate: String(v.dueDate || ""),
    revision: Math.max(1, v.version),
    agreement: v.items
      .map((i) => (object(i) ? String(i.decision || "") : ""))
      .join("\n"),
  };
}
export const validRegistration = (v: unknown): v is Registration =>
  object(v) &&
  typeof v.id === "string" &&
  typeof v.key === "string" &&
  typeof v.registeredAt === "string" &&
  Number.isFinite(Date.parse(v.registeredAt)) &&
  validRequest(v.request);
function normalize(r: WorkRequest): WorkRequest {
  const next = {
    ...r,
    inputRevision: r.inputRevision || r.revision,
    requirements: r.requirements || [],
    mocks: r.mocks || [],
    mockJobs: r.mockJobs || [],
    reviewedMockIds: r.reviewedMockIds || [],
    confirmations: r.confirmations || [],
    acceptanceCriteria: r.acceptanceCriteria || "",
    exclusions: r.exclusions || "",
    generations: r.generations || [],
    attachments: r.attachments.map((a) => ({
      ...a,
      id: a.id || crypto.randomUUID(),
      uploadStatus:
        a.uploadStatus === "uploaded"
          ? ("uploaded" as const)
          : ("needsReselect" as const),
    })),
  };
  if (!r.requirements && r.requirement) {
    const id = `legacy:${r.id}:${r.requirement.basis.revision}`;
    next.requirements = [
      {
        id,
        generationId: id,
        generationNumber: 1,
        inputRevision: r.requirement.basis.revision,
        inputSnapshot: {
          requestId: r.id,
          inputRevision: r.requirement.basis.revision,
          title: r.title,
          text: r.text,
          html: r.html,
          attachmentIds: [],
          attachmentNames: r.attachments.map((a) => a.name),
        },
        markdown: r.requirement.markdown,
        createdAt: r.updatedAt,
        source: "legacy",
        formatVersion: "legacy-local",
      },
    ];
  }
  return next;
}
export const repository = {
  requests(): WorkRequest[] {
    const current =
      read(REQUEST_KEY, validRequest) ??
      read("vibelation.requests.v3", validRequest) ??
      read("vibelation.requests.v2", validRequest);
    if (current) return current.map(normalize);
    const old = localStorage.getItem("vibelation.request.v1");
    if (!old) return [];
    let v: unknown;
    try {
      v = JSON.parse(old);
    } catch {
      throw new Error("이전 요청 자료가 손상되었습니다. 원본을 보존했습니다.");
    }
    return v === null ? [] : [migrate(v)];
  },
  saveRequest(r: WorkRequest) {
    const items = this.requests();
    const next = [r, ...items.filter((x) => x.id !== r.id)];
    localStorage.setItem(
      REQUEST_KEY,
      JSON.stringify({ schemaVersion: 4, items: next }),
    );
  },
  history(): Registration[] {
    const current =
      read(HISTORY_KEY, validRegistration) ??
      read("vibelation.history.v3", validRegistration) ??
      read("vibelation.history.v2", validRegistration);
    if (current)
      return current.map((entry) => ({
        ...entry,
        request: normalize(entry.request),
      }));
    const old = localStorage.getItem("vibelation.history.v1");
    if (!old) return [];
    let items: unknown;
    try {
      items = JSON.parse(old);
    } catch {
      throw new Error("이전 이력이 손상되었습니다. 원본을 보존했습니다.");
    }
    if (!Array.isArray(items))
      throw new Error("이전 이력 형식이 올바르지 않습니다.");
    return items.map((x) => {
      if (
        !object(x) ||
        typeof x.id !== "string" ||
        typeof x.registeredAt !== "string"
      )
        throw new Error("이전 이력 형식이 올바르지 않습니다.");
      const request = migrate(x.request);
      if (
        object(x.request) &&
        object(x.request.review) &&
        typeof x.request.review.markdown === "string"
      )
        request.report = {
          basis: {
            requestId: request.id,
            revision: request.revision,
            legacyVersion: request.legacyVersion,
          },
          markdown: x.request.review.markdown,
        };
      return {
        id: x.id,
        key: `legacy:${x.id}`,
        registeredAt: x.registeredAt,
        request,
      };
    });
  },
  register(r: WorkRequest, serverId?: string): Registration {
    if (!canRegister(r))
      throw new Error("현재 확정과 일치하는 분석·리포트가 필요합니다.");
    const items = this.history();
    const key = `${r.id}:${r.activeConfirmationId}:${r.legacyVersion}:${r.analysis!.id}:${r.report!.id}`;
    const existing = items.find((x) => x.key === key);
    if (existing) return existing;
    const result = {
      id: serverId || crypto.randomUUID(),
      key,
      registeredAt: new Date().toISOString(),
      request: structuredClone(r),
      reviewSummarySnapshot: reviewSummary(r),
      similarCasesSnapshot: structuredClone(r.analysis?.source === "server" ? r.analysis.similarCases || [] : cases),
    };
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({ schemaVersion: 4, items: [result, ...items] }),
    );
    return result;
  },
};
