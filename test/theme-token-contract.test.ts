import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const LIGHT_ROOT_BLOCKS_SHA256 =
  "10b06dd4ff6c03e40236abe00db8075fa699f884943050e92f1023f9e58184d4";

const expectedDarkTokens = {
  "--ink": "#fff7f4",
  "--muted": "#c6b0ad",
  "--cream": "#000",
  "--surface-2": "#0d090b",
  "--paper": "#171214",
  "--surface-3": "#21171b",
  "--card": "var(--paper)",
  "--card-2": "#1b1417",
  "--card-3": "var(--surface-3)",
  "--border": "rgba(255,160,163,.17)",
  "--peach": "#5a2925",
  "--rose": "#672438",
  "--wine": "#ff9aa5",
  "--accent-solid": "#ff9aa5",
  "--on-accent": "#21070d",
  "--band": "#080305",
  "--on-band": "#fff7f4",
  "--band-muted": "#c6b0ad",
  "--ghost-bg": "rgba(255,154,165,.09)",
  "--tag-bg": "rgba(45,18,28,.78)",
  "--visual-lg-bg": "rgba(255,118,139,.055)",
  "--card-glass": "rgba(26,15,20,.86)",
  "--wash-a": "#080305",
  "--wash-b": "#16070d",
  "--wash-c": "#2b0c18",
  "--wash-hero": "#36101a",
  "--wash-consult": "#281018",
  "--orb1-a": "#1b0710",
  "--orb1-b": "#672438",
  "--orb2-a": "#14070b",
  "--orb2-b": "#5a2925",
  "--ghost-word": "rgba(255,128,145,.1)",
  "--shadow": "0 30px 90px rgba(0,0,0,.72),0 0 80px rgba(130,33,66,.08)",
  "--shot-shadow": "rgba(0,0,0,.62)",
  "--state-success": "#7cc79b",
  "--state-success-bg": "rgba(124,199,155,.14)",
  "--state-warning": "#e6b877",
  "--state-warning-bg": "rgba(230,184,119,.14)",
  "--state-danger": "#ff8a7a",
  "--state-danger-bg": "rgba(255,138,122,.14)",
  "--state-info": "var(--wine)",
  "--state-info-bg": "rgba(255,154,165,.14)",
  "--state-selected-bg": "color-mix(in srgb, var(--wine) 14%, transparent)",
  "--elevation-1": "0 10px 26px rgba(0,0,0,.45)",
  "--elevation-2": "0 14px 40px rgba(0,0,0,.5)",
  "--elevation-3": "0 20px 50px rgba(0,0,0,.55)",
  "--elevation-4": "0 30px 90px rgba(0,0,0,.55)",
  "--glass-scrim": "rgba(0,0,0,.64)",
  "--ops-canvas": "#000",
  "--ops-instrument": "rgba(28,28,28,.72)",
  "--ops-workspace": "#121212",
  "--ops-surface-subtle": "#1c1c1c",
  "--ops-product-stage": "#262626",
  "--ops-ink": "#f5f5f5",
  "--ops-muted": "#b3b3b3",
  "--ops-workspace-shadow": "0 18px 48px rgba(0,0,0,.52)",
  "--ops-instrument-shadow": "0 10px 26px rgba(0,0,0,.48)",
  "--ops-floating-shadow": "0 20px 50px rgba(0,0,0,.68)",
  "--ops-accent": "#dedede",
  "--ops-accent-subtle": "rgba(222,222,222,.14)",
  "--ops-action": "#8aa9e6",
  "--ops-action-subtle": "rgba(138,169,230,.14)",
  "--ops-focus-ring": "#8aa9e6",
} as const;

function extractBalancedBlock(source: string, start: number) {
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, "expected an opening brace");

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail("expected a balanced CSS block");
}

function blocksFor(source: string, selector: RegExp) {
  return [...source.matchAll(selector)].map((match) =>
    extractBalancedBlock(source, match.index),
  );
}

function normalizeCssValue(value: string) {
  return value
    .trim()
    .replace(/,\s*/g, ",")
    .replace(/\b0\.(\d+)/g, ".$1");
}

function declarations(blocks: string[]) {
  const tokens: Record<string, string> = {};

  for (const block of blocks) {
    for (const match of block.matchAll(/(--[\w-]+):([^;]+);/g)) {
      tokens[match[1]] = normalizeCssValue(match[2]);
    }
  }

  return tokens;
}

function luminance(hex: string) {
  const shorthand = /^#([\da-f])([\da-f])([\da-f])$/i.exec(hex);
  const normalized = shorthand
    ? `#${shorthand[1]}${shorthand[1]}${shorthand[2]}${shorthand[2]}${shorthand[3]}${shorthand[3]}`
    : hex;
  const channels = normalized.match(/[\da-f]{2}/gi);
  assert.ok(
    channels && channels.length === 3,
    `expected an RGB hex color, received ${hex}`,
  );

  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("dark theme branches share the exact chromatic black token contract", async () => {
  const css = await readFile(
    path.join(process.cwd(), "app/globals.css"),
    "utf8",
  );
  const systemDarkMedia = blocksFor(
    css,
    /^@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/gm,
  );
  const systemDarkTokens = declarations(
    systemDarkMedia.flatMap((block) =>
      blocksFor(block, /:root:not\(\[data-theme="light"\]\)\s*\{/g),
    ),
  );
  const explicitDarkTokens = declarations(
    blocksFor(css, /^:root\[data-theme="dark"\]\s*\{/gm),
  );
  const normalizedExpectedDarkTokens = Object.fromEntries(
    Object.entries(expectedDarkTokens).map(([token, value]) => [
      token,
      normalizeCssValue(value),
    ]),
  );

  assert.deepEqual(systemDarkTokens, normalizedExpectedDarkTokens);
  assert.deepEqual(explicitDarkTokens, normalizedExpectedDarkTokens);
});

test("dark environment keeps a black canvas, chromatic depth, and WCAG contrast", async () => {
  const chromaticTokens = [
    "--paper",
    "--surface-2",
    "--surface-3",
    "--card-2",
    "--peach",
    "--rose",
    "--wine",
    "--wash-a",
    "--wash-b",
    "--wash-c",
    "--wash-hero",
    "--wash-consult",
    "--ops-action",
    "--ops-focus-ring",
  ] as const;
  const neutralOpsTokens = [
    "--ops-canvas",
    "--ops-workspace",
    "--ops-surface-subtle",
    "--ops-product-stage",
    "--ops-accent",
  ] as const;

  assert.equal(expectedDarkTokens["--cream"], "#000");
  for (const token of chromaticTokens) {
    const value = expectedDarkTokens[token];
    const channels =
      value.length === 4
        ? [value[1], value[2], value[3]]
        : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)];
    assert.ok(
      new Set(channels).size > 1,
      `${token} must retain intentional colour`,
    );
  }
  for (const token of neutralOpsTokens) {
    const value = expectedDarkTokens[token];
    const channels =
      value.length === 4
        ? [value[1], value[2], value[3]]
        : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)];
    assert.equal(
      new Set(channels).size,
      1,
      `${token} must remain operationally neutral`,
    );
  }

  assert.equal(expectedDarkTokens["--card"], "var(--paper)");
  assert.equal(expectedDarkTokens["--card-3"], "var(--surface-3)");
  assert.ok(
    contrast(expectedDarkTokens["--ink"], expectedDarkTokens["--surface-3"]) >=
      4.5,
  );
  assert.ok(
    contrast(expectedDarkTokens["--muted"], expectedDarkTokens["--peach"]) >=
      4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--on-accent"],
      expectedDarkTokens["--accent-solid"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(expectedDarkTokens["--ink"], expectedDarkTokens["--rose"]) >= 4.5,
  );
  assert.ok(
    contrast(expectedDarkTokens["--wine"], expectedDarkTokens["--surface-3"]) >=
      3,
  );
  assert.notEqual(
    expectedDarkTokens["--state-danger"],
    expectedDarkTokens["--wine"],
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--ops-ink"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--ops-muted"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--ops-accent"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--ops-action"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--on-accent"],
      expectedDarkTokens["--ops-action"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--ops-focus-ring"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 3,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--state-success"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--state-warning"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--state-danger"],
      expectedDarkTokens["--ops-product-stage"],
    ) >= 4.5,
  );
});

test("Operations keeps cobalt interaction roles separate from neutral data marks", async () => {
  const [shell, activity, operators, inbox, overview, careEvidence] =
    await Promise.all([
      readFile(path.join(process.cwd(), "app/(ops)/ops.module.css"), "utf8"),
      readFile(
        path.join(process.cwd(), "app/(ops)/ops/activity/activity.module.css"),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "app/(ops)/ops/operators/operators.module.css",
        ),
        "utf8",
      ),
      readFile(
        path.join(process.cwd(), "components/ops/inbox/inbox.module.css"),
        "utf8",
      ),
      readFile(
        path.join(process.cwd(), "app/(ops)/ops/overview.module.css"),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "app/(ops)/ops/care-evidence/care-evidence.module.css",
        ),
        "utf8",
      ),
    ]);

  assert.match(
    shell,
    /\.navLinkActive\s*\{[\s\S]*?background:\s*var\(--ops-action-subtle\);[\s\S]*?color:\s*var\(--ops-action\);/,
  );
  assert.match(shell, /\.operatorAvatar\s*\{[\s\S]*?var\(--ops-accent\)/);
  assert.match(
    activity,
    /\.donutArc\[data-tone=["']product["']\],[\s\S]*?stroke:\s*var\(--ops-accent\);/,
  );
  assert.match(
    activity,
    /\.reviewDecisionLink\s*\{[\s\S]*?color:\s*var\(--ops-action\);/,
  );
  assert.match(
    operators,
    /\.featureAvatar,[\s\S]*?color:\s*var\(--ops-accent\);/,
  );
  assert.match(
    operators,
    /\.roleChoices label\[data-selected=["']true["']\]\s*\{[\s\S]*?color:\s*var\(--ops-action\);/,
  );
  assert.match(
    inbox,
    /\.sectionItemButtonActive\s*\{[\s\S]*?background:\s*var\(--ops-action-subtle\);/,
  );
  assert.match(
    inbox,
    /\.cardActive \.cardCaret\s*\{[\s\S]*?color:\s*var\(--ops-action\);/,
  );
  assert.match(
    overview,
    /\.queueRowActive\s*\{\s*background:\s*var\(--ops-action-subtle\);\s*\}/,
  );
  assert.match(
    careEvidence,
    /\.tabActive\s*\{[\s\S]*?background:\s*var\(--ops-action-subtle\);[\s\S]*?color:\s*var\(--ops-action\);/,
  );
});

test("light token declarations remain byte-identical and browser chrome is black only in dark mode", async () => {
  const [css, layout, manifest] = await Promise.all([
    readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    readFile(path.join(process.cwd(), "app/layout.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "app/manifest.ts"), "utf8"),
  ]);
  const lightRootBlocks = blocksFor(css, /^:root\s*\{/gm);
  const lightTokens = declarations(lightRootBlocks);
  const digest = createHash("sha256")
    .update(lightRootBlocks.join("\n"))
    .digest("hex");

  assert.equal(lightRootBlocks.length, 2);
  assert.equal(digest, LIGHT_ROOT_BLOCKS_SHA256);
  assert.equal(lightTokens["--ops-accent"], "#555a60");
  assert.equal(lightTokens["--ops-accent-subtle"], "rgba(85,90,96,.12)");
  assert.equal(lightTokens["--ops-action"], "#2f5597");
  assert.equal(lightTokens["--ops-action-subtle"], "rgba(47,85,151,.12)");
  assert.equal(lightTokens["--ops-focus-ring"], "#2f5597");
  assert.ok(
    contrast(lightTokens["--ops-accent"], lightTokens["--ops-product-stage"]) >=
      4.5,
  );
  assert.ok(
    contrast(lightTokens["--ops-action"], lightTokens["--ops-product-stage"]) >=
      4.5,
  );
  assert.ok(contrast("#fff", lightTokens["--ops-action"]) >= 4.5);
  assert.ok(
    contrast(
      lightTokens["--ops-focus-ring"],
      lightTokens["--ops-product-stage"],
    ) >= 3,
  );
  assert.match(
    layout,
    /media: '\(prefers-color-scheme: light\)', color: '#f29c85'/,
  );
  assert.match(
    layout,
    /media: '\(prefers-color-scheme: dark\)', color: '#000000'/,
  );
  assert.match(layout, /var c=d\?'#000000':'#f29c85'/);
  assert.match(layout, /querySelectorAll\('meta\[name="theme-color"\]'\)/);
  assert.match(layout, /n\[i\]\.setAttribute\('content',c\)/);
  assert.match(layout, /new MutationObserver\(s\)\.observe\(e,/);
  assert.match(
    layout,
    /attributeFilter:\['data-theme'\],childList:true,subtree:true/,
  );
  assert.match(manifest, /background_color: '#fff8f3'/);
  assert.match(manifest, /theme_color: '#f29c85'/);
});

test("dark form placeholders and disabled primary actions stay readable", async () => {
  const [css, contribute, retailers] = await Promise.all([
    readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    readFile(
      path.join(process.cwd(), "app/(site)/contribute/contribute.module.css"),
      "utf8",
    ),
    readFile(
      path.join(process.cwd(), "app/(site)/retailers/retailers.module.css"),
      "utf8",
    ),
  ]);

  assert.match(
    css,
    /html\[data-theme="dark"\]\s+:is\(input,\s*textarea\)::placeholder\s*\{\s*color:\s*var\(--muted\);\s*opacity:\s*1;?\s*\}/,
  );
  assert.match(
    css,
    /html:not\(\[data-theme="light"\]\)\s+:is\(input,\s*textarea\)::placeholder\s*\{\s*color:\s*var\(--muted\);\s*opacity:\s*1;?\s*\}/,
  );
  assert.equal(
    css.match(
      /\.consult-form\s+button:disabled\s*\{\s*opacity:\s*0?\.72;?\s*\}/g,
    )?.length,
    2,
  );
  assert.equal(
    contribute.match(/\.primary:disabled\s*\{\s*opacity:\s*0?\.72;?\s*\}/g)
      ?.length,
    2,
  );
  assert.equal(
    retailers.match(
      /\.partnershipPrimary:disabled\s*\{\s*opacity:\s*0?\.72;?\s*\}/g,
    )?.length,
    2,
  );
  assert.ok(
    contrast(
      expectedDarkTokens["--muted"],
      expectedDarkTokens["--surface-2"],
    ) >= 4.5,
  );
});
