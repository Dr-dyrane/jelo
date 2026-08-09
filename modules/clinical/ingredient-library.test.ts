import assert from "node:assert/strict";
import test from "node:test";
import { products } from "@/data/catalogue";
import { buildIngredientLibraryCards } from "@/lib/clinical/ingredient-library";

test("ingredient library joins reviewed evidence to canonical catalogue products", () => {
  const cards = buildIngredientLibraryCards(products);
  const niacinamide = cards.find((card) => card.slug === "niacinamide");
  const benzoylPeroxide = cards.find(
    (card) => card.slug === "benzoyl-peroxide",
  );

  assert.ok(niacinamide);
  assert.ok(benzoylPeroxide);
  assert.ok(niacinamide.products.length > 1);
  assert.ok(niacinamide.sources?.length);
  assert.match(niacinamide.reviewedAt ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(
    benzoylPeroxide.products.map((product) => product.slug),
    ["panoxyl-acne-foaming-wash-10-benzoyl-peroxide"],
  );
  assert.equal(
    cards.some((card) => card.slug === "ketoconazole"),
    false,
  );
});

test("ingredient library never retains evidence for an absent public product", () => {
  const cards = buildIngredientLibraryCards(
    products.filter(
      (product) =>
        product.slug !== "panoxyl-acne-foaming-wash-10-benzoyl-peroxide",
    ),
  );

  assert.equal(
    cards.some((card) => card.slug === "benzoyl-peroxide"),
    false,
  );
});
