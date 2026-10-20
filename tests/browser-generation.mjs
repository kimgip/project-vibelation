import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "vite";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
process.env.VITE_API_URL="/test-api";
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/project-vibelation/`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  let selectedDoc, version, confirmation;
  let row, document, conf, registration;
  const analysis=()=>({id:"analysis-result",requestId:row.id,confirmationId:conf.id,requirementDocumentId:document.id,legacyVersion:version,impacts:[{id:"ui",type:"UI",name:"서버 자원",path:"front/index.html",current:"기존 화면",proposed:"변경 화면",reason:"선택 MD 기준",days:1}],totalDays:1,durationDays:1,bufferDays:0});
  const report=()=>({id:"report-server",requestId:row.id,confirmationId:conf.id,analysisResultId:"analysis-result",markdown:"# 서버 최종 리포트",formatVersion:"v1",createdAt:now});
  const now="2026-10-18T00:00:00Z";
  let revision=1,inputRevision=1;
  const job={id:"md-job",generationNumber:1,status:"queued",createdAt:now};
  let mockNetworkFailure = true, analysisNetworkFailure = true;
  await page.route("**/test-api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const path=url.pathname.replace("/test-api","");
    if(path==="/legacy-references")return route.fulfill({json:{items:[{id:"legacy-01",version:"DEMO-2026.10",systemName:"Demo"}]}});
    if(path==="/requests" && req.method()==="GET")return route.fulfill({json:{items:row?[row]:[],nextCursor:null}});
    if(path==="/requests" && req.method()==="POST"){
      assert.ok(req.headers()["idempotency-key"]);
      row={id:"req-server",title:"새 개선 요청",text:"",html:"",desiredDueDate:null,attachmentIds:[],requestRevision:revision,inputRevision,inputSnapshotId:"input-1",legacyVersion:"DEMO-2026.10",updatedAt:now};
      return route.fulfill({json:row});
    }
    if(path==="/requests/req-server" && req.method()==="PATCH"){
      const body=req.postDataJSON();assert.equal(body.expectedRequestRevision,revision);
      if(body.input){inputRevision++;Object.assign(row,body.input,{inputRevision,inputSnapshotId:`input-${inputRevision}`});}
      if("workingRequirementDocumentId" in body)row.workingRequirementDocumentId=body.workingRequirementDocumentId;
      row.requestRevision=++revision;return route.fulfill({json:row});
    }
    if(path==="/requests/req-server" && req.method()==="GET")return route.fulfill({json:row});
    if(path.endsWith("/requirement-documents"))return route.fulfill({json:{items:document?[{id:document.id}]:[],nextCursor:null}});
    if(path.endsWith("/requirement-generations") && req.method()==="POST"){
      const body=req.postDataJSON();assert.equal(body.inputSnapshotId,row.inputSnapshotId);
      document={id:"md-server",requestId:row.id,title:row.title,generationId:job.id,generationNumber:1,inputRevision,markdown:"# 서버 요구사항",formatVersion:"v1",createdAt:now};
      return route.fulfill({json:job});
    }
    if(path.endsWith("/requirement-generations/md-job"))return route.fulfill({json:{...job,status:"succeeded",result:{type:"requirementDocument",id:document.id}}});
    if(path.endsWith("/requirement-documents/md-server"))return route.fulfill({json:document});
    if(path.endsWith("/requirement-confirmations") && req.method()==="POST"){
      const body=req.postDataJSON();assert.equal(body.expectedRequestRevision,revision);assert.equal(body.expectedInputRevision,inputRevision);
      conf={id:"conf-server",requirementDocumentId:document.id,requestId:row.id,version:1,inputRevision,documentSnapshot:document,confirmedAt:now,requestRevision:++revision};
      row.requestRevision=revision;row.activeConfirmationId=conf.id;return route.fulfill({json:conf});
    }
    if(path.endsWith("/requirement-generations") && req.method()==="GET")return route.fulfill({json:{items:document?[{...job,status:"succeeded",result:{id:document.id}}]:[]}});
    if(path.endsWith("/requirement-confirmations") && req.method()==="GET")return route.fulfill({json:{items:conf?[conf]:[]}});
    if(path==="/review-reports" && req.method()==="POST"){
      assert.deepEqual(req.postDataJSON(),{requestId:row.id,confirmationId:conf.id,analysisResultId:"analysis-result"});
      return route.fulfill({json:{id:"report-job",status:"queued"}});
    }
    if(path==="/report-jobs/report-job")return route.fulfill({json:{id:"report-job",status:"succeeded",result:{type:"reviewReport",id:"report-server"}}});
    if(path==="/review-reports/report-server")return route.fulfill({json:report()});
    if(path==="/review-registrations" && req.method()==="POST"){
      const body=req.postDataJSON();assert.equal(body.reportId,"report-server");assert.deepEqual(body.reviewChecks,{scopeReviewed:true,estimateReviewed:true});
      registration={id:"reg-server",requestId:row.id,title:row.title,confirmationId:conf.id,analysisResultId:"analysis-result",reportId:"report-server",registeredAt:now};
      return route.fulfill({json:registration});
    }
    if(path==="/review-registrations/reg-server")return route.fulfill({json:{...registration,confirmationSnapshot:conf,analysisSnapshot:analysis(),reportSnapshot:report()}});
    if(path==="/review-registrations")return route.fulfill({json:{items:registration?[registration]:[],nextCursor:null}});
    if(path.endsWith("/system-mock"))return route.fulfill({json:{id:"remote-html",html:"<h1>서버 예상 화면</h1>",requirementDocumentId:document.id,legacyVersion:version,createdAt:now}});
    if(path==="/analysis-results/analysis-result")return route.fulfill({json:analysis()});
    if (req.method() === "POST") {
      const form = await new Request(req.url(), {
        method: "POST",
        headers: { "Content-Type": req.headers()["content-type"] },
        body: req.postDataBuffer(),
      }).formData();
      const manifest = JSON.parse(form.get("sourceManifest"));
      requests.push({
        path: url.pathname,
        md: await form.get("file").text(),
        manifest,
        files: await Promise.all(
          form
            .getAll("sourceFiles")
            .map(async (f) => ({
              name: f.name,
              bytes: [...new Uint8Array(await f.arrayBuffer())],
            })),
        ),
      });
      version = form.get("legacyVersion");
      if (url.pathname.endsWith("system-mock-generations")) {
        selectedDoc = form.get("requirementDocumentId");
        await route.fulfill({ json: { id: "mock-job", status: "queued" } });
      } else {
        confirmation = url.pathname
          .split("/requirement-confirmations/")[1]
          .split("/")[0];
        await route.fulfill({ json: { id: "analysis-job", status: "queued" } });
      }
    } else if (url.pathname.includes("system-mock-generations") && mockNetworkFailure) { mockNetworkFailure = false; await route.fulfill({status:503,body:"temporary"}); } else if (url.pathname.includes("system-mock-generations"))
      await route.fulfill({
        json: {
          id: "mock-job",
          status: "succeeded",
          artifact: {
            id: "remote-html",
            requirementDocumentId: selectedDoc,
            legacyVersion: version,
            html: "<!doctype html><h1>서버 예상 화면</h1><script>parent.__untrustedServerScript=true</script>",
          },
        },
      });
    else if (url.pathname.includes("analysis-jobs") && analysisNetworkFailure) { analysisNetworkFailure = false; await route.fulfill({status:503,body:"temporary"}); } else if (url.pathname.includes("analysis-jobs"))
      await route.fulfill({
        json: {
          id: "analysis-job",
          status: "succeeded",
          result: {type:"analysisResult",id:"analysis-result"},
        },
      });
    else throw Error("Unexpected request: " + req.url());
  });
  await page.goto(base + "#/settings/legacy");
  await page
    .getByLabel("시스템 이름", { exact: true })
    .fill("전송 테스트 코드");
  const front = Buffer.from([0x50, 0x4b, 0x03, 0x04, 10, 11]);
  const back = Buffer.from([0x50, 0x4b, 0x03, 0x04, 20, 21]);
  await page
    .getByLabel("코드 ZIP 추가", { exact: true })
    .setInputFiles({
      name: "front.zip",
      mimeType: "application/zip",
      buffer: front,
    });
  await page
    .getByText("코드 ZIP을 브라우저에 보관했습니다.", { exact: false })
    .waitFor();
  await page.getByRole("group", {name:"코드 분류",exact:true}).getByRole("button",{name:"백엔드",exact:true}).click();
  await page
    .getByLabel("코드 ZIP 추가", { exact: true })
    .setInputFiles({
      name: "back.zip",
      mimeType: "application/zip",
      buffer: back,
    });
  await page.getByText("back.zip", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "틀 등록 · 변경사항 적용", exact: true })
    .click();
  await page
    .getByText("새 코드 기준을 적용했습니다.", { exact: false })
    .waitFor();
  assert.equal(
    requests.length,
    0,
    "settings must not send code before generation",
  );
  await page.goto(base);
  await page.getByRole("button", { name: "시작하기 ›", exact: true }).click();
  await page.getByRole("button", { name: /전송 테스트 코드/ }).click();
  await page.getByRole("button",{name:"신규 레거시 스타일로 새 화면",exact:true}).click();
  await page.getByRole("button", { name: "쇳물 녹이기 ›", exact: true }).click();
  await page.getByRole("button", { name: "샘플 불러오기" }).click();
  await page
    .getByRole("button", { name: "성분 보기 ›", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "[쇳물 성분 보기]", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "기준으로 정하기", exact: true })
    .click();
  await page.getByRole("button",{name:"되돌리기",exact:true}).click();
  await page.getByRole("button",{name:"기준으로 정하기",exact:true}).waitFor();
  assert.equal(row.workingRequirementDocumentId,null,"undo first selection clears server MD");
  await page.getByRole("button",{name:"기준으로 정하기",exact:true}).click();
  assert.equal(row.screenType,"new");
  await page
    .getByRole("button", { name: "미리 붓기 ›", exact: true })
    .click();
  await page
    .getByRole("button", { name: "시스템 적용 Mock 생성", exact: true })
    .click();
  try { await page.getByRole("button", {name:"같은 작업 다시 확인",exact:true}).click({timeout:8000}); }
  catch(e){ console.log(await page.locator("body").innerText()); throw e; }
  await page.getByText("서버 생성 HTML", { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(() => window.__untrustedServerScript),
    undefined,
    "server HTML cannot execute in app",
  );
  await page
    .getByRole("button", {
      name: "탕도 살피기 ›",
      exact: true,
    })
    .click();
  await page.getByText("서버 요청 실패 (503)",{exact:false}).waitFor();
  await page.getByRole("button",{name:"레거시 분석",exact:true}).click();
  await page.getByRole("button", { name: /서버 자원/ }).waitFor();
  assert.equal(requests.length, 2);
  assert.ok(requests[0].path.endsWith("system-mock-generations"));
  assert.ok(requests[1].path.endsWith("analysis-jobs"));
  for (const sent of requests) {
    assert.deepEqual(
      sent.manifest.map((m) => m.role),
      ["frontend", "backend"],
    );
    assert.deepEqual(
      sent.files.map((f) => f.name),
      ["front.zip", "back.zip"],
    );
    assert.deepEqual(sent.files[0].bytes, [...front]);
    assert.deepEqual(sent.files[1].bytes, [...back]);
    assert.ok(sent.manifest.every((m) => m.sha256.length === 64));
  }
  assert.equal(
    requests[0].md,
    requests[1].md,
    "same selected/confirmed MD bytes",
  );
  await page.getByRole("button",{name:"붓기 준비 완료 ›",exact:true}).click();
  await page.getByRole("heading",{name:"[붓기 준비 완료]",exact:true}).waitFor();
  await page.getByRole("tab",{name:"리포트 원문",exact:true}).click();
  await page.getByRole("heading",{name:"서버 최종 리포트",exact:true}).waitFor();
  await page.getByLabel("합의 범위와 제외 범위를 확인했습니다.",{exact:true}).check();
  await page.getByLabel("수정 자원·예상 공수·미확정 사항을 검토했습니다.",{exact:true}).check();
  await page.getByRole("button",{name:"이력에 등록",exact:true}).click();
  await page.waitForURL(/#\/history\/reg-server/);
  await page.getByRole("heading",{name:"서버 최종 리포트",exact:true}).waitFor();
  await page.reload();
  await page.getByRole("heading",{name:"서버 최종 리포트",exact:true}).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Server-contract browser test passed: no ZIP upload at settings; actual front/back bytes and hashes sent on both Mock and analysis; job polling/reference results; server report/registration/history reload; server HTML script blocked.",
  );
} finally {
  await browser.close();
  await server.close();
}
