import test from "node:test";
import assert from "node:assert/strict";
import { createBackendApi, ApiError } from "../src/services/backendApi.ts";

test("all 34 contract operations use encoded paths, revisions, binary uploads and idempotency",async()=>{
  const calls=[];
  const api=createBackendApi("https://backend.test/api/",async(url,init)=>{calls.push({url,init});return init.method==="DELETE"?new Response(null,{status:204}):Response.json({items:[],id:"ok"});});
  const s=new AbortController().signal,file=new File(["# MD"],"requirements.md"),zip=new File(["PK bytes"],"code.zip");
  const sources=[{id:"src",role:"backend",name:zip.name,sha256:"a".repeat(64),file:zip}];
  await api.createRequest({title:"요청",legacyReferenceId:"legacy"},"new",s);
  await api.listRequests({cursor:"next &",limit:10},s);
  await api.getRequest("r/a",s);
  await api.patchRequest("r/a",{expectedRequestRevision:7,input:{text:"원문"}},s);
  await api.listLegacyReferences(s);
  await api.attachmentPolicy(s);
  await api.uploadAttachment("r/a",file,"upload",s);
  await api.attachmentStatus("r/a","f/a",s);
  await api.startRequirements("r/a",{inputSnapshotId:"snap",expectedInputRevision:2},"md",s);
  await api.requirementJobs("r/a",s);
  await api.requirementJob("r/a","j/a",s);
  await api.requirementDocuments("r/a","cursor",s);
  await api.requirementDocument("r/a","d/a",s);
  await api.startMock("r/a","d/a",file,sources,"zip:v","mock",s);
  await api.mockJob("r/a","j/a",s);
  await api.latestMock("r/a",s);
  await api.confirm("r/a",{requirementDocumentId:"d/a",expectedInputRevision:2,expectedRequestRevision:8},"confirm",s);
  await api.confirmations("r/a",s);
  await api.confirmation("r/a","c/a",s);
  await api.startAnalysis("r/a","c/a",file,sources,"zip:v","analysis",s);
  await api.analysisJob("j/a",s);
  await api.analysisResult("a/a",s);
  await api.startReport({requestId:"r/a",confirmationId:"c/a",analysisResultId:"a/a"},"report",s);
  await api.reportJob("j/a",s);
  await api.report("p/a",s);
  await api.register({requestId:"r/a",reportId:"p/a",reviewChecks:{scopeReviewed:true,estimateReviewed:true}},"register",s);
  await api.registrations({q:"한글 &",registeredFrom:"2026-10-18T00:00:00Z"},s);
  await api.registration("reg/a",s);
  await api.createSystem({name:"시스템",description:"설명"},"system",s);
  await api.system("s/a",s);
  await api.patchSystem("s/a",{action:"apply",expectedSystemRevision:3},"apply",s);
  await api.uploadSource("s/a",zip,"backend",3,"source","old/a",s);
  await api.sourceStatus("s/a","p/a",s);
  assert.equal(await api.removeSource("s/a","p/a",4,s),undefined);
  assert.equal(calls.length,34);
  assert.ok(calls.every(c=>c.init.credentials==="include" && c.init.signal===s));
  assert.equal(calls[2].url,"https://backend.test/api/requests/r%2Fa");
  assert.equal(new URL(calls[1].url).searchParams.get("cursor"),"next &");
  assert.equal(new URL(calls[26].url).searchParams.get("q"),"한글 &");
  assert.equal(calls.at(-1).init.headers["If-Match"],'"4"');
  for(const i of [6,13,19,31]) {
    const init=calls[i].init;
    assert.ok(init.body instanceof FormData);
    assert.equal(init.headers["Content-Type"],undefined);
    assert.ok(init.headers["Idempotency-Key"]);
  }
  for(const i of [13,19]){
    assert.equal(await calls[i].init.body.get("file").text(),"# MD");
    assert.equal(await calls[i].init.body.getAll("sourceFiles")[0].text(),"PK bytes");
    assert.equal(JSON.parse(calls[i].init.body.get("sourceManifest"))[0].role,"backend");
  }
  assert.equal(calls[31].init.body.get("replacesSourcePackageId"),"old/a");
  assert.equal(calls[31].init.body.get("expectedSystemRevision"),"3");
});

test("API errors preserve common and FastAPI envelopes, retry hints and cancellation",async()=>{
  for(const body of [{error:{code:"VERSION_CONFLICT",message:"충돌",details:{revision:3}}},{detail:{error:{code:"VERSION_CONFLICT",message:"충돌",details:{revision:3}}}}]){
    const api=createBackendApi("/api",async()=>Response.json(body,{status:409,headers:{"Retry-After":"2"}}));
    await assert.rejects(api.getRequest("r"),e=>e instanceof ApiError && e.code==="VERSION_CONFLICT" && e.details.revision===3 && e.retryAfter==="2");
  }
  const unavailable=createBackendApi("/api",async()=>new Response("not implemented",{status:501}));
  await assert.rejects(unavailable.createSystem({name:"a",description:""},"k"),e=>e.status===501);
  const controller=new AbortController();controller.abort();
  const aborting=createBackendApi("/api",async(_,init)=>{init.signal.throwIfAborted();});
  await assert.rejects(aborting.getRequest("r",controller.signal),{name:"AbortError"});
});
