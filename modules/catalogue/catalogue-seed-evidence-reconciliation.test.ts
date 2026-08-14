import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { publishedIntakeProducts } from "@/data/published-intake-products";
import { mergeRetailOffers } from "@/data/retail-offers";

const seed = readFileSync(
  resolve(process.cwd(), "scripts/seed-catalogue.ts"),
  "utf8",
);

test("newer protected seed evidence must be exact and pass publication scope checks", () => {
  assert.match(seed, /mergeRetailOffers\(product, product\.offers\)/);
  assert.match(
    seed,
    /\["api", "retailer_page"\]\.includes\(verificationMethod\)/,
  );
  assert.match(seed, /\(offer\.match \?\? "exact"\) === "exact"/);
  assert.match(seed, /offer\.priceObservation != null/);
  assert.match(
    seed,
    /assertRetailerResponseScope\(\{[\s\S]*requestedUrl: offer\.url/,
  );
  assert.match(
    seed,
    /expectedTitle: `\$\{product\.brand\} \$\{product\.name\}`/,
  );
  assert.match(seed, /expectedSize: product\.size/);
  assert.match(seed, /marketCode: market/);
  assert.match(seed, /currencyCode/);
  assert.match(
    seed,
    /catch \{[\s\S]*cannot replace protected[\s\S]*current evidence/,
  );
});

test("seed projection admits the Batch 1 offers for dossier-released products", () => {
  const expected = [
    [
      "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
      "2026-08-14T17:00:00Z",
    ],
    ["dove-melanin-even-tone-body-wash-18-5oz", "2026-08-14T17:00:00Z"],
  ] as const;
  for (const [slug, observedAt] of expected) {
    const product = publishedIntakeProducts.find((item) => item.slug === slug);
    assert.ok(product, `missing released product ${slug}`);
    const offer = mergeRetailOffers(product, product.offers).find(
      (item) => item.retailer === "Beauty by Daz",
    );
    assert.ok(offer, `missing Beauty by Daz offer for ${slug}`);
    assert.equal(offer.match, "exact");
    assert.equal(offer.listingEvidence?.observedAt, observedAt);
    assert.equal(offer.location.includes("NG"), true);
  }
});

test("a protected current observation is replaced only by strictly newer scope-checked evidence", () => {
  const precedence = String.raw`offers\.verification_method in \('retailer_page', 'api', 'manual'\) and not \(\$\{incomingObservationIsScopeChecked\} and excluded\.last_verified_at > coalesce\(offers\.last_verified_at, '-infinity'::timestamptz\)\)`;
  for (const field of [
    "url",
    "price_minor",
    "inventory_status",
    "verification_method",
    "last_verified_at",
    "match_kind",
    "observed_title",
    "observed_size",
    "canonical_url",
  ]) {
    assert.match(
      seed,
      new RegExp(
        `${field} = case when ${precedence} then offers\\.${field} else excluded\\.${field} end`,
      ),
      `missing coherent precedence for ${field}`,
    );
  }
});

test("seed reconciliation retains append-only price history", () => {
  assert.match(
    seed,
    /insert into offer_price_history \([\s\S]*on conflict do nothing/,
  );
  assert.doesNotMatch(seed, /delete from offer_price_history/i);
  assert.doesNotMatch(seed, /update offer_price_history/i);
});
