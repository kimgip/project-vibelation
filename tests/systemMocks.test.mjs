import test from "node:test";
import assert from "node:assert/strict";
import { systemMockService } from "../src/services/systemMocks.ts";
const data = new Map();
globalThis.localStorage = {
  getItem: (k) => data.get(k) || null,
  setItem: (k, v) => data.set(k, v),
};
test("optional Mock generation is idempotent, recoverable, and uses a trusted fixture", async () => {
  const doc = { id: "md-1" };
  const job = await systemMockService.start(doc, "commit-1", "key-1");
  assert.equal(
    (await systemMockService.start(doc, "commit-1", "key-1")).id,
    job.id,
  );
  await new Promise((r) => setTimeout(r, 920));
  const result = await systemMockService.get(job.id);
  assert.equal(result.status, "succeeded");
  assert.equal(result.artifact.requirementDocumentId, doc.id);
  assert.equal(result.artifact.renderer, "download-center-demo");
  assert.equal(result.artifact.source, "mock");
  assert.equal(
    (await systemMockService.get(job.id)).artifact.id,
    result.artifact.id,
  );
});
