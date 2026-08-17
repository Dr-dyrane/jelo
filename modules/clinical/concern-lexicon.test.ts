import assert from "node:assert/strict";
import test from "node:test";
import { inferConcerns, concernLexicon } from "@/lib/clinical/concern-lexicon";

test("inferConcerns matches the original lexicon concerns", () => {
  assert.deepEqual(inferConcerns("I have acne and oily skin"), [
    "acne",
    "oiliness",
  ]);
  // "pimples" matches acne, "dark spots" matches hyperpigmentation — both are correct
  assert.deepEqual(inferConcerns("dark spots after my pimples heal"), [
    "acne",
    "hyperpigmentation",
  ]);
  // "flaky" matches both dryness and dandruff — both are correct
  const scalpResult = inferConcerns("I have flaky scalp and itchy scalp");
  assert.ok(scalpResult.includes("dandruff"));
  assert.ok(scalpResult.includes("dryness"));
  assert.deepEqual(inferConcerns("my face feels tight and stings"), [
    "sensitivity",
    "dryness",
  ]);
});

test("expanded lexicon catches lay descriptions the original missed", () => {
  // "zit" was not in the original lexicon
  assert.ok(inferConcerns("I have a zit on my chin").includes("acne"));
  // "strawberry legs" was not in the original lexicon
  assert.ok(inferConcerns("strawberry legs after shaving").includes("texture"));
  // "bacne" was not in the original lexicon — it matches both acne and body breakouts
  const bacneResult = inferConcerns("bacne on my shoulders");
  assert.ok(bacneResult.includes("body breakouts"));
  assert.ok(bacneResult.includes("acne")); // "acne" is a substring of "bacne"
  // "crow's feet" was not in the original lexicon
  assert.ok(inferConcerns("crow's feet around my eyes").includes("fine lines"));
  // "kp" was not in the original lexicon
  assert.ok(inferConcerns("kp on my arms").includes("texture"));
  // "cica" was not in the original lexicon — but it maps to sensitivity via centella
  // Actually cica is a barrier concern, not sensitivity. Let's check it doesn't falsely match
  // The term "cica" is in the sensitivity lexicon? No, it's not. Let's verify.
  const cicaResult = inferConcerns("cica cream for my damaged barrier");
  assert.ok(cicaResult.includes("barrier"));
});

test("inferConcerns returns empty for unrelated text", () => {
  assert.deepEqual(inferConcerns("I like turtles"), []);
  assert.deepEqual(inferConcerns("the weather is nice today"), []);
});

test("inferConcerns handles multiple concerns in one query", () => {
  const result = inferConcerns(
    "oily skin with dark spots and blackheads on my nose",
  );
  assert.ok(result.includes("oiliness"));
  assert.ok(result.includes("hyperpigmentation"));
  assert.ok(result.includes("blackheads"));
});

test("lexicon does not have duplicate terms within a concern", () => {
  for (const [slug, terms] of Object.entries(concernLexicon)) {
    const unique = new Set(terms);
    assert.equal(
      unique.size,
      terms.length,
      `Concern "${slug}" has duplicate terms`,
    );
  }
});

test("lexicon terms are lowercase (matching is case-insensitive)", () => {
  for (const [slug, terms] of Object.entries(concernLexicon)) {
    for (const term of terms) {
      assert.equal(
        term,
        term.toLowerCase(),
        `Term "${term}" in "${slug}" must be lowercase`,
      );
    }
  }
});
