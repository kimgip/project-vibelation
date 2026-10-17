import test from "node:test";
import assert from "node:assert/strict";
import { validDueDate } from "../src/domain/requestDetails.ts";
import { blankRequest, editRequest } from "../src/domain/types.ts";
test("due date permits optional empty and real four-digit calendar dates", () => {
  for (const date of [
    "",
    "0001-01-01",
    "9999-12-31",
    "2028-02-29",
    "2000-02-29",
  ])
    assert.equal(validDueDate(date), true, date);
  for (const date of [
    "202609-10-31",
    "10000-01-01",
    "0000-01-01",
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-1-01",
  ])
    assert.equal(validDueDate(date), false, date);
});
test("editing rejects invalid date without changing persisted request data", () => {
  const r = blankRequest(),
    before = structuredClone(r);
  assert.throws(() => editRequest(r, { dueDate: "202609-10-31" }), /4자리/);
  assert.deepEqual(r, before);
});
