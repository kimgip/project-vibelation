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
  assert.match(a.document.markdown, /^# 파일 요청_version1/);
  assert.doesNotMatch(a.document.markdown, /brief.txt|<h1>HTML<\/h1>|## 대화·텍스트 원문|## HTML 원문/);
  assert.equal(a.document.inputSnapshot.html, input.html);
  assert.deepEqual(a.document.contextDocumentIds, []);
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
test("HTTP generation saves a snapshot, starts by ID, and selects with current server revisions", async () => {
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
    if (url.endsWith("/requests/req")) return new Response(JSON.stringify({ requestRevision: 10, inputRevision: 3, inputSnapshotId: "snapshot-3" }), { status: 200 });
    return new Response(
      JSON.stringify(url.endsWith("/requirement-documents/doc-1") ? doc : job),
      { status: 200 },
    );
  };
  try {
    const api = createHttpRequirementsService("https://backend.example");
    await api.start(input, "same-key", signal);
    assert.equal(calls[0].init.method, undefined);
    assert.equal(calls[1].init.method, "PATCH");
    assert.deepEqual(JSON.parse(calls[1].init.body).input.attachmentIds, input.attachmentIds);
    assert.deepEqual(JSON.parse(calls[2].init.body), { inputSnapshotId: "snapshot-3", expectedInputRevision: 3 });
    assert.equal(calls[2].init.headers["Idempotency-Key"], "same-key");
    await api.start(input, "same-key", signal);
    assert.equal(calls.filter(c => c.init.method === "PATCH").length, 1, "retry does not recapture a newer draft");
    assert.equal((await api.get("req", "job-1", signal)).document.id, "doc-1");
    await api.select("req", "doc-1", 1, signal);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
      workingRequirementDocumentId: "doc-1",
      expectedInputRevision: 3,
      expectedRequestRevision: 10,
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("same-request latest MD context is captured once; local fixtures never claim AI merging", async () => {
  values.clear();
  const signal = new AbortController().signal;
  const first = await mockRequirementsService.start(input, "context-first", signal);
  const saved = JSON.parse(values.get("vibelation.mock.requirement-jobs.v1"));
  saved[0].createdAt = "2020-01-01T00:00:00Z";
  values.set("vibelation.mock.requirement-jobs.v1", JSON.stringify(saved));
  const doc = (await mockRequirementsService.get("req", first.id, signal)).document;
  const next = await mockRequirementsService.start({ ...input, text: "변경", title: "새 제목" }, "context-next", signal, doc);
  assert.deepEqual(next.contextDocumentIds, [doc.id]);
  assert.equal(next.displayTitle, "새 제목");
  assert.equal(next.generationNumber, 2);
  assert.notEqual((await mockRequirementsService.get("req", next.id, signal)).phase, "merging_previous");
  const recovered = await mockRequirementsService.start(input, "context-next", signal);
  assert.equal(recovered.inputSnapshot.text, "변경");
  assert.deepEqual(recovered.contextDocumentIds, [doc.id]);
  await assert.rejects(mockRequirementsService.start({ ...input, requestId: "other" }, "foreign", signal, doc), /다른 요청/);
});
