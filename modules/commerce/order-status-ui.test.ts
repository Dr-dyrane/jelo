import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

async function progressRuntime() {
  const runtimeRequire = createRequire(
    path.join(process.cwd(), "package.json"),
  );
  runtimeRequire.extensions[".css"] = (module) => {
    module.exports = {};
  };
  const loaded = await import("../../components/commerce/order-progress");
  const runtimeExports =
    (loaded as unknown as { default?: Record<string, unknown> }).default ??
    loaded;
  return runtimeExports as unknown as {
    orderProgressActiveIndex: (
      state: string,
      events: readonly {
        fromState: string | null;
        toState: string;
      }[],
    ) => number;
  };
}

test("order progress makes current truth primary and keeps narrow labels readable", async () => {
  const component = await source("components/commerce/order-progress.tsx");
  const styles = await source("components/commerce/order-progress.module.css");

  assert.match(component, /data-tone=\{tone\}/);
  assert.match(component, /className=\{styles\.next\}/);
  assert.match(component, /\{presentation\.detail\}/);
  assert.match(component, /aria-current=/);
  assert.match(component, /aria-label=\{/);

  assert.match(styles, /--complete-tone:\s*var\(--state-success\)/);
  assert.match(
    styles,
    /\.progress\[data-tone=["']warning["']\][\s\S]*?--current-tone:\s*var\(--state-warning\)/,
  );
  assert.match(
    styles,
    /\.progress li small\s*\{[\s\S]*?font-size:\s*0\.68rem;[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.doesNotMatch(
    styles,
    /\.progress li small\s*\{[\s\S]*?text-overflow:\s*ellipsis;/,
  );
});

test("needs-response attention stays at the deepest event-reached step", async () => {
  const { orderProgressActiveIndex } = await progressRuntime();

  assert.equal(orderProgressActiveIndex("needs_response", []), 1);
  assert.equal(
    orderProgressActiveIndex("needs_response", [
      { fromState: "payment_pending", toState: "needs_response" },
    ]),
    3,
  );
  assert.equal(
    orderProgressActiveIndex("needs_response", [
      { fromState: "procurement", toState: "needs_response" },
    ]),
    4,
  );
});

test("owned order controls meet the touch floor and preserve reduced motion", async () => {
  const styles = await source("components/commerce/order-status.module.css");

  assert.match(
    styles,
    /\.refreshButton\s*\{[\s\S]*?min-width:\s*var\(--touch-min\);[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.refreshButton::after\s*\{[\s\S]*?content:\s*attr\(aria-label\);/,
  );
  assert.match(
    styles,
    /\.returnLink\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.restartLink\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.decisions button,[\s\S]*?\.continueShopping\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.payButton\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.copyButton\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.confirmPaymentLink\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /\.missing a\s*\{[\s\S]*?min-height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.spinning\s*\{[\s\S]*?animation:\s*none;/,
  );
  assert.match(
    styles,
    /\.quoteCard h2\s*\{[\s\S]*?font-size:\s*clamp\(1\.6rem,\s*3vw,\s*2\.25rem\);[\s\S]*?text-wrap:\s*balance;/,
  );
});

test("guest recovery stays concise, private, and action-led", async () => {
  const component = await source("components/commerce/order-recovery-form.tsx");
  const styles = await source("components/commerce/order-status.module.css");

  assert.match(component, /aria-busy=\{pending\}/);
  assert.match(
    component,
    /If the details match an active request, we’ll email a new private link\./,
  );
  assert.match(component, /["']Email private link["']/);
  assert.match(component, /role=["']status["'] data-tone=\{messageTone\}/);
  assert.match(component, /pattern=["']JC-\[A-Za-z0-9\]\{10\}["']/);
  assert.match(component, /autoComplete=["']email["']/);

  assert.match(
    styles,
    /\.recoveryForm\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    styles,
    /\.recoveryForm input\s*\{[\s\S]*?min-height:\s*var\(--touch-comfortable\);/,
  );
  assert.match(
    styles,
    /\.recoveryForm button\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?min-height:\s*var\(--touch-comfortable\);/,
  );
  assert.match(
    styles,
    /\.recoveryForm > p\[role=["']status["']\]\[data-tone=["']danger["']\][\s\S]*?background:\s*var\(--state-danger-bg\);/,
  );
});
