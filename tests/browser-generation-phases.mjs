import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { createServer } = await import("vite");
const server = await createServer({ define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") }, server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/project-vibelation/`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  let input, count = 0, revision = 1;
  const docs = [], jobs = new Map(), requests = [];
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const body = req.method() === "POST" || req.method() === "PATCH" ? req.postDataJSON() : undefined;
    requests.push({ path, method: req.method(), body });
    const send = data => route.fulfill({ json: data });
    if (path === "/api/requests" && req.method() === "POST") return send({ id: "server-request" });
    if (path.endsWith("/requirement-documents")) return send({ items: docs, nextCursor: null });
    if (path.endsWith("/server-request")) {
      if (body?.input) { input = { ...body.input, requestId: "server-request", inputRevision: ++revision, attachmentNames: [] }; }
      return send({ id: "server-request", requestRevision: revision, inputRevision: revision, inputSnapshotId: `input-${revision}` });
    }
    if (path.endsWith("/requirement-generations")) {
      const number = ++count, id = `job-${number}`;
      assert.deepEqual(body, { inputSnapshotId: `input-${revision}`, expectedInputRevision: revision });
      const job = { id, generationNumber: number, status: "queued", phase: "queued", idempotencyKey: req.headers()["idempotency-key"], inputSnapshot: { ...input }, contextDocumentIds: docs.length ? [docs[0].id] : [], displayTitle: input.title, createdAt: new Date().toISOString() };
      jobs.set(id, { job, polls: 0 }); return send(job);
    }
    if (path.includes("/requirement-generations/")) {
      const state = jobs.get(path.split("/").at(-1));
      state.polls++;
      if (state.polls < 4) return send({ ...state.job, status: "running", phase: state.job.generationNumber === 1 ? "generating" : "merging_previous" });
      const g = state.job;
      g.document ||= { id: `doc-${g.generationNumber}`, generationId: g.id, generationNumber: g.generationNumber, inputRevision: g.inputSnapshot.inputRevision, inputSnapshot: g.inputSnapshot, displayTitle: g.displayTitle, contextDocumentIds: g.contextDocumentIds, markdown: `# ${g.displayTitle}_version${g.generationNumber}\n\n## 기능 요구사항\n- 새 요구사항`, createdAt: g.createdAt, formatVersion: "requirement-v5", source: "server" };
      if (!docs.some(d => d.id === g.document.id)) docs.unshift(g.document);
      return send({ ...g, status: "succeeded", phase: "completed" });
    }
    return route.fulfill({ status: 404, json: { error: { message: `Unexpected ${path}` } } });
  });
  await page.goto(base);
  await page.getByRole("button", { name: /시작하기/ }).click();
  await page.getByRole("button", { name: "신규 레거시 스타일로 새 화면" }).click();
  await page.getByLabel("요청 제목", { exact: true }).fill("서버 버전업");
  await page.getByRole("button", { name: "쇳물 녹이기 ›", exact: true }).click();
  await page.locator("#sourceText").fill("최초 요구사항");
  await page.getByRole("button", { name: "성분 보기 ›", exact: true }).click();
  await page.getByText("요구사항 정리 중…", { exact: true }).waitFor();
  assert.equal(await page.getByText("이전 버전과 합치는 중입니다…", { exact: true }).count(), 0);
  await page.getByText("서버 버전업_version1.md", { exact: true }).waitFor();
  await page.getByRole("button", { name: "‹ 쇳물 녹이기", exact: true }).click();
  await page.locator("#sourceText").fill("추가 요구사항");
  assert.equal(count, 1, "going back does not generate");
  assert.equal(await page.getByText("이전 버전과 합치는 중입니다…", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "성분 보기 ›", exact: true }).click();
  await page.getByText("이전 버전과 합치는 중입니다…", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("서버 버전업_version2.md", { exact: true }).waitFor();
  assert.equal(count, 2, "refresh recovers the existing Job");
  const postBodies = requests.filter(r => r.path.endsWith("/requirement-generations") && r.method === "POST").map(r => r.body);
  assert.equal(postBodies.length, 2);
  assert.ok(postBodies.every(b => !b.markdown && !b.html && !b.legacyVersion), "generation starts with snapshot references only");
  assert.deepEqual(errors, []);
  console.log("Server phase browser passed: no merge on first generation/back navigation; real merging phase only on repeat; refresh recovers same job; snapshot-based MD API.");
} finally { await browser.close(); await server.close(); }
