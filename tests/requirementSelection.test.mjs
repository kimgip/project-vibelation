import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRequirement,
  appliedDocument,
  basisOf,
  blankRequest,
  editRequest,
  hasAppliedRequirement,
  restoreSelection,
  selectionOf,
  snapshotOf,
} from "../src/domain/types.ts";

const withDocs = () => {
  const r = { ...blankRequest(), title: "요청", text: "자료" };
  const doc = (n) => ({
    id: `doc-${n}`,
    generationId: `g-${n}`,
    generationNumber: n,
    inputRevision: r.inputRevision,
    inputSnapshot: snapshotOf(r),
    markdown: `요구 ${n}`,
    createdAt: r.updatedAt,
    source: "mock",
    formatVersion: "test",
  });
  return { ...r, requirements: [doc(2), doc(1)] };
};

test("undo right after choosing a base restores the exact previous state", () => {
  const before = applyRequirement(withDocs(), "doc-1");
  const analysis = { basis: basisOf(before), id: "a-1", impacts: [], totalDays: 1, durationDays: 1, bufferDays: 0 };
  const withResult = { ...before, analysis };
  const changed = applyRequirement(withResult, "doc-2");
  assert.equal(appliedDocument(changed).id, "doc-2");
  const undone = restoreSelection(changed, selectionOf(withResult), changed.revision);
  assert.equal(appliedDocument(undone).id, "doc-1");
  assert.equal(undone.revision, withResult.revision);
  assert.deepEqual(basisOf(undone), analysis.basis);
});

test("undo with no previous base clears the selection", () => {
  const r = withDocs();
  const applied = applyRequirement(r, "doc-2");
  const undone = restoreSelection(applied, selectionOf(r), applied.revision);
  assert.equal(hasAppliedRequirement(undone), false);
  assert.equal(undone.selectedRequirementDocumentId, undefined);
});

test("undo after other edits moves forward instead of rewinding revision", () => {
  const r = applyRequirement(withDocs(), "doc-1");
  const applied = applyRequirement(r, "doc-2");
  const edited = editRequest(applied, { agreement: "메모" });
  const undone = restoreSelection(edited, selectionOf(r), applied.revision);
  assert.equal(appliedDocument(undone).id, "doc-1");
  assert.ok(undone.revision > edited.revision);
  assert.equal(undone.agreement, "메모");
  assert.deepEqual(undone.requirement.basis, basisOf(undone));
});
