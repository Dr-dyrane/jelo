import assert from "node:assert/strict";
import test from "node:test";
import { campaignProductIdentityMatchesEvidence } from "@/lib/campaigns/daily-campaign";
import {
  buildCampaignCopy,
  chooseEligibleSignal,
  lagosDateKey,
} from "@/lib/campaigns/daily-campaign-policy";
import { publishedCampaignProductEvidence } from "@/lib/campaigns/product-evidence";
import type { ShareSignal } from "@/modules/commerce/share-insights";

function gapSignal(): ShareSignal {
  return {
    kind: "gap",
    slug: "exact-product",
    brand: "Exact Brand",
    name: "Exact Product",
    image: "https://example.com/product.png",
    microtag: "50 ml · Face",
    category: "Face",
    lowestNaira: 12_000,
    highestNaira: 39_500,
    storeCount: 2,
    observedAt: "2026-08-13T06:30:00Z",
    drop: null,
    gap: {
      slug: "exact-product",
      brand: "Exact Brand",
      name: "Exact Product",
      image: "https://example.com/product.png",
      microtag: "50 ml · Face",
      lowestNaira: 12_000,
      spreadNaira: 27_500,
      storeCount: 2,
      observedAt: "2026-08-13T06:30:00Z",
    },
    rank: {
      tier: 2,
      evidence: [27_500, 2, Date.parse("2026-08-13T06:30:00Z"), 2.29],
      aggregateInterest: 0,
    },
  };
}

test("Lagos campaign dates use the WAT calendar boundary", () => {
  assert.equal(lagosDateKey(new Date("2026-08-12T23:30:00Z")), "2026-08-13");
  assert.equal(lagosDateKey(new Date("2026-08-13T22:59:59Z")), "2026-08-13");
});

test("rotation skips recently delivered or evidence-ineligible products", () => {
  const ranked = [{ slug: "recent" }, { slug: "blocked" }, { slug: "ready" }];
  const selected = chooseEligibleSignal(ranked, {
    recentProductSlugs: new Set(["recent"]),
    isEligible: (signal) => signal.slug !== "blocked",
  });
  assert.deepEqual(selected, { slug: "ready" });
});

test("price-gap copy is factual, succinct, and does not invent sale language", () => {
  const copy = buildCampaignCopy(gapSignal(), {
    size: "50 ml",
    shareUrl: "https://www.jelocare.com/share/exact-product",
  });
  assert.equal(copy.headline, "Same product. ₦27,500 apart.");
  assert.equal(copy.priceLine, "₦12,000 — ₦39,500");
  assert.match(copy.caption, /Compare Exact Brand Exact Product/);
  assert.doesNotMatch(
    `${copy.headline} ${copy.caption}`,
    /\b(?:sale|deal|saving|save|authentic)\b/i,
  );
  assert.equal(copy.embeddedUrl, null);
});

test("the publication projection resolves exact identity and reviewed artwork", () => {
  const evidence = publishedCampaignProductEvidence(
    "dang-hydra-glow-sun-protection-gel-60ml",
  );
  assert.ok(evidence);
  assert.deepEqual(evidence.identifier, {
    kind: "manufacturer-sku",
    value: "DGL-SKC-051",
    label: "SKU",
  });
  assert.equal(evidence.finalImage.width, 2000);
  assert.equal(evidence.finalImage.height, 2000);
  assert.match(evidence.finalImage.sha256, /^[0-9a-f]{64}$/);
  assert.equal(
    publishedCampaignProductEvidence("not-a-published-product"),
    null,
  );
});

test("campaign identity accepts reviewed brand aliases without weakening exact product fields", () => {
  const evidence = publishedCampaignProductEvidence(
    "dang-hydra-glow-sun-protection-gel-60ml",
  );
  assert.ok(evidence);
  const aliasEvidence = { ...evidence, brand: "Dang! Lifestyle Inc." };

  const product = {
    brand: "DANG! Lifestyle",
    name: evidence.name,
    size: evidence.size,
    image: evidence.finalImage.url,
  };

  assert.notEqual(product.brand, aliasEvidence.brand);
  assert.equal(
    campaignProductIdentityMatchesEvidence(product, aliasEvidence),
    true,
  );
  assert.equal(
    campaignProductIdentityMatchesEvidence(
      { ...product, name: `${product.name} reformulated` },
      aliasEvidence,
    ),
    false,
  );
  assert.equal(
    campaignProductIdentityMatchesEvidence(
      { ...product, size: "50 ml" },
      aliasEvidence,
    ),
    false,
  );
  assert.equal(
    campaignProductIdentityMatchesEvidence(
      { ...product, image: "https://example.com/unreviewed-packshot.png" },
      aliasEvidence,
    ),
    false,
  );
});
