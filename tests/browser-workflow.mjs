import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { createServer } = await import("vite");
const server = process.env.TEST_BASE_URL
  ? undefined
  : await createServer({
      server: { host: "127.0.0.1", port: 0 },
      logLevel: "error",
    });
await server?.listen();
const port = server?.httpServer.address().port;
const base =
  process.env.TEST_BASE_URL || `http://127.0.0.1:${port}/project-vibelation/`;
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole("button", { name: "시작하기 >", exact: true }).click();
  const titleInput = page.getByLabel("요청 제목", { exact: true });
  await titleInput.pressSequentially("다운로드 센터 검토");
  assert.equal(await titleInput.isVisible(), true);
  assert.equal(
    await titleInput.evaluate((el) => el === document.activeElement),
    true,
  );
  const storedDetails = () =>
    page.evaluate(() => {
      const request = JSON.parse(localStorage.getItem("vibelation.requests.v4"))
        .items[0];
      return { title: request.title, dueDate: request.dueDate };
    });
  assert.deepEqual(
    await storedDetails(),
    { title: "", dueDate: "" },
    "typing must not save",
  );
  const dateInput = page.getByLabel("희망 완료일", { exact: true });
  await dateInput.fill("2026-10-31");
  assert.deepEqual(await storedDetails(), { title: "", dueDate: "" });
  await page
    .getByRole("button", { name: "요청 정보 저장", exact: true })
    .click();
  assert.deepEqual(await storedDetails(), {
    title: "다운로드 센터 검토",
    dueDate: "2026-10-31",
  });
  await dateInput.fill("202609-10-31");
  assert.equal(
    await dateInput.inputValue(),
    "2026-10-31",
    "six-digit year must not remain in input",
  );
  assert.equal((await storedDetails()).dueDate, "2026-10-31");
  await titleInput.fill("취소할 제목");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(await titleInput.inputValue(), "다운로드 센터 검토");
  await page.screenshot({ path: "test-results/01-legacy.png", fullPage: true });
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
  await page.getByText("현재 협의 기준", { exact: true }).waitFor();
  await page.screenshot({
    path: "test-results/02-requirements.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Mock 없이 요구사항 확정 후 분석하기",
      exact: true,
    })
    .click();
  await page.locator(".resource").first().waitFor();
  await page.locator(".resource").nth(1).click();
  await page.screenshot({
    path: "test-results/03-analysis.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "최종 리포트 생성하기 >", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "[붓기 준비 완료]", exact: true })
    .waitFor();
  for (const tab of ["영향 자원", "유사사례", "리포트 원문", "검토 요약"])
    await page.getByRole("tab", { name: tab, exact: true }).click();
  await page
    .getByLabel("합의 범위와 제외 범위를 확인했습니다.", { exact: true })
    .check();
  await page
    .getByLabel("수정 자원·예상 공수·미확정 사항을 검토했습니다.", {
      exact: true,
    })
    .check();
  await page.screenshot({ path: "test-results/04-review.png", fullPage: true });
  await page
    .getByRole("button", { name: "검토 이력에 등록하기", exact: true })
    .click();
  await page.waitForURL(/#\/history\//);
  await page.goto(base + "#/settings/legacy");
  await page.getByLabel("시스템 이름", { exact: true }).fill("코드 ZIP 테스트");
  await page
    .getByLabel("어떤 시스템인가요?", { exact: true })
    .fill("업무 화면 코드");
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]);
  await page.getByLabel("코드 ZIP 추가", { exact: true }).setInputFiles({
    name: "front.zip",
    mimeType: "application/zip",
    buffer: bytes,
  });
  await page
    .getByText("코드 ZIP을 브라우저에 보관했습니다.", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "틀 등록 · 변경사항 적용", exact: true })
    .click();
  await page
    .getByText("새 코드 기준을 적용했습니다.", { exact: false })
    .waitFor();
  await page.reload();
  await page
    .getByLabel("등록된 시스템 틀", { exact: true })
    .selectOption({ label: "코드 ZIP 테스트 · 적용됨" });
  assert.equal(await page.getByText("front.zip", { exact: true }).count(), 1);
  const original = await page.evaluate(async (baseUrl) => {
    const { legacyRepository } = await import(
      new URL("src/storage/legacySources.ts", baseUrl).href
    );
    const ref = (await legacyRepository.references())[0];
    return {
      id: ref.id,
      hash: ref.archives[0].sha256,
      bytes: [...new Uint8Array(await ref.archives[0].file.arrayBuffer())],
    };
  }, base);
  await page
    .getByLabel("front.zip 교체", { exact: true })
    .setInputFiles({
      name: "front-v2.zip",
      mimeType: "application/zip",
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 40, 41]),
    });
  await page.getByText("front-v2.zip", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "틀 등록 · 변경사항 적용", exact: true })
    .click();
  await page
    .getByText("새 코드 기준을 적용했습니다.", { exact: false })
    .waitFor();
  const preserved = await page.evaluate(
    async ({ baseUrl, oldId }) => {
      const { legacyRepository } = await import(
        new URL("src/storage/legacySources.ts", baseUrl).href
      );
      const ref = await legacyRepository.reference(oldId);
      const system = (await legacyRepository.systems())[0];
      let conflict = false;
      try {
        await legacyRepository.save(
          { ...system, name: "must not overwrite" },
          0,
        );
      } catch {
        conflict = true;
      }
      return {
        id: ref.id,
        hash: ref.archives[0].sha256,
        bytes: [...new Uint8Array(await ref.archives[0].file.arrayBuffer())],
        conflict,
        name: (await legacyRepository.systems())[0].name,
        count: (await legacyRepository.references()).length,
      };
    },
    { baseUrl: base, oldId: original.id },
  );
  assert.deepEqual(
    { id: preserved.id, hash: preserved.hash, bytes: preserved.bytes },
    original,
  );
  assert.equal(preserved.conflict, true);
  assert.equal(preserved.name, "코드 ZIP 테스트");
  assert.equal(preserved.count, 2);
  await page.screenshot({
    path: "test-results/05-settings.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/06-settings-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "settings mobile overflow",
  );
  await page.goto(base);
  await page.getByRole("button", { name: "시작하기 >", exact: true }).click();
  await page
    .getByRole("button", { name: /코드 ZIP 테스트/ })
    .first()
    .click();
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
  await page
    .locator('iframe[title="시스템 적용 예상 화면 미리보기"]')
    .waitFor();
  await page.reload();
  await page
    .locator('iframe[title="시스템 적용 예상 화면 미리보기"]')
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "preview mobile overflow",
  );
  await page.screenshot({
    path: "test-results/07-preview-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Browser workflow passed: MD → optional Mock skip → analysis → report → registration; ZIP persistence/selection; optional Mock/reload; 390px overflow; no page errors.",
  );
} finally {
  await browser.close();
  await server?.close();
}
