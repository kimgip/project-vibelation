import test from "node:test";
import assert from "node:assert/strict";
import { blankRequest, requestTitle } from "../src/domain/types.ts";

const local = new Date(2026, 9, 18, 14, 20).toISOString();

test("titled requests keep their title", () => {
  assert.equal(requestTitle({ title: "FAQ 검색 개선", createdAt: local, updatedAt: local }), "FAQ 검색 개선");
});

test("untitled requests show local creation time, then last update", () => {
  assert.equal(requestTitle({ title: "", createdAt: local, updatedAt: "" }), "새 요청 · 10/18 14:20");
  assert.equal(requestTitle({ title: "  ", updatedAt: local }), "새 요청 · 10/18 14:20");
});

test("untitled requests without any time fall back", () => {
  assert.equal(requestTitle({ title: "", updatedAt: "" }), "제목 없는 요청");
});

test("new requests record createdAt without touching title", () => {
  const r = blankRequest();
  assert.equal(r.title, "");
  assert.ok(Number.isFinite(Date.parse(r.createdAt)));
});
