import test from "node:test";
import assert from "node:assert/strict";
import {
  mockRequirementsService,
  createHttpRequirementsService,
  validateFiles,
} from "../src/services/requirements.ts";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, v),
};
const input = {
  requestId: "req",
  inputRevision: 1,
  title: "파일 요청",
  text: "원문",
  html: "<h1>HTML</h1>",
  attachmentIds: ["file-1"],
  attachmentNames: ["brief.txt"],
};
test("generation idempotency, repeat generation and reload recovery", async () => {
  values.clear();
  const signal = new AbortController().signal;
  const first = await mockRequirementsService.start(input, "key-1", signal);
  assert.equal(
    (await mockRequirementsService.start(input, "key-1", signal)).id,
    first.id,
  );
  const second = await mockRequirementsService.start(input, "key-2", signal);
  assert.notEqual(first.id, second.id);
  await new Promise((r) => setTimeout(r, 920));
  const a = await mockRequirementsService.get("req", first.id, signal);
  assert.equal(a.status, "succeeded");
  assert.match(a.document.markdown, /brief.txt/);
  assert.match(a.document.markdown, /<h1>HTML<\/h1>/);
  assert.equal(
    (await mockRequirementsService.get("req", first.id, signal)).document.id,
    a.document.id,
  );
  assert.equal((await mockRequirementsService.list("req", signal)).length, 2);
  await assert.rejects(mockRequirementsService.get("other", first.id, signal));
});
test("upload accepts File bytes and HTTP sends multipart file rather than metadata", async () => {
  const file = new File(["actual content"], "brief.txt", {
    type: "text/plain",
  });
  validateFiles([file], 0);
  const signal = new AbortController().signal;
  assert.equal(
    (await mockRequirementsService.upload("req", file, signal)).size,
    14,
  );
  const original = globalThis.fetch;
  let received;
  globalThis.fetch = async (url, options) => {
    received = { url, options };
    return new Response(
      JSON.stringify({
        serverFileId: "file-1",
        name: file.name,
        size: file.size,
        type: file.type,
      }),
      { status: 200 },
    );
  };
  try {
    await createHttpRequirementsService("https://backend.example").upload(
      "req",
      file,
      signal,
    );
    assert.equal(received.options.body.get("file").name, "brief.txt");
    assert.equal(
      await received.options.body.get("file").text(),
      "actual content",
    );
    assert.equal(received.options.headers, undefined);
  } finally {
    globalThis.fetch = original;
  }
  assert.throws(() => validateFiles([new File(["a"], "bad.exe")], 0));
});
test("HTTP generation sends full current input with an idempotency key and hydrates result IDs", async () => {
  const original = globalThis.fetch,
    calls = [];
  const signal = new AbortController().signal;
  const job = {
    id: "job-1",
    idempotencyKey: "same-key",
    generationNumber: 1,
    status: "succeeded",
    inputSnapshot: input,
    createdAt: "2026-10-17T00:00:00Z",
    documentId: "doc-1",
  };
  const doc = {
    id: "doc-1",
    generationId: "job-1",
    generationNumber: 1,
    inputRevision: 1,
    inputSnapshot: input,
    markdown: "# 요구사항",
    createdAt: job.createdAt,
    source: "server",
    formatVersion: "v1",
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/selected-requirement"))
      return new Response(null, { status: 204 });
    return new Response(
      JSON.stringify(url.endsWith("/requirement-documents/doc-1") ? doc : job),
      { status: 200 },
    );
  };
  try {
    const api = createHttpRequirementsService("https://backend.example");
    await api.start(input, "same-key", signal);
    assert.deepEqual(JSON.parse(calls[0].init.body), input);
    assert.equal(calls[0].init.headers["Idempotency-Key"], "same-key");
    assert.equal((await api.get("req", "job-1", signal)).document.id, "doc-1");
    await api.select("req", "doc-1", 1, signal);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
      documentId: "doc-1",
      expectedInputRevision: 1,
    });
  } finally {
    globalThis.fetch = original;
  }
});
