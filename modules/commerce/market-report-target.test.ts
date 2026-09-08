import assert from "node:assert/strict";
import test from "node:test";
import type {
  CurrentMarketFinderLocation,
  MarketFinderContext,
  MarketFinderReadModel,
  MarketFinderResearchLocation,
  MarketFinderResearchRecord,
} from "@/lib/markets/domain";
import { marketReportContributionHrefForLead } from "@/lib/markets/feedback";
import { selectMarketReportDisplayTarget } from "@/lib/markets/report-target";

const context: MarketFinderContext = {
  market: {
    id: "market-id",
    slug: "trade-fair",
    name: "Lagos Trade Fair",
    city: "Lagos",
    stateRegion: "Lagos",
    countryCode: "NG",
  },
  product: {
    identityVersionId: "identity-version-id",
    productId: "product-id",
    slug: "exact-product",
    brand: "Brand",
    variant: "Exact product",
    size: "50 ml",
    packageVersion: "v1",
    formulaVersion: "v1",
  },
};

const currentLocation: CurrentMarketFinderLocation = {
  id: "current-location-id",
  slug: "current-shop",
  name: "Current shop",
  retailerName: "Current retailer",
  placeName: "Current Plaza",
  shopNumber: "A43",
  floor: null,
  locationVerificationExpiresAt: "2026-09-20T00:00:00.000Z",
  locationIdentityEvidenceExpiresAt: "2026-09-20T00:00:00.000Z",
  observation: {
    id: "current-observation-id",
    availability: "in_stock",
    priceNgn: 12000,
    observedAt: "2026-09-06T00:00:00.000Z",
    expiresAt: "2026-09-10T00:00:00.000Z",
    sourceMethod: "field_visit",
    observedTitle: "Exact product",
    observedSize: "50 ml",
  },
  action: {
    kind: "directions",
    destination: "Enter through the main gate.",
    href: null,
    expiresAt: "2026-09-10T00:00:00.000Z",
  },
};

function researchLocation(
  reason: MarketFinderResearchLocation["reason"],
  slug: string,
): MarketFinderResearchLocation {
  return {
    kind: "location",
    id: `${slug}-id`,
    reason,
    slug,
    name: `${slug} name`,
    retailerName: `${slug} retailer`,
    placeName: "Reviewed Plaza",
    shopNumber: "B12",
    floor: null,
    locationVerificationExpiresAt: "2026-09-20T00:00:00.000Z",
    locationIdentityEvidenceExpiresAt: "2026-09-20T00:00:00.000Z",
    observation: {
      id: `${slug}-observation-id`,
      availability:
        reason === "stock-unavailable" ? "out_of_stock" : "in_stock",
      observedAt: "2026-09-01T00:00:00.000Z",
      expiresAt:
        reason === "evidence-expired"
          ? "2026-09-04T00:00:00.000Z"
          : "2026-09-10T00:00:00.000Z",
      sourceMethod: "field_visit",
      observedTitle: "Exact product",
      observedSize: "50 ml",
    },
  };
}

function nonCurrentModel(
  researchRecords: MarketFinderResearchRecord[],
): MarketFinderReadModel {
  return {
    state: "stale",
    reason: "evidence-expired",
    context,
    locations: [],
    researchRecords,
    evaluatedAt: "2026-09-07T00:00:00.000Z",
  };
}

test("result reporting link is limited to an enabled expired shop record", () => {
  const expiredShop = {
    kind: "shop" as const,
    state: "stale",
    slug: "expired-shop",
    reportTargetAvailable: true,
  };

  const href = marketReportContributionHrefForLead({
    reportingEnabled: true,
    marketSlug: context.market.slug,
    productSlug: context.product.slug,
    lead: expiredShop,
  });
  assert.equal(
    href,
    "/contribute?mode=market-report&market=trade-fair&product=exact-product&shop=expired-shop#contribution-form",
  );
  assert.doesNotMatch(href ?? "", /\/shops\/|directions/i);

  assert.equal(
    marketReportContributionHrefForLead({
      reportingEnabled: false,
      marketSlug: context.market.slug,
      productSlug: context.product.slug,
      lead: expiredShop,
    }),
    null,
  );
  assert.equal(
    marketReportContributionHrefForLead({
      reportingEnabled: true,
      marketSlug: context.market.slug,
      productSlug: context.product.slug,
      lead: { ...expiredShop, reportTargetAvailable: false },
    }),
    null,
  );
  assert.equal(
    marketReportContributionHrefForLead({
      reportingEnabled: true,
      marketSlug: context.market.slug,
      productSlug: context.product.slug,
      lead: {
        kind: "direction-alert",
        state: "stale",
        slug: "location-recheck",
      },
    }),
    null,
  );
  for (const state of ["ready", "location-lead", "unavailable", "disputed"]) {
    assert.equal(
      marketReportContributionHrefForLead({
        reportingEnabled: true,
        marketSlug: context.market.slug,
        productSlug: context.product.slug,
        lead: { kind: "shop", state, slug: `${state}-shop` },
      }),
      null,
    );
  }
});

test("report display target admits current results and exact expired records", () => {
  const expiredLocation = researchLocation("evidence-expired", "expired-shop");
  const currentModel: MarketFinderReadModel = {
    state: "current",
    context,
    locations: [currentLocation],
    researchRecords: [expiredLocation],
    evaluatedAt: "2026-09-07T00:00:00.000Z",
  };

  const currentTarget = selectMarketReportDisplayTarget(
    currentModel,
    currentLocation.slug,
  );
  assert.equal(currentTarget?.kind, "current");
  assert.equal(currentTarget?.location.slug, currentLocation.slug);

  const expiredAlongsideCurrent = selectMarketReportDisplayTarget(
    currentModel,
    expiredLocation.slug,
  );
  assert.equal(expiredAlongsideCurrent?.kind, "expired");
  assert.equal(expiredAlongsideCurrent?.location.slug, expiredLocation.slug);

  const expiredTarget = selectMarketReportDisplayTarget(
    nonCurrentModel([expiredLocation]),
    expiredLocation.slug,
  );
  assert.equal(expiredTarget?.kind, "expired");
  assert.equal(expiredTarget?.context.product.slug, context.product.slug);
});

test("report display target rejects warnings and non-renewal research states", () => {
  const warning: MarketFinderResearchRecord = {
    kind: "warning",
    id: "location-recheck",
    reason: "location-needs-recheck",
  };
  const outOfStock = researchLocation("stock-unavailable", "out-shop");
  const noAction = researchLocation("no-usable-action", "no-action-shop");
  const model = nonCurrentModel([warning, outOfStock, noAction]);

  assert.equal(selectMarketReportDisplayTarget(model, warning.id), null);
  assert.equal(selectMarketReportDisplayTarget(model, outOfStock.slug), null);
  assert.equal(selectMarketReportDisplayTarget(model, noAction.slug), null);
  assert.equal(selectMarketReportDisplayTarget(model, "missing-shop"), null);

  const noContext: MarketFinderReadModel = {
    state: "unavailable",
    reason: "repository-unavailable",
    context: null,
    locations: [],
    researchRecords: [researchLocation("evidence-expired", "expired-shop")],
    evaluatedAt: "2026-09-07T00:00:00.000Z",
  };
  assert.equal(
    selectMarketReportDisplayTarget(noContext, "expired-shop"),
    null,
  );
});
