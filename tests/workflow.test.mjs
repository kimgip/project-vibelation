import test from "node:test";
import assert from "node:assert/strict";
import {
  blankRequest,
  basisOf,
  editRequest,
  isCurrent,
  canRegister,
  applyRequirement,
  snapshotOf,
  hasAppliedRequirement,
  mergeGeneration,
  canGenerate,
} from "../src/domain/types.ts";
import {
  repository,
  REQUEST_KEY,
  HISTORY_KEY,
} from "../src/storage/repositories.ts";
import { mockService } from "../src/services/contract.ts";
class Storage {
  data = new Map();
  fail = false;
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    if (this.fail) throw new Error("quota");
    this.data.set(k, v);
  }
  clear() {
    this.data.clear();
    this.fail = false;
  }
}
const storage = new Storage();
globalThis.localStorage = storage;
const prepared = () => {
  const r = blankRequest();
  r.title = "한글 요청";
  r.text = "다운로드";
  r.agreement = "범위 합의";
  r.requirements = [
    {
      id: "doc-1",
      generationId: "g-1",
      generationNumber: 1,
      inputRevision: r.inputRevision,
      inputSnapshot: snapshotOf(r),
      markdown: "요구",
      createdAt: r.updatedAt,
      source: "mock",
      formatVersion: "test",
    },
  ];
  r.selectedRequirementDocumentId = "doc-1";
  const basis = basisOf(r);
  r.requirement = { basis, markdown: "요구" };
  r.analysis = {
    basis,
    impacts: [],
    totalDays: 8.5,
    durationDays: 9,
    bufferDays: 2,
  };
  r.systemMock = { basis };
  r.report = { basis, markdown: "검토" };
  r.scopeReviewed = true;
  r.estimateReviewed = true;
  return r;
};
test("editing invalidates every result and resets both confirmations", () => {
  const r = prepared();
  assert.equal(canRegister(r), true);
  const edited = editRequest(r, { text: "변경" });
  assert.equal(edited.revision, r.revision + 1);
  for (const key of ["requirement", "analysis", "systemMock", "report"])
    assert.equal(isCurrent(edited, edited[key]), false);
  assert.equal(edited.scopeReviewed, false);
  assert.equal(edited.estimateReviewed, false);
  assert.equal(canRegister(edited), false);
  assert.equal(r.report.markdown, "검토");
});
test("registration is idempotent and preserves immutable snapshot", () => {
  storage.clear();
  const r = prepared();
  const a = repository.register(r);
  r.agreement = "나중에 변경";
  assert.equal(repository.register(r).id, a.id);
  assert.equal(repository.history().length, 1);
  assert.equal(repository.history()[0].request.agreement, "범위 합의");
  assert.throws(() => repository.register(editRequest(r, { text: "변경" })));
});
test("corrupt storage is preserved and cannot be silently overwritten", () => {
  storage.clear();
  storage.setItem(HISTORY_KEY, "broken");
  assert.throws(() => repository.register(prepared()));
  assert.equal(storage.getItem(HISTORY_KEY), "broken");
  storage.clear();
  storage.setItem(
    REQUEST_KEY,
    JSON.stringify({ schemaVersion: 2, items: [{ id: "bad" }] }),
  );
  assert.throws(() => repository.saveRequest(prepared()));
  assert.match(storage.getItem(REQUEST_KEY), /bad/);
});
test("quota errors preserve persisted data for a retry", () => {
  storage.clear();
  const r = prepared();
  repository.saveRequest(r);
  const before = storage.getItem(REQUEST_KEY);
  storage.fail = true;
  assert.throws(() => repository.saveRequest(editRequest(r, { text: "new" })));
  assert.equal(storage.getItem(REQUEST_KEY), before);
  storage.fail = false;
});
test("v1 request and report migrate without modifying original values", () => {
  storage.clear();
  const old = {
    id: "old",
    title: "이전 요청",
    description: "요청",
    conversation: "원문",
    html: "",
    version: 3,
    items: [{ decision: "합의" }],
    review: { markdown: "기존 리포트" },
  };
  const raw = JSON.stringify(old);
  storage.setItem("vibelation.request.v1", raw);
  assert.equal(repository.requests()[0].revision, 3);
  repository.saveRequest(repository.requests()[0]);
  assert.equal(storage.getItem("vibelation.request.v1"), raw);
  storage.setItem(
    "vibelation.history.v1",
    JSON.stringify([
      { id: "entry", registeredAt: "2026-10-09T00:00:00Z", request: old },
    ]),
  );
  assert.equal(repository.history()[0].request.report.markdown, "기존 리포트");
});
test("mock contract enforces prerequisites and distinguishes old responses", async () => {
  storage.clear();
  const r = blankRequest();
  await assert.rejects(mockService.analyze(r, new AbortController().signal));
  r.title = "샘플";
  r.text = "요청";
  r.requirements = [
    {
      id: "doc-1",
      generationId: "g-1",
      generationNumber: 1,
      inputRevision: r.inputRevision,
      inputSnapshot: snapshotOf(r),
      markdown: "요구",
      createdAt: r.updatedAt,
      source: "mock",
      formatVersion: "test",
    },
  ];
  r.selectedRequirementDocumentId = "doc-1";
  r.requirement = { basis: basisOf(r), markdown: "요구" };
  const pending = mockService.analyze(r, new AbortController().signal);
  const changed = editRequest(r, { text: "다른 요청" });
  const result = await pending;
  assert.equal(isCurrent(changed, result), false);
  const abort = new AbortController();
  const cancelled = mockService.analyze(r, abort.signal);
  abort.abort();
  await assert.rejects(cancelled, { name: "AbortError" });
});

test("same-input regeneration preserves applied document until explicit application", () => {
  const r = prepared();
  const nextDoc = {
    ...r.requirements[0],
    id: "doc-2",
    generationId: "g-2",
    generationNumber: 2,
  };
  const next = mergeGeneration(r, {
    id: "g-2",
    idempotencyKey: "key-2",
    generationNumber: 2,
    status: "succeeded",
    inputSnapshot: snapshotOf(r),
    document: nextDoc,
    createdAt: r.updatedAt,
  });
  assert.equal(next.inputRevision, r.inputRevision);
  assert.equal(next.selectedRequirementDocumentId, "doc-1");
  assert.equal(canRegister(next), true);
  assert.equal(next.requirements.length, 2);
  const applied = applyRequirement(next, "doc-2");
  assert.equal(hasAppliedRequirement(applied), true);
  assert.equal(isCurrent(applied, applied.analysis), false);
  assert.equal(canRegister(applied), false);
});
test("late generation is retained but cannot become current after editing inputs", () => {
  const r = prepared();
  const changed = editRequest(r, { html: "<h1>new</h1>" });
  const next = mergeGeneration(changed, {
    id: "late",
    idempotencyKey: "key",
    generationNumber: 2,
    status: "succeeded",
    inputSnapshot: snapshotOf(r),
    document: { ...r.requirements[0], id: "late-document" },
    createdAt: r.updatedAt,
  });
  assert.equal(next.requirements.length, 2);
  assert.equal(hasAppliedRequirement(next), false);
  assert.throws(() => applyRequirement(next, "late-document"));
  assert.equal(next.selectedRequirementDocumentId, "doc-1");
});
test("agreement edits preserve applied requirements but invalidate analysis", () => {
  const r = prepared();
  const changed = editRequest(r, { agreement: "수정 협의" });
  assert.equal(changed.inputRevision, r.inputRevision);
  assert.equal(hasAppliedRequirement(changed), true);
  assert.equal(isCurrent(changed, changed.analysis), false);
});
test("attachment-only generation requires successful upload", () => {
  const r = blankRequest();
  r.title = "첨부 요청";
  r.attachments = [
    {
      id: "f",
      name: "brief.txt",
      size: 2,
      type: "text/plain",
      uploadStatus: "pending",
    },
  ];
  assert.equal(canGenerate(r), false);
  r.attachments[0].uploadStatus = "uploaded";
  r.attachments[0].serverFileId = "server-file";
  assert.equal(canGenerate(r), true);
  assert.deepEqual(snapshotOf(r).attachmentIds, ["server-file"]);
});
test("v2 migration preserves local drafts and keeps v2 keys intact", () => {
  storage.clear();
  const r = prepared();
  delete r.requirements;
  delete r.generations;
  delete r.inputRevision;
  delete r.selectedRequirementDocumentId;
  const raw = JSON.stringify({ schemaVersion: 2, items: [r] });
  storage.setItem("vibelation.requests.v2", raw);
  const migrated = repository.requests()[0];
  assert.equal(migrated.requirements[0].source, "legacy");
  assert.equal(migrated.selectedRequirementDocumentId, undefined);
  repository.saveRequest(migrated);
  assert.equal(storage.getItem("vibelation.requests.v2"), raw);
});
