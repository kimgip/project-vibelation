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
    assert.ok(html.includes("connect-src 'none'"));
    assert.ok(!/https?:\/\//.test(html));
  } finally {
    globalThis.document = oldDocument;
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    globalThis.setTimeout = oldTimer;
  }
});

test("standalone HTML handles cross-category selection limit, search and result scenarios", () => {
  const element = () => ({
    children: [],
    value: "",
    dataset: {},
    textContent: "",
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren() {
      this.children = [];
    },
    setAttribute() {},
  });
  const ids = Object.fromEntries(
    [
      "cards",
      "result",
      "search",
      "count",
      "language",
      "download",
      "scenario",
    ].map((id) => [id, element()]),
  );
  ids.language.value = "ENG";
  ids.scenario.value = "success";
  const categories = ["catalog", "guide"].map((category) => ({
    ...element(),
    dataset: { category },
  }));
  const document = {
    getElementById: (id) => ids[id],
    createElement: element,
    querySelectorAll: () => categories,
  };
  const code = communicationHtml().match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(code, { document });
  ids.download.onclick();
  assert.match(ids.result.textContent, /먼저 선택/);
  const selectAll = () =>
    ids.cards.children.forEach((card) => {
      const check = card.children[0];
      check.checked = true;
      check.onchange();
    });
  selectAll();
  categories[1].onclick();
  selectAll();
  assert.equal(ids.count.textContent, "선택 자료 10 / 10");
  assert.equal(ids.cards.children[4].children[0].checked, false);
  ids.download.onclick();
  assert.match(ids.result.textContent, /10개 자료의 ENG/);
  ids.scenario.value = "partial";
  ids.download.onclick();
  assert.match(ids.result.textContent, /누락/);
  ids.scenario.value = "failure";
  ids.download.onclick();
  assert.match(ids.result.textContent, /실패/);
  ids.search.value = "없는 자료";
  ids.search.oninput();
  assert.equal(ids.cards.textContent, "검색 결과가 없습니다.");
});
