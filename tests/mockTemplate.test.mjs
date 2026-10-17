import test from "node:test";
import assert from "node:assert/strict";
import { renderMockTemplate } from "../src/mocks/template.ts";

test("Mock templates preserve inserted text verbatim and reject unsupported placeholders", () => {
  const input = "{{title}} <script>example</script> $&";
  assert.equal(
    renderMockTemplate("{{text}} · {{count}}", { text: input, count: 2 }),
    input + " · 2",
  );
  assert.throws(() => renderMockTemplate("{{unknown}}", {}), /unknown/);
});
