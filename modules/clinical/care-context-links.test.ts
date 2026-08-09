import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  concernGuideLinks,
  ingredientLibraryHref,
  ingredientLibraryReference,
} from "@/lib/clinical/care-context-links";

const concernSelector = readFileSync(
  "components/concerns/concern-selector.tsx",
  "utf8",
);
const consultExperience = readFileSync(
  "components/consult/consult-experience.tsx",
  "utf8",
);
const productPanel = readFileSync(
  "components/products/product-quick-panel.tsx",
  "utf8",
);

test("ingredient links resolve only source-checked library entries", () => {
  assert.equal(
    ingredientLibraryHref("niacinamide"),
    "/ingredients#niacinamide",
  );
  assert.equal(ingredientLibraryHref("retinol"), null);
  assert.equal(ingredientLibraryHref("ketoconazole"), null);
  assert.deepEqual(ingredientLibraryReference("try 2% salicylic acid slowly"), {
    slug: "salicylic-acid",
    label: "Salicylic acid",
    href: "/ingredients#salicylic-acid",
  });
  assert.equal(ingredientLibraryReference("daily sunscreen"), null);
});

test("ingredient evidence maps to exact, deduplicated concern guides", () => {
  assert.deepEqual(concernGuideLinks(["acne", "blackheads", "oiliness"]), [
    {
      slug: "acne-breakouts",
      label: "Acne & breakouts",
      href: "/concerns/acne-breakouts",
    },
    {
      slug: "oily-congested-skin",
      label: "Oily & congested skin",
      href: "/concerns/oily-congested-skin",
    },
  ]);
  assert.deepEqual(concernGuideLinks(["redness"]), []);
});

test("public care surfaces use connected, in-place discovery", () => {
  assert.match(concernSelector, /Search a concern or sign/);
  assert.match(concernSelector, /visibleConcerns/);
  assert.match(consultExperience, /href=\{`\/concerns\/\$\{concern\.slug\}`\}/);
  assert.match(productPanel, /ingredientLibraryHref\(ingredient\.slug\)/);
  assert.match(productPanel, /href=\{libraryHref\}/);
});
