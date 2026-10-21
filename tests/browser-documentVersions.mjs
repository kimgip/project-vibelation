import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "vite";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
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
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("button", { name: "시작하기 >", exact: true }).click();
  await page.getByLabel("요청 제목", { exact: true }).fill("문서 버전별 자료");
  await page.getByRole("button", { name: "다음 >", exact: true }).click();
  await page
    .getByLabel("Teams 대화", { exact: true })
    .fill("첫 번째 요청 원문");
  await page.getByText("+ 자료 추가", { exact: true }).click();
  await page
    .getByRole("button", { name: "HTML 화면 시안", exact: true })
    .click();
  await page
    .getByLabel("HTML 코드", { exact: true })
    .fill("<h1>첫 번째 화면</h1>");
  await page
    .getByRole("button", { name: "PPT · 자료 첨부", exact: true })
    .click();
  await page
    .getByLabel("자료 첨부", { exact: true })
    .setInputFiles({
      name: "first.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("first attachment"),
    });
  await page.getByText("전송 처리 완료", { exact: false }).waitFor();
  await page
    .getByRole("button", { name: "요구사항 정리하기 >", exact: true })
    .click();
  const first = page.getByRole("region", { name: "입력 자료 v1", exact: true });
  await first.waitFor();
  assert.equal(
    await first.getByLabel("생성 당시 텍스트", { exact: true }).inputValue(),
    "첫 번째 요청 원문",
  );
  await page
    .getByRole("button", { name: "< 자료 추가/수정하기", exact: true })
    .click();
  await page
    .getByLabel("Teams 대화", { exact: true })
    .fill("두 번째 수정 원문");
  await page
    .getByLabel("HTML 코드", { exact: true })
    .fill("<h1>두 번째 화면</h1>");
  await page
    .getByRole("button", { name: "first.txt 제외", exact: true })
    .click();
  await page
    .getByLabel("자료 첨부", { exact: true })
    .setInputFiles({
      name: "second.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("second attachment"),
    });
  await page.getByText("전송 처리 완료", { exact: false }).waitFor();
  await page
    .getByRole("button", { name: "요구사항 정리하기 >", exact: true })
    .click();
  const second = page.getByRole("region", {
    name: "입력 자료 v2",
    exact: true,
  });
  await second.waitFor();
  assert.equal(
    await second.getByLabel("생성 당시 텍스트", { exact: true }).inputValue(),
    "두 번째 수정 원문",
  );
  await page.getByText("문서 이력 ·", { exact: false }).click();
  await page
    .getByRole("button", { name: /요구사항 v1 · 입력 자료 v1/ })
    .click();
  await first.waitFor();
  assert.equal(
    await first.getByLabel("생성 당시 텍스트", { exact: true }).inputValue(),
    "첫 번째 요청 원문",
  );
  await first.getByRole("button", { name: "HTML 코드", exact: true }).click();
  assert.equal(
    await first.getByLabel("생성 당시 HTML 코드", { exact: true }).inputValue(),
    "<h1>첫 번째 화면</h1>",
  );
  await first
    .getByRole("button", { name: "첨부파일 (1)", exact: true })
    .click();
  assert.equal(await first.getByText("first.txt", { exact: true }).count(), 1);
  assert.equal(await first.getByText("second.txt", { exact: true }).count(), 0);
  assert.equal(
    await page.getByText("현재 협의 기준", { exact: true }).count(),
    0,
    "viewing must not apply MD",
  );
  await page
    .getByRole("button", { name: "< 자료 추가/수정하기", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Teams 대화", { exact: true }).inputValue(),
    "두 번째 수정 원문",
    "viewing must not overwrite current input",
  );
  assert.equal(
    await page.getByLabel("HTML 코드", { exact: true }).inputValue(),
    "<h1>두 번째 화면</h1>",
  );
  assert.equal(await page.getByText("second.txt", { exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    "Document versions passed: v1/v2 paired input versions; exact text/HTML/file list snapshots; current draft and MD selection unchanged.",
  );
} finally {
  await browser.close();
  await server.close();
}
