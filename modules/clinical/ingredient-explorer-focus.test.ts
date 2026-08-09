import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ingredientExplorer = readFileSync(
  "components/ingredients/ingredient-explorer.tsx",
  "utf8",
);

test("a filtered hash-opened ingredient restores focus to a visible library control", () => {
  assert.match(ingredientExplorer, /!triggerRef\.current\?\.isConnected/);
  assert.match(ingredientExplorer, /viewButtons\.current\.get\(view\)/);
  assert.match(ingredientExplorer, /triggerRef\.current = opener \?\? null/);
});
