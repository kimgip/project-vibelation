import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareSourceArchive,
  generationFormData,
} from "../src/domain/legacySources.ts";
import { createGenerationTransport } from "../src/services/generationTransport.ts";

const zip = (name, text) =>
  new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04]), text], name, {
    type: "application/zip",
  });
test("source ZIP validation rejects renamed text, empty and non-ZIP files", async () => {
  await assert.rejects(
    prepareSourceArchive(new File(["text"], "source.zip"), "frontend"),
    /ZIP/,
  );
  await assert.rejects(
    prepareSourceArchive(new File([], "source.zip"), "backend"),
    /빈 파일/,
  );
  await assert.rejects(
    prepareSourceArchive(new File(["x"], "source.txt"), "frontend"),
    /zip/,
  );
});
test("both generation routes transmit the exact MD and each classified ZIP byte sequence", async () => {
  const front = await prepareSourceArchive(
    zip("front.zip", "front bytes"),
    "frontend",
  );
  const back = await prepareSourceArchive(
    zip("back.zip", "back bytes"),
    "backend",
  );
  const md = new File(["# 요구사항\n선택한 원문"], "requirements.md", {
    type: "text/markdown",
  });
  const calls = [];
  const transport = createGenerationTransport(
    "https://example.test/api/",
    async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ id: "job-1", status: "queued" }), {
        status: 202,
      });
    },
  );
  for (const path of [
    "/requests/r/system-mock-generations",
    "/requests/r/requirement-confirmations/c/analysis-jobs",
  ])
    await transport.start(
      path,
      md,
      [front, back],
      "zip:fixed",
      "retry-key",
      new AbortController().signal,
    );
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.ok(url.startsWith("https://example.test/api/requests/"));
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Idempotency-Key"], "retry-key");
    assert.equal(
      options.headers["Content-Type"],
      undefined,
      "browser must generate multipart boundary",
    );
    assert.equal(await options.body.get("file").text(), await md.text());
    const files = options.body.getAll("sourceFiles");
    assert.deepEqual(
      await files[0].arrayBuffer(),
      await front.file.arrayBuffer(),
    );
    assert.deepEqual(
      await files[1].arrayBuffer(),
      await back.file.arrayBuffer(),
    );
    const manifest = JSON.parse(options.body.get("sourceManifest"));
    assert.deepEqual(
      manifest.map((x) => x.role),
      ["frontend", "backend"],
    );
    assert.equal(manifest[0].sha256, front.sha256);
    assert.equal(options.body.get("legacyVersion"), "zip:fixed");
    assert.equal(options.body.has("html"), false);
  }
});
test("server generation cannot silently omit source files and preserves server errors", async () => {
  let calls = 0;
  const client = createGenerationTransport("https://example.test", async () => {
    calls++;
    return new Response("", { status: 413 });
  });
  const md = new File(["# MD"], "requirements.md");
  await assert.rejects(
    client.start(
      "/generate",
      md,
      [],
      "zip:v",
      "k",
      new AbortController().signal,
    ),
    /코드 ZIP/,
  );
  assert.equal(calls, 0);
  const archive = await prepareSourceArchive(zip("front.zip", "x"), "frontend");
  await assert.rejects(
    client.start(
      "/generate",
      md,
      [archive],
      "zip:v",
      "k",
      new AbortController().signal,
    ),
    /413/,
  );
});
test("code manifests preserve order and filenames without changing MD content", async () => {
  const archive = await prepareSourceArchive(
    zip("한글 source.zip", "body"),
    "frontend",
  );
  const body = generationFormData(
    new File(["unaltered"], "requirements.md"),
    [archive],
    "zip:old",
  );
  assert.equal(body.getAll("sourceFiles")[0].name, "한글 source.zip");
  assert.equal(JSON.parse(body.get("sourceManifest"))[0].index, 0);
  assert.equal(await body.get("file").text(), "unaltered");
});
