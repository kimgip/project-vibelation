import test from "node:test";
import assert from "node:assert/strict";
import {
  mockRequirementsService,
  createHttpRequirementsService,
  validateFiles,
} from "../src/services/requirements.ts";
import { rememberServerRequest } from "../src/services/serverWorkspace.ts";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, v),
  removeItem: k => values.delete(k),
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
    if(url.endsWith("/attachment-policy"))return Response.json({allowedExtensions:["txt"],maxFileBytes:100});
    received = { url, options };
    return new Response(
      JSON.stringify({
        id: "file-1",
        usableForGeneration: true,
        name: file.name,
        sizeBytes: file.size,
        contentType: file.type,
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
    assert.ok(received.options.headers["Idempotency-Key"]);
    assert.equal(received.options.headers["Content-Type"],undefined);
  } finally {
    globalThis.fetch = original;
  }
  assert.throws(() => validateFiles([new File(["a"], "bad.exe")], 0));
});
test("HTTP generation saves current input, starts from server snapshot and selects with revisions", async () => {
  values.clear();
  rememberServerRequest({id:"req",requestRevision:1,inputRevision:1,inputSnapshotId:"old"});
  const original=globalThis.fetch,calls=[],signal=new AbortController().signal;
  const doc={id:"doc-1",generationId:"job-1",generationNumber:1,inputRevision:2,markdown:"# 요구사항",createdAt:"2026-10-18T00:00:00Z",formatVersion:"v1"};
  globalThis.fetch=async(url,init)=>{
    calls.push({url,init});
    if(init.method==="PATCH")return Response.json({id:"req",requestRevision:2,inputRevision:2,inputSnapshotId:"snapshot-2"});
    if(url.endsWith("/requirement-documents/doc-1"))return Response.json(doc);
    return Response.json({id:"job-1",generationNumber:1,status:"succeeded",result:{type:"requirementDocument",id:"doc-1"},createdAt:doc.createdAt});
  };
  try{
    const api=createHttpRequirementsService("https://backend.example/api");
    await api.start(input,"same-key",signal);
    assert.equal(calls[0].url,"https://backend.example/api/requests/req");
    assert.equal(JSON.parse(calls[0].init.body).input.text,input.text);
    assert.deepEqual(JSON.parse(calls[1].init.body),{inputSnapshotId:"snapshot-2",expectedInputRevision:2});
    assert.equal(calls[1].init.headers["Idempotency-Key"],"same-key");
    const completed=await api.get("req","job-1",signal);
    assert.equal(completed.document.id,"doc-1");
    assert.deepEqual(completed.document.inputSnapshot,input);
    await api.select("req","doc-1",1,signal);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body),{expectedRequestRevision:2,expectedInputRevision:2,workingRequirementDocumentId:"doc-1"});
    await api.select("req",null,1,signal);
    assert.equal(JSON.parse(calls.at(-1).init.body).workingRequirementDocumentId,null);
  }finally{globalThis.fetch=original;}
});
