import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("concern stories keep reviewed guidance readable without truncation or fixed-row overlap", async () => {
  const source = await readFile(
    path.join(process.cwd(), "app/(site)/share/concern/[slug]/route.tsx"),
    "utf8",
  );

  assert.match(source, /fontSize:\s*32/);
  assert.match(source, /fontSize:\s*28/);
  assert.match(source, /flexDirection:\s*["']column["']/);
  assert.match(source, /flexWrap:\s*["']wrap["']/);
  assert.match(source, /maxWidth:\s*["']100%["']/);
  assert.doesNotMatch(source, /ingredient\.slice|whiteSpace:\s*["']nowrap["']/);
  assert.doesNotMatch(source, /top:\s*540|top:\s*640/);
});
