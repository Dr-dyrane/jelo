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
    /\.stepHeading\s*\{[\s\S]*?scroll-margin-top:\s*15rem;[\s\S]*?outline:\s*none;/,
  );
});

test("review shows entered details, offers edit paths, and gates a short CTA", async () => {
  const checkout = await source("components/commerce/procurement-basket.tsx");
  const styles = await source("components/commerce/procurement.module.css");

  assert.match(checkout, /aria-label=["']Checkout progress["']/);
  assert.match(checkout, /aria-current=\{state === ["']current["']/);
  assert.match(checkout, /contact: ["']Contact["']/);
  assert.match(checkout, /delivery: ["']Delivery["']/);
  assert.match(checkout, /review: ["']Review["']/);
  assert.match(checkout, />\s*Contact details\s*<\/h1>/);
  assert.match(checkout, />\s*Delivery details\s*<\/h1>/);
  assert.match(checkout, />\s*Review request\s*<\/h1>/);
  assert.doesNotMatch(checkout, /How can JeloCare reach you\?/);
  assert.match(checkout, /aria-label=["']Entered checkout details["']/);
  assert.match(checkout, /aria-label=["']Edit contact details["']/);
  assert.match(checkout, /aria-label=["']Edit delivery details["']/);
  assert.match(checkout, /onClick=\{\(\) => goToStep\(["']contact["']\)\}/);
  assert.match(checkout, /onClick=\{\(\) => goToStep\(["']delivery["']\)\}/);
  assert.match(checkout, /<CircleUserRound size=\{20\}/);
  assert.match(checkout, /<MapPin size=\{20\}/);
  assert.match(checkout, /<strong>\{fields\.contactName\}<\/strong>/);
  assert.match(checkout, /fields\.deliveryAddress/);
  assert.match(checkout, /disabled=\{submitting \|\| !termsAccepted\}/);
  assert.match(checkout, /["']Request quote["']/);
  assert.match(
    styles,
    /\.stepRail\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/,
  );
  assert.match(
    styles,
    /\.stepActions \.primaryAction\s*\{[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.match(
    styles,
    /\.reviewEdit\s*\{[\s\S]*?min-width:\s*2\.75rem;[\s\S]*?min-height:\s*2\.75rem;/,
  );
  assert.match(styles, /\.checkField\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
});

test("checkout keeps product and retailer context compact", async () => {
  const checkout = await source("components/commerce/procurement-basket.tsx");
  const styles = await source("components/commerce/procurement.module.css");

  assert.match(checkout, /aria-label=["']Basket summary["']/);
  assert.match(checkout, /offer\.productSize/);
  assert.match(checkout, /className=\{styles\.checkoutSummaryTotal\}/);
  assert.match(checkout, />Products<\/span>/);
  assert.match(checkout, /Quote before payment/);
  assert.doesNotMatch(checkout, /Submit basket/);
  assert.doesNotMatch(checkout, /We verify costs/);
  assert.match(
    styles,
    /\.summaryLine\s*\{[\s\S]*?grid-template-columns:\s*3\.25rem minmax\(0, 1fr\) auto;/,
  );
});
