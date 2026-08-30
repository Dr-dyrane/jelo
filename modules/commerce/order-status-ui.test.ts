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

test("order progress keeps current truth in a compact numbered rail", async () => {
  const component = await source("components/commerce/order-progress.tsx");
  const styles = await source("components/commerce/order-progress.module.css");

  assert.match(component, /data-tone=\{tone\}/);
  assert.match(
    component,
    /data-exception=\{exception \? ["']true["'] : ["']false["']\}/,
  );
  assert.match(component, /String\(index \+ 1\)\.padStart\(2, ["']0["']\)/);
  assert.doesNotMatch(component, /presentation\.detail/);
  assert.match(component, /aria-current=/);
  assert.match(component, /aria-label=\{/);
  assert.match(component, /status === ["']reached["']/);
  assert.match(component, /: ["']later["']/);

  assert.match(styles, /--complete-tone:\s*var\(--state-success\)/);
  assert.match(
    styles,
    /\.progress\[data-tone=["']warning["']\][\s\S]*?--current-tone:\s*var\(--state-warning\)/,
  );
  assert.match(
    styles,
    /\.progress ol\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    styles,
    /\.progress li > span\s*\{[\s\S]*?font-family:\s*var\(--font-display\),\s*serif;/,
  );
  assert.match(
    styles,
    /\.progress li small\s*\{[\s\S]*?font-size:\s*0\.65rem;[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.doesNotMatch(
    styles,
    /\.progress li small\s*\{[\s\S]*?text-overflow:\s*ellipsis;/,
  );
});

test("normal and exception states keep their exact reached depth", async () => {
  const { orderProgressActiveIndex } = await progressRuntime();
  const normalDepths = {
    requested: 0,
    quoting: 1,
    awaiting_approval: 2,
    payment_pending: 3,
    paid: 3,
    procurement: 4,
    retailer_confirmed: 4,
    out_for_delivery: 4,
    delivered: 4,
  } as const;

  for (const [state, expected] of Object.entries(normalDepths)) {
    assert.equal(orderProgressActiveIndex(state, []), expected, state);
  }

  assert.equal(
    orderProgressActiveIndex("cancelled", [
      { fromState: "payment_pending", toState: "cancelled" },
    ]),
    3,
  );
  assert.equal(
    orderProgressActiveIndex("refund_pending", [
      { fromState: "out_for_delivery", toState: "refund_pending" },
    ]),
    4,
  );
  assert.equal(
    orderProgressActiveIndex("refunded", [
      { fromState: "delivered", toState: "refund_pending" },
      { fromState: "refund_pending", toState: "refunded" },
    ]),
    4,
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
    /\.quoteCard h2\s*\{[\s\S]*?font-family:\s*var\(--font-display\),\s*serif;[\s\S]*?text-wrap:\s*balance;/,
  );
  assert.match(
    styles,
    /\.heroMeta span\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*color-mix/,
  );
  assert.match(
    styles,
    /\.quoteCard > div\[data-tone\]\s*\{[\s\S]*?padding:\s*0\.8rem;/,
  );
  assert.match(
    styles,
    /\.quoteCard > div:has\(input\[type=["']checkbox["']\]\)\s*\{[\s\S]*?padding:\s*0\.75rem;/,
  );
  assert.match(
    styles,
    /@media \(max-width:\s*360px\)[\s\S]*?\.page\s*\{[\s\S]*?padding-inline:\s*0\.75rem;/,
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
  assert.match(component, /className=\{styles\.recoveryIntro\}/);
  assert.match(component, /<LockKeyhole size=\{20\}/);
  assert.match(component, /<Hash size=\{14\}/);
  assert.match(component, /<Mail size=\{14\}/);
  assert.match(component, /autoCapitalize=["']none["']/);

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
    /\.recoveryIntro\s*\{[\s\S]*?grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /\.recoveryForm button\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?min-height:\s*var\(--touch-comfortable\);[\s\S]*?display:\s*inline-flex;/,
  );
  assert.match(
    styles,
    /\.recoveryForm > p\[role=["']status["']\]\[data-tone=["']danger["']\][\s\S]*?background:\s*var\(--state-danger-bg\);/,
  );
});
