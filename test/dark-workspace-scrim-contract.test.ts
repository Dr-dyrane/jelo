import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

function occurrences(source: string, fragment: string) {
  return source.split(fragment).length - 1;
}

test("Me modal chrome uses neutral dark scrims without changing light scrims", async () => {
  const [accountSheet, meHome] = await Promise.all([
    readSource("components/me/shell/me-account-sheet.module.css"),
    readSource("components/me/home/me-home.module.css"),
  ]);

  assert.match(
    accountSheet,
    /\.dialog::backdrop\s*{\s*background: rgb\(54 29 26 \/ 34%\);/,
  );
  assert.match(accountSheet, /background: rgb\(54 29 26 \/ 58%\);/);
  assert.equal(occurrences(accountSheet, "background: var(--glass-scrim);"), 2);
  assert.equal(
    occurrences(accountSheet, "box-shadow: 0 30px 100px rgb(0 0 0 / 72%);"),
    2,
  );

  assert.match(
    meHome,
    /\.filterDialog::backdrop \{[\s\S]*?background: rgb\(52 32 29 \/ 38%\);/,
  );
  assert.equal(occurrences(meHome, "background: var(--glass-scrim);"), 2);
  assert.equal(
    occurrences(meHome, "box-shadow: 0 -30px 90px rgb(0 0 0 / 72%);"),
    2,
  );
});

test("Ops dropdowns and modal backdrops use the neutral dark foundation", async () => {
  const [opsShell, vocabulary, operators] = await Promise.all([
    readSource("app/(ops)/ops.module.css"),
    readSource("app/(ops)/ops/vocabulary/vocabulary.module.css"),
    readSource("app/(ops)/ops/operators/operators.module.css"),
  ]);

  assert.match(opsShell, /background: rgba\(255, 253, 249, 0\.82\);/);
  assert.match(
    opsShell,
    /:global\(html\[data-theme="dark"\]\) \.dropdownMenu \{\s*background: var\(--ops-instrument\);/,
  );
  assert.match(
    opsShell,
    /:global\(html:not\(\[data-theme="light"\]\)\) \.dropdownMenu \{\s*background: var\(--ops-instrument\);/,
  );
  assert.equal(
    occurrences(opsShell, "border-color: rgba(255, 255, 255, 0.08);"),
    2,
  );

  assert.match(
    vocabulary,
    /\.targetDialog::backdrop\s*{\s*background: rgba\(31, 23, 22, \.32\);/,
  );
  assert.equal(occurrences(vocabulary, "background: var(--glass-scrim);"), 2);

  assert.match(
    operators,
    /\.dialog::backdrop\s*{\s*background: rgba\(31, 23, 22, \.32\);/,
  );
  assert.equal(occurrences(operators, "background: var(--glass-scrim);"), 2);
});

test("shared workspace dock retains its light elevation and neutralizes dark elevation", async () => {
  const dock = await readSource(
    "components/workspace-shell/adaptive-workspace-dock.module.css",
  );

  assert.match(dock, /box-shadow: 0 14px 36px rgb\(107 59 53 \/ 16%\);/);
  assert.match(dock, /box-shadow: 0 12px 28px rgb\(107 59 53 \/ 20%\);/);
  assert.equal(
    occurrences(dock, "box-shadow: 0 14px 36px rgb(0 0 0 / 68%);"),
    2,
  );
});

test("Me routine cards keep their light surface and gain chromatic dark depth", async () => {
  const [home, routine] = await Promise.all([
    readSource("components/me/home/me-home.module.css"),
    readSource("components/me/routine/routine-manager.module.css"),
  ]);

  // Light cards use the shared paper token (no currentColor or non-token fallbacks).
  assert.match(
    routine,
    /background: color-mix\(in srgb, var\(--paper\) 78%, transparent\);/,
  );
  assert.equal(
    occurrences(
      home,
      "linear-gradient(160deg, var(--cream), var(--surface-2) 58%, var(--band));",
    ),
    2,
  );
  assert.equal(
    occurrences(
      home,
      "background: linear-gradient(145deg, var(--card-3), var(--card));",
    ),
    2,
  );
  // Dark chromatic depth is applied to each saved ritual (duplicated for the two dark selectors).
  assert.equal(
    occurrences(
      routine,
      "linear-gradient(145deg, var(--card-3), var(--card));",
    ),
    2,
  );
  assert.equal(
    occurrences(
      routine,
      "linear-gradient(145deg, var(--card-2), var(--surface-2));",
    ),
    2,
  );
  assert.ok(
    occurrences(routine, "background: var(--accent-solid);") >= 2,
    "accent-solid anchors the primary action in light and dark",
  );
  assert.equal(occurrences(routine, "background: var(--state-danger-bg);"), 2);
});
