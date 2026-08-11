import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * Guards against the whole class of bug behind two real regressions:
 *
 * 1. The /share trend chart used `motion.path` with `whileInView` +
 *    `pathLength: 0 → 1`. The server rendered the initial hidden state
 *    (`stroke-dasharray="0 1"`), and the animation never reliably completed
 *    on hydration — the chart lines stayed invisible in production.
 * 2. `SwipeableRail`, `KenBurns`, and `Stamp` used the same `whileInView`
 *    prop pattern for opacity/scale entrances, carrying the identical risk:
 *    an element that mounts already in the viewport (very common with
 *    Next.js client-side navigation) can render permanently in its
 *    `initial` state if the IntersectionObserver-backed prop doesn't fire.
 *
 * `Reveal` and `Stagger` already establish the safe pattern: track
 * intersection with the `useInView` hook and drive `animate` from that
 * boolean, so a mount that's already in view finishes ready-visible instead
 * of possibly invisible.
 *
 * This test scans every `.tsx` file under `app/` and `components/` — not
 * just the one file that broke — so a new component can't reintroduce the
 * same failure mode undetected.
 */

const SCAN_DIRS = ["app", "components"];
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", ".git"]);

async function collectTsxFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsxFiles(fullPath)));
    } else if (entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("no component uses the framer-motion whileInView prop directly", async () => {
  const root = process.cwd();
  const files = (
    await Promise.all(
      SCAN_DIRS.map((dir) => collectTsxFiles(path.join(root, dir))),
    )
  ).flat();
  assert.ok(files.length > 50, "expected the scan to find many .tsx files");

  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    // Matches the JSX prop assignment (`whileInView={...}` or `whileInView="..."`),
    // not prose mentions of the word in comments (e.g. "instead of whileInView prop").
    if (/\bwhileInView\s*=\s*[{"']/.test(source)) {
      offenders.push(path.relative(root, file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "whileInView renders its initial (often invisible) state on the server " +
      "and does not reliably animate on hydration when the element mounts " +
      "already in the viewport. Use the useInView hook pattern from " +
      "components/motion/reveal.tsx instead.",
  );
});

test("motion.path elements never animate pathLength without a useInView guard", async () => {
  const root = process.cwd();
  const files = (
    await Promise.all(
      SCAN_DIRS.map((dir) => collectTsxFiles(path.join(root, dir))),
    )
  ).flat();

  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    // Matches the framer-motion object-property form (`pathLength: 0`),
    // not the plain SVG normalization attribute (`pathLength="100"`) used
    // by static dash-array donut/arc charts, which is a different, safe
    // pattern unrelated to viewport-triggered animation.
    if (!/pathLength\s*:\s*[01]/.test(source)) continue;
    // Any file that animates pathLength must gate it on an explicit,
    // testable inView boolean rather than an uncontrolled viewport prop.
    if (!/useInView/.test(source)) {
      offenders.push(path.relative(root, file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "pathLength animation without useInView risks the same invisible-on-" +
      "mount bug fixed in components/product-trends/product-trends-chart.tsx.",
  );
});
