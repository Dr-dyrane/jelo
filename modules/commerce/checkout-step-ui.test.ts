import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

test("user-requested checkout step changes orient and focus the new heading", async () => {
  const checkout = await source("components/commerce/procurement-basket.tsx");
  const styles = await source("components/commerce/procurement.module.css");

  assert.match(checkout, /const orientOnStepChangeRef = useRef\(false\)/);
  assert.match(checkout, /if \(!orientOnStepChangeRef\.current\) return/);
  assert.match(
    checkout,
    /heading\.scrollIntoView\(\{[\s\S]*block: ["']start["']/,
  );
  assert.match(checkout, /heading\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    checkout,
    /function previousStep\(\) \{[\s\S]*?goToStep\(checkoutFlow\[/,
  );
  assert.match(checkout, /prefers-reduced-motion: reduce/);
  assert.equal(checkout.match(/ref=\{stepHeadingRef\}/g)?.length, 3);
  assert.match(
    styles,
    /\.stepHeading\s*\{[\s\S]*?scroll-margin-top:\s*8\.5rem;[\s\S]*?outline:\s*none;/,
  );
});

test("review shows entered details, offers edit paths, and gates a short CTA", async () => {
  const checkout = await source("components/commerce/procurement-basket.tsx");
  const styles = await source("components/commerce/procurement.module.css");

  assert.match(checkout, /aria-label=["']Entered checkout details["']/);
  assert.match(checkout, /aria-label=["']Edit contact details["']/);
  assert.match(checkout, /aria-label=["']Edit delivery details["']/);
  assert.match(checkout, /onClick=\{\(\) => goToStep\(["']contact["']\)\}/);
  assert.match(checkout, /onClick=\{\(\) => goToStep\(["']delivery["']\)\}/);
  assert.match(checkout, /<dd>\{fields\.contactName\}<\/dd>/);
  assert.match(checkout, /fields\.deliveryAddress/);
  assert.match(checkout, /disabled=\{submitting \|\| !termsAccepted\}/);
  assert.match(checkout, /["']Request quote["']/);
  assert.match(
    styles,
    /\.stepActions \.primaryAction\s*\{[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.match(
    styles,
    /\.reviewHeading button\s*\{[\s\S]*?min-width:\s*2\.75rem;[\s\S]*?min-height:\s*2\.75rem;/,
  );
});
