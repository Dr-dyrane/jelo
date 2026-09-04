import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketTruthReadModel } from "@/lib/market-truth/read-model";
import type {
  MarketTruthEvidence,
  ScheduledOwnerId,
  ScheduledOwnerReceiptRead,
} from "@/lib/market-truth/types";

const generatedAt = "2026-09-04T18:00:00.000Z";

function currentReceipts(): Record<
  ScheduledOwnerId,
  ScheduledOwnerReceiptRead
> {
  return {
    "inventory-refresh": {
      status: "present",
      receipt: {
        schemaVersion: 1,
        owner: "inventory-refresh",
        state: "completed",
        startedAt: "2026-09-04T17:16:00.000Z",
        completedAt: "2026-09-04T17:18:00.000Z",
        failedAt: null,
        outcomeCode: "completed",
        counts: { completed: 12 },
        revision: "abcdef1",
      },
    },
    "daily-desk-reconcile": {
      status: "present",
      receipt: {
        schemaVersion: 1,
        owner: "daily-desk-reconcile",
        state: "completed",
        startedAt: "2026-09-04T17:41:00.000Z",
        completedAt: "2026-09-04T17:42:00.000Z",
        failedAt: null,
        outcomeCode: "accepted",
        counts: { accepted: 1 },
        revision: "abcdef1",
      },
    },
  };
}

function evidence(
  overrides: Partial<MarketTruthEvidence> = {},
): MarketTruthEvidence {
  return {
    generatedAt,
    inventory: {
      observedAt: generatedAt,
      lastJobActivityAt: "2026-09-04T17:18:00.000Z",
      recentCompleted: 12,
      recentFailed: 0,
      recentDeferred: 0,
      queued: 0,
      due: 0,
      processing: 0,
      leaseExpired: 0,
      deferred: 0,
      publishedExactOffers: 20,
      currentExactOffers: 20,
      currentAvailableOffers: 18,
      staleOffers: 0,
      pricedCurrentOffers: 18,
      pricedCurrentOffersWithHistory: 18,
    },
    retailerDiscovery: {
      observedAt: generatedAt,
      databaseRetailers: 10,
      currentOfferRetailers: 10,
      publishedProducts: 8,
      productsWithKnownExactOffer: 8,
      productsWithCurrentExactOffer: 8,
      productsWithoutKnownExactOffer: 0,
      productsWithoutCurrentExactOffer: 0,
      pendingResearchTasks: 0,
      inProgressResearchTasks: 0,
      oldestOpenResearchAt: null,
      submittedRetailerApplications: 0,
      pendingMarketReports: 0,
    },
    staticRetailers: {
      registryRetailers: 10,
      directoryListedRetailers: 10,
      provisionalRetailers: 0,
      identityEvidenceRecorded: 10,
      identityEvidenceMissing: 0,
      identityEvidenceWithExpiry: 10,
      trustEvidenceWithReviewWindow: 10,
      deliveryServiceEvidenceWithReviewWindow: 10,
    },
    physicalMarkets: {
      observedAt: generatedAt,
      publishedMarkets: 1,
      verifiedLocations: 2,
      currentActionableLocations: 2,
      locationsNeedingRecheck: 0,
      disputedLocations: 0,
      pendingLocationEvidence: 0,
      pendingProductObservations: 0,
      staleApprovedProductObservations: 0,
      directoryProductContexts: 3,
      currentProductContexts: 3,
      pendingMarketReports: 0,
    },
    dailyDesk: {
      date: "2026-09-04",
      status: "ready",
      acceptedDate: "2026-09-04",
      recency: "current-day",
      observedAt: generatedAt,
    },
    scheduledOwnerReceipts: currentReceipts(),
    ...overrides,
  };
}

test("linked market truth stays one ordered seven-stage projection", () => {
  const model = buildMarketTruthReadModel(evidence());

  assert.equal(model.state, "current");
  assert.deepEqual(
    model.layers.map((layer) => layer.id),
    [
      "inventory",
      "offers",
      "retailers",
      "discovery",
      "physical-markets",
      "daily-desk",
      "public-projections",
    ],
  );
  assert.equal(model.exceptions.length, 0);
  assert.equal(model.scheduledOwners.length, 2);
});

test("unread sources fail closed without erasing the remaining evidence", () => {
  const model = buildMarketTruthReadModel(
    evidence({
      inventory: null,
      physicalMarkets: null,
      dailyDesk: null,
      scheduledOwnerReceipts: null,
    }),
  );

  assert.equal(model.state, "unknown");
  assert.equal(
    model.layers.find((layer) => layer.id === "inventory")?.state,
    "unknown",
  );
  assert.equal(
    model.layers.find((layer) => layer.id === "retailers")?.metrics.length,
    4,
  );
  assert.ok(
    model.exceptions.some(
      (item) =>
        item.code === "source-unavailable" &&
        item.layer === "physical-markets" &&
        item.overviewEligible,
    ),
  );
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "scheduled-owner-receipt-unavailable",
    ),
  );
});

test("broken price history, offer coverage and market actionability stay distinct", () => {
  const base = evidence();
  const model = buildMarketTruthReadModel(
    evidence({
      inventory: {
        ...base.inventory!,
        pricedCurrentOffers: 18,
        pricedCurrentOffersWithHistory: 16,
      },
      retailerDiscovery: {
        ...base.retailerDiscovery!,
        productsWithoutKnownExactOffer: 3,
        productsWithoutCurrentExactOffer: 4,
      },
      physicalMarkets: {
        ...base.physicalMarkets!,
        locationsNeedingRecheck: 1,
        directoryProductContexts: 3,
        currentProductContexts: 1,
      },
    }),
  );

  assert.equal(
    model.layers.find((layer) => layer.id === "offers")?.state,
    "attention",
  );
  assert.equal(
    model.layers.find((layer) => layer.id === "discovery")?.state,
    "attention",
  );
  assert.equal(
    model.layers.find((layer) => layer.id === "physical-markets")?.state,
    "attention",
  );
  assert.ok(model.exceptions.some((item) => item.code === "price-history-gap"));
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "published-product-without-known-offer",
    ),
  );
  const directoryGap = model.exceptions.find(
    (item) => item.code === "market-directory-context-not-current",
  );
  assert.equal(
    directoryGap?.threshold,
    "Directory contexts equal current actionable contexts",
  );
  assert.equal(directoryGap?.owner, "Market review");
  assert.equal(directoryGap?.actionHref, "/ops/market-health#physical-markets");
  assert.match(directoryGap?.runbook ?? "", /Market Finder/);
});

test("a failed owner receipt is critical even when database counts look current", () => {
  const receipts = currentReceipts();
  receipts["inventory-refresh"] = {
    status: "present",
    receipt: {
      schemaVersion: 1,
      owner: "inventory-refresh",
      state: "failed",
      startedAt: "2026-09-04T17:16:00.000Z",
      completedAt: null,
      failedAt: "2026-09-04T17:17:00.000Z",
      outcomeCode: "source-unavailable",
      counts: { failed: 2 },
      revision: "abcdef1",
    },
  };

  const model = buildMarketTruthReadModel(
    evidence({ scheduledOwnerReceipts: receipts }),
  );
  const failure = model.exceptions.find(
    (item) => item.code === "scheduled-owner-failed",
  );
  assert.equal(failure?.severity, "critical");
  assert.equal(failure?.overviewEligible, true);
  assert.equal(
    model.scheduledOwners.find((owner) => owner.id === "inventory-refresh")
      ?.state,
    "attention",
  );
});

test("a future-dated terminal receipt cannot appear current", () => {
  const receipts = currentReceipts();
  const current = receipts["inventory-refresh"];
  assert.equal(current.status, "present");
  if (current.status !== "present") return;
  receipts["inventory-refresh"] = {
    status: "present",
    receipt: {
      ...current.receipt,
      startedAt: "2099-01-01T00:00:00.000Z",
      completedAt: "2099-01-01T00:01:00.000Z",
    },
  };

  const model = buildMarketTruthReadModel(
    evidence({ scheduledOwnerReceipts: receipts }),
  );
  assert.equal(
    model.scheduledOwners.find((owner) => owner.id === "inventory-refresh")
      ?.state,
    "attention",
  );
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "scheduled-owner-receipt-stale",
    ),
  );
});

test("one known but stale offer cannot produce an all-current market projection", () => {
  const base = evidence();
  const model = buildMarketTruthReadModel(
    evidence({
      inventory: {
        ...base.inventory!,
        publishedExactOffers: 1,
        currentExactOffers: 0,
        currentAvailableOffers: 0,
        staleOffers: 1,
        pricedCurrentOffers: 0,
        pricedCurrentOffersWithHistory: 0,
      },
      retailerDiscovery: {
        ...base.retailerDiscovery!,
        databaseRetailers: 1,
        currentOfferRetailers: 0,
        publishedProducts: 1,
        productsWithKnownExactOffer: 1,
        productsWithCurrentExactOffer: 0,
        productsWithoutKnownExactOffer: 0,
        productsWithoutCurrentExactOffer: 1,
      },
    }),
  );

  assert.equal(model.state, "attention");
  assert.equal(
    model.layers.find((layer) => layer.id === "offers")?.state,
    "attention",
  );
  assert.equal(
    model.layers.find((layer) => layer.id === "public-projections")?.state,
    "attention",
  );
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "published-product-without-current-offer",
    ),
  );
});

test("a disabled Daily Desk owner is explicit rather than a generic missing outcome", () => {
  const receipts = currentReceipts();
  receipts["daily-desk-reconcile"] = {
    status: "present",
    receipt: {
      schemaVersion: 1,
      owner: "daily-desk-reconcile",
      state: "completed",
      startedAt: "2026-09-04T17:41:00.000Z",
      completedAt: "2026-09-04T17:42:00.000Z",
      failedAt: null,
      outcomeCode: "disabled",
      counts: { accepted: 0 },
      revision: "abcdef1",
    },
  };
  const model = buildMarketTruthReadModel(
    evidence({
      dailyDesk: {
        date: "2026-09-04",
        status: "no-campaign",
        acceptedDate: null,
        recency: null,
        observedAt: generatedAt,
      },
      scheduledOwnerReceipts: receipts,
    }),
  );

  assert.equal(
    model.layers.find((layer) => layer.id === "daily-desk")?.state,
    "attention",
  );
  assert.equal(
    model.scheduledOwners.find((owner) => owner.id === "daily-desk-reconcile")
      ?.state,
    "attention",
  );
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "daily-desk-reconciliation-disabled",
    ),
  );
  assert.equal(
    model.exceptions.some(
      (item) => item.code === "daily-desk-settled-without-resolution",
    ),
    false,
  );
});

test("a disabled reconciler keeps a ready Daily Desk and public projections in attention", () => {
  const receipts = currentReceipts();
  const deskReceipt = receipts["daily-desk-reconcile"];
  assert.equal(deskReceipt.status, "present");
  if (deskReceipt.status !== "present") return;
  receipts["daily-desk-reconcile"] = {
    status: "present",
    receipt: {
      ...deskReceipt.receipt,
      outcomeCode: "disabled",
      counts: { accepted: 0 },
    },
  };

  const model = buildMarketTruthReadModel(
    evidence({ scheduledOwnerReceipts: receipts }),
  );

  assert.equal(model.state, "attention");
  assert.equal(
    model.layers.find((layer) => layer.id === "daily-desk")?.state,
    "attention",
  );
  assert.equal(
    model.layers.find((layer) => layer.id === "public-projections")?.state,
    "attention",
  );
  assert.equal(
    model.scheduledOwners.find((owner) => owner.id === "daily-desk-reconcile")
      ?.state,
    "attention",
  );
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "daily-desk-reconciliation-disabled",
    ),
  );
});

test("a completed no-candidate Daily Desk run is a truthful settled state", () => {
  const receipts = currentReceipts();
  const currentDeskReceipt = receipts["daily-desk-reconcile"];
  assert.equal(currentDeskReceipt.status, "present");
  if (currentDeskReceipt.status !== "present") return;
  receipts["daily-desk-reconcile"] = {
    status: "present",
    receipt: {
      ...currentDeskReceipt.receipt,
      outcomeCode: "no-current-candidate",
      counts: { candidates: 0 },
    },
  };
  const model = buildMarketTruthReadModel(
    evidence({
      dailyDesk: {
        date: "2026-09-04",
        status: "no-campaign",
        acceptedDate: null,
        recency: null,
        observedAt: generatedAt,
      },
      scheduledOwnerReceipts: receipts,
    }),
  );

  const desk = model.layers.find((layer) => layer.id === "daily-desk");
  assert.equal(desk?.state, "current");
  assert.match(desk?.summary ?? "", /No qualified candidate/);
  assert.equal(
    model.exceptions.some(
      (item) => item.code === "daily-desk-acceptance-mismatch",
    ),
    false,
  );
});

test("the inventory monitor uses the established deferred-recheck threshold", () => {
  const base = evidence();
  const model = buildMarketTruthReadModel(
    evidence({
      inventory: {
        ...base.inventory!,
        recentDeferred: 5,
        deferred: 5,
      },
    }),
  );

  const deferred = model.exceptions.find(
    (item) => item.code === "inventory-deferred-recheck-threshold-exceeded",
  );
  assert.equal(deferred?.threshold, "Fewer than 5 deferred rechecks");
  assert.equal(deferred?.overviewEligible, true);
  assert.equal(
    model.layers.find((layer) => layer.id === "inventory")?.state,
    "attention",
  );
});

test("expired Daily Desk evidence is separate from an empty candidate set", () => {
  const model = buildMarketTruthReadModel(
    evidence({
      dailyDesk: {
        date: "2026-09-04",
        status: "evidence-expired",
        acceptedDate: null,
        recency: null,
        observedAt: generatedAt,
      },
    }),
  );

  assert.equal(
    model.layers.find((layer) => layer.id === "daily-desk")?.state,
    "attention",
  );
  assert.ok(
    model.exceptions.some(
      (item) => item.code === "daily-desk-evidence-expired",
    ),
  );
});
