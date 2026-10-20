import test from "node:test";
import assert from "node:assert/strict";
import { createBackendApi } from "../src/services/backendApi.ts";
import { rememberServerRequest, syncInput, serverState, documentFromWire, registrationFromWire } from "../src/services/serverWorkspace.ts";
const values=new Map();
globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const input={requestId:"r",inputRevision:1,title:"원문",text:"본문",html:"<h1>HTML</h1>",attachmentIds:[],attachmentNames:[]};
test("input writes serialize revisions, skip identical data and preserve state after conflicts",async()=>{
  values.clear();rememberServerRequest({id:"r",requestRevision:1,inputRevision:1});
  const bodies=[];let revision=1;
  const api=createBackendApi("/api",async(_,init)=>{
    const body=JSON.parse(init.body);bodies.push(body);
    assert.equal(body.expectedRequestRevision,revision);
    await new Promise(r=>setTimeout(r,10));
    return Response.json({id:"r",requestRevision:++revision,inputRevision:revision,inputSnapshotId:`s-${revision}`,desiredDueDate:body.input.desiredDueDate});
  });
  await Promise.all([syncInput(input,new AbortController().signal,"2026-10-31",api),syncInput({...input,text:"새 본문"},new AbortController().signal,"2026-10-31",api)]);
  assert.deepEqual(bodies.map(b=>b.expectedRequestRevision),[1,2]);
  await syncInput({...input,text:"새 본문"},new AbortController().signal,"2026-10-31",api);
  assert.equal(bodies.length,2);
  const conflict=createBackendApi("/api",async()=>Response.json({error:{code:"VERSION_CONFLICT",message:"다른 편집"}},{status:409}));
  await assert.rejects(syncInput({...input,text:"다시 편집"},new AbortController().signal,"",conflict),e=>e.code==="VERSION_CONFLICT");
  assert.equal(serverState("r").row.requestRevision,3);
  assert.equal(input.text,"본문");
});
test("missing historical input is marked unavailable and registration uses immutable snapshots",()=>{
  values.clear();
  const wire={id:"d",generationId:"j",generationNumber:1,inputRevision:1,title:"당시 제목",markdown:"# 당시 MD",formatVersion:"v1",createdAt:"2026-10-18T00:00:00Z"};
  assert.equal(documentFromWire(wire,"r").inputSnapshot.unavailable,true);
  const detail={id:"reg",requestId:"r",title:"등록 제목",registeredAt:wire.createdAt,
    confirmationSnapshot:{id:"c",requestId:"r",version:1,inputRevision:1,requirementDocumentId:"d",documentSnapshot:wire,confirmedAt:wire.createdAt},
    analysisSnapshot:{id:"a",confirmationId:"c",requirementDocumentId:"d",legacyVersion:"code-old",impacts:[],totalDays:1,durationDays:1,bufferDays:0},
    reportSnapshot:{id:"p",analysisResultId:"a",markdown:"# 당시 리포트"}};
  const result=registrationFromWire(detail);
  assert.equal(result.request.report.markdown,"# 당시 리포트");
  assert.equal(result.request.confirmations[0].documentSnapshot.markdown,"# 당시 MD");
  assert.equal(result.request.legacyVersion,"code-old");
});

test("screen kind is preserved in saved input and changing it invalidates confirmation",async()=>{
  values.clear();rememberServerRequest({id:"r",requestRevision:1,inputRevision:1});
  let body;
  const api=createBackendApi("/api",async(_,init)=>{body=JSON.parse(init.body);return Response.json({id:"r",requestRevision:2,inputRevision:2});});
  await syncInput({...input,screenType:"modify"},new AbortController().signal,"",api);
  assert.equal(body.input.screenType,"modify");
  const {blankRequest,editRequest,snapshotOf}=await import("../src/domain/types.ts");
  const r=blankRequest(),edited=editRequest(r,{screenType:"new"});
  assert.equal(edited.inputRevision,r.inputRevision+1);
  assert.equal(snapshotOf(edited).screenType,"new");
});
