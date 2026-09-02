import assert from "node:assert/strict";
import test from "node:test";
import type {
  CurrentMarketFinderLocation,
  MarketFinderContext,
} from "@/lib/markets/domain";
import {
  presentMarketFinderLocation,
  presentMarketFinderMarket,
  presentMarketFinderProduct,
  presentMarketFinderResearchRecord,
  resolveMarketFinderProductPackshot,
} from "@/lib/markets/presentation";

const context: MarketFinderContext = {
  market: {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "trade-fair",
    name: "Lagos Trade Fair",
    city: "Lagos",
    stateRegion: "Lagos",
    countryCode: "NG",
  },
  product: {
    identityVersionId: "22222222-2222-4222-8222-222222222222",
    productId: "33333333-3333-4333-8333-333333333333",
    slug: "exact-product-50ml",
    brand: "Exact Brand",
    variant: "Exact Product",
    size: "50 ml",
    packageVersion: "v1",
    formulaVersion: "v1",
  },
};

const location: CurrentMarketFinderLocation = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "reviewed-shop-a43",
  name: "Reviewed Shop",
  retailerName: "Reviewed Retailer",
  placeName: "Akwa-Ibom Plaza",
  shopNumber: "A43",
  floor: null,
  locationVerificationExpiresAt: "2026-09-08T10:00:00.000Z",
  locationIdentityEvidenceExpiresAt: "2026-09-08T10:00:00.000Z",
  observation: {
    id: "55555555-5555-4555-8555-555555555555",
    availability: "in_stock",
    priceNgn: 12500.5,
    observedAt: "2026-09-01T10:00:00.000Z",
    expiresAt: "2026-09-08T10:00:00.000Z",
    sourceMethod: "retailer_confirmation",
    observedTitle: "Exact Product",
    observedSize: "50 ml",
  },
  action: {
    kind: "whatsapp",
    destination: "https://wa.me/2348000000000",
    href: "https://wa.me/2348000000000",
    expiresAt: "2026-09-08T10:00:00.000Z",
  },
};

test("production Market Finder presentation preserves exact identity and native packshot gate", () => {
  assert.deepEqual(presentMarketFinderMarket(context.market), {
    slug: "trade-fair",
    name: "Lagos Trade Fair",
    location: "Lagos, Nigeria",
  });
  assert.equal(resolveMarketFinderProductPackshot(context.product), undefined);
  assert.deepEqual(presentMarketFinderProduct(context.product), {
    slug: "exact-product-50ml",
    brand: "Exact Brand",
    name: "Exact Product",
    size: "50 ml",
    identityNote: "Exact 50 ml pack identity reviewed.",
    image: undefined,
  });
});

test("production location presentation exposes only bounded reviewed display fields", () => {
  const lead = presentMarketFinderLocation(context, location);
  assert.equal(lead.state, "ready");
  assert.equal(lead.stateLabel, "In stock");
  assert.equal(lead.locationLabel, "Akwa-Ibom Plaza · Shop A43 · Lagos");
  assert.match(lead.evidenceLabel, /₦12,500\.5/);
  assert.match(lead.evidenceNote, /Retailer confirmation/);
  assert.deepEqual(lead.directions, []);
  assert.deepEqual(lead.externalAction, {
    href: "https://wa.me/2348000000000",
    label: "Open WhatsApp",
  });
  assert.equal(lead.actionEvidence.usableAction, "contact");
});

test("production research presentation is exact-product scoped and never actionable", () => {
  const baseRecord = {
    kind: "location" as const,
    id: location.id,
    slug: location.slug,
    name: location.name,
    retailerName: location.retailerName,
    placeName: location.placeName,
    shopNumber: location.shopNumber,
    floor: location.floor,
    locationVerificationExpiresAt: location.locationVerificationExpiresAt,
    locationIdentityEvidenceExpiresAt:
      location.locationIdentityEvidenceExpiresAt,
    observation: {
      ...location.observation,
      availability: "not_carried" as const,
    },
  };
  const unavailable = presentMarketFinderResearchRecord(context, {
    ...baseRecord,
    reason: "stock-unavailable",
  });
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.stateLabel, "Reported not carried");
  assert.equal(unavailable.evidenceLabel, "Reported not carried");
  assert.match(unavailable.evidenceNote, /Exact Brand Exact Product, 50 ml/);
  assert.match(
    unavailable.evidenceNote,
    /does not describe other products or branches/i,
  );
  assert.equal(unavailable.detailRecordAvailable, false);
  assert.deepEqual(unavailable.directions, []);
  assert.equal(unavailable.actionEvidence.usableAction, null);
  assert.doesNotMatch(JSON.stringify(unavailable), /wa\.me|href/i);

  const unknown = presentMarketFinderResearchRecord(context, {
    ...baseRecord,
    reason: "stock-unavailable",
    observation: { ...baseRecord.observation, availability: "unknown" },
  });
  assert.equal(unknown.evidenceLabel, "Stock not confirmed");
  assert.equal(unknown.stateLabel, "Stock not confirmed");

  const noAction = presentMarketFinderResearchRecord(context, {
    ...baseRecord,
    reason: "no-usable-action",
    observation: { ...baseRecord.observation, availability: "low_stock" },
  });
  assert.equal(noAction.state, "location-lead");
  assert.equal(noAction.stateLabel, "Route needs review");
  assert.match(
    noAction.evidenceNote,
    /no current reviewed route or contact action/i,
  );
  assert.equal(noAction.detailRecordAvailable, false);
});

test("generic research warnings withhold disputed or expired location identity", () => {
  const disputed = presentMarketFinderResearchRecord(context, {
    kind: "warning",
    id: "location-disputed",
    reason: "location-disputed",
  });
  assert.equal(disputed.kind, "direction-alert");
  assert.equal(disputed.state, "disputed");
  assert.equal(disputed.stateLabel, "Location under review");
  assert.equal(disputed.name, "A market location is under review");
  assert.equal(disputed.identityLabel, "Location details withheld");
  assert.deepEqual(disputed.directions, []);
  assert.equal(disputed.observedAt, undefined);
  assert.equal(disputed.detailRecordAvailable, false);
  assert.doesNotMatch(JSON.stringify(disputed), /A43|Akwa-Ibom|wa\.me|href/i);
});
