import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { communicationHtml } from "../src/utils/communicationHtml.ts";
import { downloadHtml } from "../src/utils/downloads.ts";

test("downloaded HTML is exactly the displayed standalone document", async () => {
  const html = communicationHtml();
  const oldDocument = globalThis.document,
    oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL,
    oldTimer = globalThis.setTimeout;
  let blob,
    clicked = false,
    anchor;
  try {
    globalThis.document = {
      createElement: () =>
        (anchor = {
          click() {
            clicked = true;
          },
        }),
    };
    URL.createObjectURL = (value) => {
      blob = value;
      return "blob:demo";
    };
    URL.revokeObjectURL = () => {};
    globalThis.setTimeout = (fn) => {
      fn();
      return 0;
    };
    downloadHtml("현업/협의", html);
    assert.equal(clicked, true);
    assert.equal(anchor.download, "현업_협의-시스템적용예상화면.html");
    assert.equal(blob.type, "text/html;charset=utf-8");
    assert.equal(await blob.text(), html);

    assert.ok(!/https?:\/\//.test(html));
  } finally {
    globalThis.document = oldDocument;
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    globalThis.setTimeout = oldTimer;
  }
});

test("catalog preview fixture includes executable modal, language and paging controls", () => {
  const html = communicationHtml();
  for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  for (const name of ["openMaterialPreviewModal", "movePreviewPage", "renderPreviewAll", "materialPreviewModal"]) assert.ok(html.includes(name), name);
});
