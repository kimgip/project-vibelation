import test from "node:test";
import assert from "node:assert/strict";
import { createMockHistoryService } from "../src/services/history.ts";

test("history list/detail load JSON fixtures and preserve isolated snapshots", async () => {
  const service = createMockHistoryService([]), signal = new AbortController().signal;
  const page = await service.list(signal);
  assert.equal(page.items.length, 2);
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
  assert.equal((await service.list(signal)).items.length, 3);
  assert.equal((await service.get(local.id, signal)).request.title, "local copy");
  assert.equal((await service.get(extra.id, signal)).id, "local-only");
});
test("history queries support abort before and during loading", async () => {
  const service = createMockHistoryService([]), controller = new AbortController();
  const pending = service.list(controller.signal); controller.abort();
  await assert.rejects(pending, {name: "AbortError"});
  await assert.rejects(service.get("missing", controller.signal), {name: "AbortError"});
});
