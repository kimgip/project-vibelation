import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "vite";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
  define: {
    "import.meta.env.VITE_GENERATION_API_URL": JSON.stringify("/test-api"),
  },
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
  let mockNetworkFailure = true, analysisNetworkFailure = true;
  await page.route("**/test-api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
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
          result: {
            id: "analysis-result",
            confirmationId: confirmation,
            requirementDocumentId: selectedDoc,
            legacyVersion: version,
            impacts: [
              {
                id: "ui",
                type: "UI",
                name: "서버 자원",
                path: "front/index.html",
                current: "기존 화면",
                proposed: "변경 화면",
                reason: "선택 MD 기준",
                days: 1,
              },
            ],
            totalDays: 1,
            durationDays: 1,
            bufferDays: 0,
          },
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
  await page.getByLabel("코드 분류", { exact: true }).selectOption("backend");
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
  await page.getByRole("button", { name: "시작하기 >", exact: true }).click();
  await page.getByRole("button", { name: /전송 테스트 코드/ }).click();
  await page.getByRole("button", { name: "다음 >", exact: true }).click();
  await page.getByRole("button", { name: "샘플 불러오기" }).click();
  await page
    .getByRole("button", { name: "요구사항 정리하기 >", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "[쇳물 성분 보기]", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "이 문서로 협의하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "레거시에 맞춰 Mock 만들기 >", exact: true })
    .click();
  await page
    .getByRole("button", { name: "시스템 적용 Mock 생성", exact: true })
    .click();
  await page.getByRole("button", {name:"같은 작업 다시 확인",exact:true}).click();
  await page.getByText("서버 생성 HTML", { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(() => window.__untrustedServerScript),
    undefined,
    "server HTML cannot execute in app",
  );
  await page
    .getByRole("button", {
      name: "요구사항 확정 후 분석하기",
      exact: true,
    })
    .click();
  await page.getByText("서버 요청에 실패했습니다 (503).",{exact:false}).waitFor();
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
  assert.deepEqual(errors, []);
  console.log(
    "Server-contract browser test passed: no ZIP upload at settings; actual front/back bytes and hashes sent on both Mock and analysis; job polling/result validation; server HTML script blocked.",
  );
} finally {
  await browser.close();
  await server.close();
}
