import test from "node:test";
import { createHash } from "node:crypto";
import graphFixture from "../src/mocks/step02-impact-graph.json" with { type: "json" };
import { analysisFromServer } from "../src/services/contract.ts";
import assert from "node:assert/strict";
import { createBackendApi } from "../src/services/backendApi.ts";
import { ApiError, createApiClient } from "../src/services/api.ts";
import { syncInput, mutateRequest, rememberServerRequest, serverState, restoreRequest, serverRequests,
  serverDraftKey, serverDrafts, dirtyKey, saveServerDraft, createServerRequest, registerServerRequest, confirmServerRequest } from "../src/services/serverWorkspace.ts";
import { blankRequest, basisOf, confirmRequirement, hasConfirmedRequirement } from "../src/domain/types.ts";
import { repository } from "../src/storage/repositories.ts";
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k) };
const signal = () => new AbortController().signal;
const base = "https://backend.example/api";
const input = { requestId: "r", inputRevision: 1, title: "원문", text: "본문", html: "<p>HTML</p>", screenType: "modify", legacyReferenceId: "zip:one", attachmentIds: [], attachmentNames: [] };
const request = { id:"r", requestRevision:1, inputRevision:1, title:"원문",text:"본문",html:"<p>HTML</p>",screenType:"modify",legacyReferenceId:"zip:one",legacyVersion:"zip:one",attachmentIds:[],createdAt:"2026-10-22T00:00:00Z",updatedAt:"2026-10-22T00:00:00Z",hasUnconfirmedChanges:false,workingRequirementDocumentId:"d",activeConfirmationId:"c",latestAnalysisResultId:"a",latestSimilarCaseAnalysisResultId:"sim" };
const doc = { id:"d",generationId:"j",generationNumber:2,inputRevision:1,inputSnapshot:input,markdown:"# 확정 문서",createdAt:request.createdAt,formatVersion:"v1",source:"server" };
const confirmation = { id:"c",requestId:"r",requirementDocumentId:"d",inputRevision:1,version:1,confirmedAt:request.createdAt,documentSnapshot:doc };
const analysis = { id:"a",requestId:"r",confirmationId:"c",requirementDocumentId:"d",legacyVersion:"zip:one",screenType:"modify",impacts:[],
  impactGraph:{...structuredClone(graphFixture),id:"graph-a",analysisId:"a"},html:"<h1>분석</h1>",
  analysisHtmlArtifact:{id:"html-a",sha256:createHash("sha256").update("<h1>분석</h1>").digest("hex"),sizeBytes:Buffer.byteLength("<h1>분석</h1>")} };
async function simResult() {
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(doc.markdown)))].map(n=>n.toString(16).padStart(2,"0")).join("");
  return { id:"sim",requestId:"r",confirmationId:"c",requirementDocumentId:"d",requirementDocumentContentHash:hash,analysisResultId:"a",legacyVersion:"zip:one",screenType:"modify",similarCaseMap:{status:"no_matches",cases:[]} };
}
function confirmedRequest() {
  const r={...blankRequest(),id:"r",title:input.title,text:input.text,html:input.html,screenType:"modify",legacyVersion:"zip:one",requirements:[structuredClone(doc)],selectedRequirementDocumentId:"d",requirementAppliedAtInputRevision:1};
  const c=confirmRequirement(r);c.activeConfirmationId="c";c.confirmations[0].id="c";
  c.analysis={...analysis,source:"server",basis:basisOf(c)};
  c.similarCaseAnalysis={id:"sim",analysisId:"a",basis:basisOf(c),cases:[],status:"no_matches",source:"server"};return c;
}
test("API normalizes /api, preserves conflict details and never fabricates success", async()=>{
  values.clear();let received;
  const api=createApiClient(base,async(url,init)=>{received={url,init};return Response.json({error:{code:"VERSION_CONFLICT",message:"충돌",details:{revision:4}}},{status:409,headers:{"Retry-After":"2"}})});
  await assert.rejects(api("/requests/r",signal()),e=>e instanceof ApiError&&e.code==="VERSION_CONFLICT"&&e.status===409&&e.details.revision===4&&e.retryAfter==="2");
  assert.equal(received.url,base+"/requests/r");assert.equal(received.init.credentials,"same-origin");
  const aborted=new AbortController();aborted.abort();await assert.rejects(api("/requests/r",aborted.signal),{name:"AbortError"});
});
test("autosave and selection serialize server revisions, skip identical input and retain conflicts", async()=>{
  values.clear();let revision=1;const bodies=[];
  const api=createBackendApi(base,async(url,init)=>{
    const body=JSON.parse(init.body);bodies.push(body);assert.equal(body.expectedRequestRevision,revision);
    await new Promise(resolve=>setTimeout(resolve,5));return Response.json({...request,requestRevision:++revision,inputRevision:revision,inputSnapshotId:`s-${revision}`});
  });
  rememberServerRequest(request,undefined,base);
  await Promise.all([syncInput(input,signal(),undefined,api),mutateRequest("r",signal(),row=>api.patchRequest("r",{workingRequirementDocumentId:"d",expectedRequestRevision:row.requestRevision},signal()),api)]);
  assert.deepEqual(bodies.map(b=>b.expectedRequestRevision),[1,2]);
  await syncInput(input,signal(),undefined,api);assert.equal(bodies.length,2,"selection does not discard acknowledged input fingerprint");
  const conflict=createBackendApi(base,async()=>Response.json({error:{code:"VERSION_CONFLICT",message:"외부 수정"}},{status:409}));
  await assert.rejects(syncInput({...input,text:"새 내용"},signal(),undefined,conflict),e=>e.status===409);
  assert.equal(serverState("r",base).row.requestRevision,3);assert.equal(input.text,"본문");
});
test("server caches stay separate from demo records and other API bases", async()=>{
  values.clear();const local={...blankRequest(),title:"시연 요청"};repository.saveRequest(local);
  assert.deepEqual(serverDrafts(),[]);const server={...blankRequest(),id:"server"};saveServerDraft(server);
  assert.equal(serverDrafts()[0].id,"server");assert.equal(repository.requests()[0].id,local.id);
  rememberServerRequest(request,undefined,base);assert.equal(serverState("r","https://another.example"),undefined);
  values.set(serverDraftKey,"{}");assert.throws(()=>serverDrafts(),/캐시/);
});
test("creation retries reuse the idempotency key without sending local demo data", async()=>{
  values.clear();const keys=[],bodies=[];let attempts=0;
  const api=createBackendApi(base,async(url,init)=>{
    if(url.endsWith("legacy-references"))return Response.json({items:[{id:"zip:one"}]});
    keys.push(init.headers["Idempotency-Key"]);bodies.push(JSON.parse(init.body));
    if(!attempts++)throw new TypeError("network failure");return Response.json(request);
  });
  await assert.rejects(createServerRequest(signal(),api),/network/);const r=await createServerRequest(signal(),api);
  assert.equal(keys[0],keys[1]);assert.deepEqual(bodies[0],{title:"",legacyReferenceId:"zip:one"});assert.equal(r.id,"r");
});
test("restore uses immutable document inputs, SIM results and reportId without legacy report APIs", async()=>{
  values.clear();const paths=[];const sim=await simResult();
  const api=createBackendApi(base,async(url)=>{
    const path=new URL(url).pathname;paths.push(path);
    if(path==="/api/requests/r")return Response.json({...request,text:"현재 입력"});
    if(path.endsWith("requirement-documents"))return Response.json({items:[doc],nextCursor:null});
    if(path.endsWith("requirement-confirmations"))return Response.json({items:[confirmation]});
    if(path.endsWith("requirement-generations"))return Response.json({items:[]});
    if(path.endsWith("system-mock"))return Response.json({message:"none"},{status:404});
    if(path.endsWith("analysis-results/a"))return Response.json(analysis);
    if(path.endsWith("similar-case-analysis-results/sim"))return Response.json(sim);
    throw new Error(`unexpected ${path}`);
  });
  const r=await restoreRequest("r",signal(),api);
  assert.equal(r.text,"현재 입력");assert.equal(r.requirements[0].inputSnapshot.text,input.text);
  assert.equal(r.similarCaseAnalysis.id,"sim");assert.equal(hasConfirmedRequirement(r),true);
  assert.equal(r.report,undefined);assert.equal(paths.some(p=>p.includes("review-reports")||p.includes("report-jobs")),false);
  values.set(dirtyKey("r"),"1");rememberServerRequest({...request,requestRevision:1},"pending-local",base);
  await restoreRequest("r",signal(),api);assert.equal(serverState("r",base).fingerprint,"pending-local","dirty reload does not silently advance the expected server revision");
});
test("pagination loops and foreign document histories fail rather than falling back to fixtures", async()=>{
  values.clear();const looping=createBackendApi(base,async()=>Response.json({items:[],nextCursor:"same"}));
  await assert.rejects(serverRequests(signal(),looping),/반복/);
  const api=createBackendApi(base,async(url)=>{
    if(url.endsWith("/requests/r"))return Response.json({...request,latestAnalysisResultId:null,latestSimilarCaseAnalysisResultId:null});
    if(url.endsWith("requirement-documents"))return Response.json({items:[{...doc,inputSnapshot:{...input,requestId:"foreign"}}]});
    return Response.json({items:[]});
  });
  await assert.rejects(restoreRequest("r",signal(),api),/다른 요청/);
});
test("confirmation uses serialized latest revisions while keeping current main document semantics", async()=>{
  values.clear();rememberServerRequest(request,undefined,base);const calls=[];
  const api=createBackendApi(base,async(url,init)=>{
    const body=JSON.parse(init.body);calls.push({url,body});
    if(init.method==="PATCH")return Response.json({...request,requestRevision:2});
    return Response.json({...confirmation,requestRevision:3});
  });
  const r=await confirmServerRequest(confirmedRequest(),signal(),api);
  assert.equal(calls[1].body.expectedRequestRevision,2);assert.equal(calls[1].body.requirementDocumentId,"d");
  assert.equal(hasConfirmedRequirement(r),true);assert.equal(serverState("r",base).row.requestRevision,3);
});
test("registration sends SIM identity and resolves reportId to the registered immutable bundle", async()=>{
  values.clear();const r=confirmedRequest(),sim=await simResult(),calls=[];
  const api=createBackendApi(base,async(url,init)=>{
    calls.push({url,init});
    if(init.method==="POST")return Response.json({reportId:"bundle",requestId:"r"});
    return Response.json({reportId:"bundle",requestId:"r",registeredAt:request.createdAt,confirmationSnapshot:confirmation,analysisSnapshot:analysis,similarCaseAnalysisSnapshot:sim});
  });
  const result=await registerServerRequest(r,signal(),api);
  assert.equal(result.id,"bundle");assert.equal(result.request.similarCaseAnalysis.id,"sim");
  assert.deepEqual(JSON.parse(calls[0].init.body),{requestId:"r",confirmationId:"c",analysisResultId:"a",similarCaseAnalysisId:"sim"});
  assert.equal(calls[1].url,base+"/review-registrations/bundle");
  assert.equal(calls.some(c=>c.url.includes("review-reports")),false);
});

test("new server drafts restore without a selected MD or cached selection", async()=>{
  values.clear();
  const api=createBackendApi(base,async url=>url.endsWith("/requests/r")
    ? Response.json({...request,workingRequirementDocumentId:null,activeConfirmationId:null,latestAnalysisResultId:null,latestSimilarCaseAnalysisResultId:null})
    : Response.json({items:[]}));
  const restored=await restoreRequest("r",signal(),api);
  assert.equal(restored.selectedRequirementDocumentId,undefined);
  assert.deepEqual(restored.requirements,[]);
});

test("restored analyses enforce main's graph and HTML artifact integrity", async()=>{
  const input={basis:basisOf(confirmedRequest())};
  assert.equal((await analysisFromServer(analysis,input)).id,"a");
  await assert.rejects(analysisFromServer({...analysis,impactGraph:undefined},input),/영향도 지도/);
  await assert.rejects(analysisFromServer({...analysis,html:"변조된 본문"},input),/해시/);
});
