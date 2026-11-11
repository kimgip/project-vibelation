import historyFixture from "../src/mocks/history.json" with {type:"json"};
import test from "node:test";
import assert from "node:assert/strict";
import { createMockHistoryService } from "../src/services/history.ts";

test("history list/detail load JSON fixtures and preserve isolated snapshots", async () => {
  const service = createMockHistoryService([]), signal = new AbortController().signal;
  const page = await service.list(signal);
  assert.equal(page.items.length, historyFixture.items.length);
  assert.equal(page.nextCursor, null);
  const item = await service.get(page.items[0].id, signal);
  assert.deepEqual(item, page.items[0]);
  item.request.title = "mutated";
  assert.notEqual((await service.get(item.id, signal)).request.title, "mutated");
  assert.equal(await service.get("missing", signal), undefined);
});
test("history keeps local registrations and prefers local duplicate IDs", async () => {
  const signal = new AbortController().signal;
  const page = await createMockHistoryService([]).list(signal);
  const local = structuredClone(page.items[0]); local.request.title = "local copy";
  const extra = {...structuredClone(local), id: "local-only"};
  const service = createMockHistoryService([local, extra]);
  assert.equal((await service.list(signal)).items.length, page.items.length + 1);
  assert.equal((await service.get(local.id, signal)).request.title, "local copy");
  assert.equal((await service.get(extra.id, signal)).id, "local-only");
});
test("history queries support abort before and during loading", async () => {
  const service = createMockHistoryService([]), controller = new AbortController();
  const pending = service.list(controller.signal); controller.abort();
  await assert.rejects(pending, {name: "AbortError"});
  await assert.rejects(service.get("missing", controller.signal), {name: "AbortError"});
});

test("server registrations use frozen source snapshots and reject mismatched lineage", async () => {
  const { registrationFromServer } = await import("../src/services/history.ts");
  const snapshot = { requestId: "r", inputRevision: 1, title: "당시 제목", text: "당시 입력", html: "", attachmentIds: [], attachmentNames: [] };
  const row = { id: "reg", requestId: "r", title: "당시 제목", registeredAt: "2026-10-20T00:00:00Z", reviewSummarySnapshot: "당시 요약",
    confirmationSnapshot: { id: "c", version: 1, requestId: "r", inputRevision: 1, documentSnapshot: { id: "md", generationNumber: 1, markdown: "# 당시 MD", inputSnapshot: snapshot } },
    analysisSnapshot: { id: "a", confirmationId: "c", legacyVersion: "fixed", impacts: [] }, reportSnapshot: { id: "p", confirmationId: "c", analysisResultId: "a", markdown: "# 리포트" } };
  const result = registrationFromServer(row);
  assert.equal(result.request.confirmations[0].documentSnapshot.inputSnapshot.text, "당시 입력");
  assert.equal(result.reviewSummarySnapshot, "당시 요약");
  assert.equal(result.request.scopeReviewed, false, "does not invent a review approval");
  assert.throws(() => registrationFromServer({ ...row, analysisSnapshot: { ...row.analysisSnapshot, confirmationId: "other" } }), /기준/);
});
