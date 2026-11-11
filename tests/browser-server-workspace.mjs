import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "vite";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const server=await createServer({server:{host:"127.0.0.1",port:0},logLevel:"error",define:{
  "import.meta.env.VITE_API_URL":JSON.stringify("/api"),
  "import.meta.env.VITE_REQUIREMENTS_API_URL":JSON.stringify(""),
  "import.meta.env.VITE_GENERATION_API_URL":JSON.stringify(""),
}});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}/project-vibelation/`;
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],calls=[];
  page.on("pageerror",e=>errors.push(e.message));
  const row={id:"server-r",title:"서버에서 복원한 요청",text:"서버 입력",html:"",requestRevision:1,inputRevision:1,legacyReferenceId:"server-ref",legacyVersion:"server-ref",screenType:"modify",attachmentIds:[],workingRequirementDocumentId:null,activeConfirmationId:null,hasUnconfirmedChanges:true,createdAt:"2026-10-22T00:00:00Z",updatedAt:"2026-10-22T00:00:00Z"};
  let failOnce=false,conflict=false;
  const system={systemId:"sys",systemRevision:1,name:"서버 시스템",description:"",sourcePackages:[],uploadPolicy:{maxArchiveBytes:1000000}};
  await page.addInitScript(()=>localStorage.setItem("vibelation.requests.v4",JSON.stringify({schemaVersion:4,items:[]})));
  await page.route("**/api/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,method=req.method();calls.push({path,method});
    if(path==="/api/requests")return route.fulfill({json:{items:[row],nextCursor:null}});
    if(path==="/api/legacy-references")return route.fulfill({json:{items:[{id:"server-ref",systemName:"서버 시스템",version:"v1"}]}});
    if(path==="/api/requests/server-r"){
      if(method==="GET")return route.fulfill({json:row});
      const body=req.postDataJSON();
      if(failOnce){failOnce=false;return route.fulfill({status:503,json:{error:{code:"TEMPORARY",message:"일시 장애"}}});}
      if(conflict){conflict=false;row.requestRevision++;row.title="다른 브라우저에서 수정";}
      if(body.expectedRequestRevision!==row.requestRevision)return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT",message:"외부 수정 충돌"}}});
      Object.assign(row,body.input,{legacyReferenceId:body.legacyReferenceId,requestRevision:row.requestRevision+1,inputRevision:row.inputRevision+1});
      return route.fulfill({json:row});
    }
    if(path.startsWith("/api/requests/server-r/"))return route.fulfill({json:{items:[],nextCursor:null}});
    if(path==="/api/legacy-systems")return route.fulfill({json:{systemId:"sys"}});
    if(path==="/api/legacy-systems/sys")return route.fulfill({json:system});
    if(path==="/api/legacy-systems/sys/source-packages"){
      const form=await new Request(req.url(),{method:"POST",headers:{"Content-Type":req.headers()["content-type"]},body:req.postDataBuffer()}).formData();
      assert.equal(form.get("expectedSystemRevision"),"1");assert.equal(form.get("role"),"frontend");assert.equal(form.get("file").name,"source.zip");
      const item={id:"pkg",packageId:"pkg",name:"source.zip",role:"frontend",status:"ready"};system.sourcePackages=[item];system.systemRevision++;
      return route.fulfill({json:item});
    }
    if(path==="/api/legacy-systems/sys/source-packages/pkg"&&method==="DELETE"){
      assert.equal(req.headers()["if-match"],'"2"');system.sourcePackages=[];system.systemRevision++;return route.fulfill({status:204});
    }
    throw new Error(`Unexpected API: ${method} ${path}`);
  });
  await page.goto(base+"#/requests/server-r/input?view=legacy");
  const title=page.getByLabel("요청 제목",{exact:true});
  try { await title.waitFor({timeout:10000}); } catch (e) { console.log(JSON.stringify({errors,calls,body:await page.locator("body").innerText()},null,2)); throw e; }
  assert.equal(await title.inputValue(),row.title);
  await title.fill("자동 저장 확인");await page.getByRole("button",{name:"요청 정보 저장",exact:true}).click();
  await page.waitForFunction(()=>!localStorage.getItem("soetmul.server-dirty::server-r"));
  assert.equal(row.title,"자동 저장 확인");assert.equal(row.requestRevision,2);
  failOnce=true;await title.fill("재시도할 입력");await page.getByRole("button",{name:"요청 정보 저장",exact:true}).click();await page.getByText("일시 장애",{exact:true}).waitFor();
  assert.equal(await title.inputValue(),"재시도할 입력");
  await page.getByRole("button",{name:"저장 재시도",exact:true}).click();
  await page.waitForFunction(()=>!localStorage.getItem("soetmul.server-dirty::server-r"));
  assert.equal(row.title,"재시도할 입력");
  conflict=true;await title.fill("보존해야 할 미저장 입력");await page.getByRole("button",{name:"요청 정보 저장",exact:true}).click();await page.getByText("외부 수정 충돌",{exact:true}).waitFor();
  assert.equal(await title.inputValue(),"보존해야 할 미저장 입력");
  page.once("dialog",dialog=>dialog.accept());
  await page.reload();await title.waitFor();
  await page.getByText("외부 수정 충돌",{exact:true}).waitFor();
  assert.equal(await title.inputValue(),"보존해야 할 미저장 입력");
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"저장 자료 다시 불러오기",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('input[aria-label="요청 제목"]')?.value==="다른 브라우저에서 수정" || [...document.querySelectorAll('input')].some(el=>el.value==="다른 브라우저에서 수정"));
  await title.fill("재조회 뒤 저장");await page.getByRole("button",{name:"요청 정보 저장",exact:true}).click();await page.waitForFunction(()=>!localStorage.getItem("soetmul.server-dirty::server-r"));
  assert.equal(row.title,"재조회 뒤 저장");
  assert.equal(await page.evaluate(()=>localStorage.getItem("vibelation.requests.v4")),JSON.stringify({schemaVersion:4,items:[]}));
  await page.goto(base+"#/settings/legacy");
  await page.getByRole("heading",{name:"서버 레거시 코드 관리",exact:true}).waitFor();
  await page.getByLabel("서버 시스템 이름",{exact:true}).fill("서버 시스템");
  await page.getByRole("button",{name:"초안 저장",exact:true}).click();
  await page.getByText(/리비전 1 · 활성 기준/).waitFor();
  await page.getByLabel("ZIP 업로드",{exact:true}).setInputFiles({name:"source.zip",mimeType:"application/zip",buffer:Buffer.from([80,75,5,6,0,0,0,0])});
  await page.getByText("ZIP 검증을 완료했습니다.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"초안에서 제외",exact:true}).click();
  await page.getByText(/리비전 3 · 활성 기준/).waitFor();
  assert.equal(calls.some(c=>c.path.includes("review-reports")||c.path.includes("report-jobs")),false);
  assert.deepEqual(errors,[]);console.log("PASS: server restoration, autosave, retry, conflict preservation/reload, cache isolation and server ZIP management");
}finally{await browser.close();await server.close();}

// Local mode must keep main's existing UI and fixture generation without server calls.
const localServer=await createServer({server:{host:"127.0.0.1",port:0},logLevel:"error",define:{
  "import.meta.env.VITE_API_URL":JSON.stringify(""),"import.meta.env.VITE_REQUIREMENTS_API_URL":JSON.stringify(""),"import.meta.env.VITE_GENERATION_API_URL":JSON.stringify(""),
}});
await localServer.listen();
const localBase=`http://127.0.0.1:${localServer.httpServer.address().port}/project-vibelation/`;
const localBrowser=await chromium.launch({channel:"chrome",headless:true});
try{
  const page=await localBrowser.newPage(),errors=[],apiCalls=[];
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))apiCalls.push(r.url());});
  await page.goto(localBase);
  await page.evaluate(async()=>{
    const {legacyRepository}=await import("/project-vibelation/src/storage/legacySources.ts");
    const {prepareSourceArchive}=await import("/project-vibelation/src/domain/legacySources.ts");
    const archive=await prepareSourceArchive(new File([new Uint8Array([80,75,3,4,1])],"local.zip"),"frontend");
    const saved=await legacyRepository.save({id:"local-system",name:"검증용 시스템",description:"",archives:[archive],revision:0},0);
    await legacyRepository.apply(saved);
  });
  await page.getByRole("button",{name:/시작하기/}).click();
  await page.getByRole("button",{name:/검증용 시스템/}).click();
  await page.locator(".screen-type-options button").first().click();
  await page.getByLabel("요청 제목",{exact:true}).fill("로컬 시연 검증");
  await page.getByRole("button",{name:"요청 정보 저장",exact:true}).click();
  await page.getByRole("button",{name:"쇳물 녹이기 ›",exact:true}).click();
  await page.getByRole("button",{name:"샘플 불러오기",exact:true}).click();
  await page.getByRole("button",{name:"성분 보기 ›",exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem("vibelation.requests.v4")||"null")?.items[0]?.requirements.length>0);
  const md=await page.evaluate(()=>JSON.parse(localStorage.getItem("vibelation.requests.v4")).items[0].requirements[0].markdown);
  assert.match(md,/v1\.0/);assert.deepEqual(apiCalls,[]);assert.deepEqual(errors,[]);
  console.log("PASS: main local ZIP selection, request editing and fixture MD generation remain available without backend configuration");
}finally{await localBrowser.close();await localServer.close();}
