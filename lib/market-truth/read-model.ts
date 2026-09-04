import type {
  MarketTruthEvidence,
  MarketTruthException,
  MarketTruthLayer,
  MarketTruthLayerId,
  MarketTruthLayerState,
  MarketTruthReadModel,
  MarketTruthScheduledOwner,
  ScheduledOwnerId,
  ScheduledOwnerReceipt,
} from "@/lib/market-truth/types";

export const MARKET_TRUTH_THRESHOLDS = {
  inventoryActivityMinutes: 90,
  staleOffers: 0,
  deferredRechecks: 5,
  expiredLeases: 0,
  priceHistoryGaps: 0,
  productOfferGaps: 0,
  retailerEvidenceGaps: 0,
  physicalEvidenceGaps: 0,
  scheduledOwnerStaleMinutes: 90,
  scheduledOwnerRunningMinutes: 15,
} as const;

const ownerDefinitions: ReadonlyArray<{
  id: ScheduledOwnerId;
  label: string;
}> = [
  { id: "inventory-refresh", label: "Offer refresh" },
  { id: "daily-desk-reconcile", label: "Daily Desk" },
];

const layerOrder: readonly MarketTruthLayerId[] = [
  "inventory",
  "offers",
  "retailers",
  "discovery",
  "physical-markets",
  "daily-desk",
  "public-projections",
];

const stateRank: Record<MarketTruthLayerState, number> = {
  current: 0,
  review: 1,
  unknown: 2,
  attention: 3,
};

function strongestState(
  ...states: Array<MarketTruthLayerState | null | undefined>
): MarketTruthLayerState {
  return states.reduce<MarketTruthLayerState>(
    (current, state) =>
      state && stateRank[state] > stateRank[current] ? state : current,
    "current",
  );
}

function safeAgeMinutes(timestamp: string | null, now: Date) {
  if (!timestamp) return null;
  const observed = Date.parse(timestamp);
  if (!Number.isFinite(observed)) return null;
  const ageMs = now.valueOf() - observed;
  if (ageMs < 0) return null;
  return Math.floor(ageMs / 60_000);
}

function settledAt(receipt: ScheduledOwnerReceipt) {
  return receipt.completedAt ?? receipt.failedAt ?? receipt.startedAt;
}

function exception(
  input: Omit<MarketTruthException, "overviewEligible"> & {
    overviewEligible?: boolean;
  },
): MarketTruthException {
  return { ...input, overviewEligible: input.overviewEligible ?? false };
}

function unavailableException(
  layer: MarketTruthLayerId,
  title: string,
  generatedAt: string,
): MarketTruthException {
  return exception({
    id: `${layer}:source-unavailable`,
    code: "source-unavailable",
    severity: "critical",
    layer,
    title,
    summary:
      "This evidence layer could not be read, so its current state is unknown.",
    observedAt: generatedAt,
    threshold: "Readable on every check",
    owner: "Platform operations",
    actionLabel: "Inspect market health",
    actionHref: `/ops/market-health#${layer}`,
    runbook: "Linked market truth · Source recovery",
    overviewEligible: true,
  });
}

function assessScheduledOwners(
  receipts: MarketTruthEvidence["scheduledOwnerReceipts"],
  generatedAt: string,
  now: Date,
) {
  const exceptions: MarketTruthException[] = [];
  const scheduledOwners: MarketTruthScheduledOwner[] = ownerDefinitions.map(
    ({ id, label }) => {
      const layer: MarketTruthLayerId =
        id === "inventory-refresh" ? "inventory" : "daily-desk";
      const actionHref = `/ops/market-health#owner-${id}`;
      const receiptRead = receipts?.[id];

      if (!receipts || !receiptRead) {
        exceptions.push(
          exception({
            id: `owner:${id}:unavailable`,
            code: "scheduled-owner-receipt-unavailable",
            severity: "critical",
            layer,
            title: `${label} receipt unavailable`,
            summary: "The last scheduled outcome cannot be verified.",
            observedAt: generatedAt,
            threshold: `Receipt within ${MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes} minutes`,
            owner: "Platform operations",
            actionLabel: "Inspect owner",
            actionHref,
            runbook: "Linked market truth · Scheduled owner recovery",
            overviewEligible: true,
          }),
        );
        return {
          id,
          label,
          state: "unknown",
          cadenceMinutes: 60,
          staleAfterMinutes: MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes,
          summary: "Last outcome unavailable",
          receipt: null,
        };
      }

      if (receiptRead.status !== "present") {
        const invalid = receiptRead.status === "invalid";
        exceptions.push(
          exception({
            id: `owner:${id}:${receiptRead.status}`,
            code: invalid
              ? "scheduled-owner-receipt-invalid"
              : "scheduled-owner-receipt-missing",
            severity: "critical",
            layer,
            title: `${label} receipt ${invalid ? "invalid" : "missing"}`,
            summary: invalid
              ? "The stored outcome failed its bounded receipt contract."
              : "No scheduled outcome has been recorded.",
            observedAt: generatedAt,
            threshold: `Receipt within ${MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes} minutes`,
            owner: "Platform operations",
            actionLabel: "Inspect owner",
            actionHref,
            runbook: "Linked market truth · Scheduled owner recovery",
            overviewEligible: true,
          }),
        );
        return {
          id,
          label,
          state: "unknown",
          cadenceMinutes: 60,
          staleAfterMinutes: MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes,
          summary: invalid ? "Stored outcome invalid" : "No outcome recorded",
          receipt: null,
        };
      }

      const receipt = receiptRead.receipt;
      const ageMinutes = safeAgeMinutes(settledAt(receipt), now);
      if (receipt.state === "failed") {
        exceptions.push(
          exception({
            id: `owner:${id}:failed`,
            code: "scheduled-owner-failed",
            severity: "critical",
            layer,
            title: `${label} failed`,
            summary:
              "The latest scheduled run ended before its work was reconciled.",
            observedAt: receipt.failedAt ?? receipt.startedAt,
            threshold: "Latest run completes",
            owner: "Platform operations",
            actionLabel: "Inspect owner",
            actionHref,
            runbook: "Linked market truth · Scheduled owner recovery",
            overviewEligible: true,
          }),
        );
        return {
          id,
          label,
          state: "attention",
          cadenceMinutes: 60,
          staleAfterMinutes: MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes,
          summary: "Latest run failed",
          receipt,
        };
      }

      if (
        receipt.state === "started" &&
        (ageMinutes == null ||
          ageMinutes > MARKET_TRUTH_THRESHOLDS.scheduledOwnerRunningMinutes)
      ) {
        exceptions.push(
          exception({
            id: `owner:${id}:running-too-long`,
            code: "scheduled-owner-running-too-long",
            severity: "critical",
            layer,
            title: `${label} has not settled`,
            summary: "The latest run is still marked as started.",
            observedAt: receipt.startedAt,
            threshold: `Settles within ${MARKET_TRUTH_THRESHOLDS.scheduledOwnerRunningMinutes} minutes`,
            owner: "Platform operations",
            actionLabel: "Inspect owner",
            actionHref,
            runbook: "Linked market truth · Scheduled owner recovery",
            overviewEligible: true,
          }),
        );
        return {
          id,
          label,
          state: "attention",
          cadenceMinutes: 60,
          staleAfterMinutes: MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes,
          summary: "Run has not settled",
          receipt,
        };
      }

      if (
        ageMinutes == null ||
        ageMinutes > MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes
      ) {
        exceptions.push(
          exception({
            id: `owner:${id}:stale`,
            code: "scheduled-owner-receipt-stale",
            severity: "warning",
            layer,
            title: `${label} receipt is stale`,
            summary:
              "The last settled outcome is outside its hourly review window.",
            observedAt: settledAt(receipt),
            threshold: `At most ${MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes} minutes old`,
            owner: "Platform operations",
            actionLabel: "Inspect owner",
            actionHref,
            runbook: "Linked market truth · Scheduled owner recovery",
            overviewEligible: true,
          }),
        );
        return {
          id,
          label,
          state: "attention",
          cadenceMinutes: 60,
          staleAfterMinutes: MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes,
          summary: "Last outcome is stale",
          receipt,
        };
      }

      const hasExceptions = receipt.outcomeCode === "completed-with-exceptions";
      const disabled =
        id === "daily-desk-reconcile" && receipt.outcomeCode === "disabled";
      if (hasExceptions) {
        exceptions.push(
          exception({
            id: `owner:${id}:exceptions`,
            code: "scheduled-owner-completed-with-exceptions",
            severity: "warning",
            layer,
            title: `${label} completed with exceptions`,
            summary:
              "The run settled, but some evidence could not be reconciled.",
            observedAt: receipt.completedAt ?? receipt.startedAt,
            threshold: "Zero unresolved exceptions",
            owner: "Platform operations",
            actionLabel: "Inspect owner",
            actionHref,
            runbook: "Linked market truth · Scheduled owner recovery",
            overviewEligible: true,
          }),
        );
      }
      return {
        id,
        label,
        state:
          disabled || hasExceptions
            ? "attention"
            : receipt.state === "started"
              ? "review"
              : "current",
        cadenceMinutes: 60,
        staleAfterMinutes: MARKET_TRUTH_THRESHOLDS.scheduledOwnerStaleMinutes,
        summary:
          receipt.state === "started"
            ? "Run in progress"
            : disabled
              ? "Automatic reconciliation disabled"
              : hasExceptions
                ? "Completed with exceptions"
                : "Last run settled",
        receipt,
      };
    },
  );
  return { scheduledOwners, exceptions };
}

function ownerState(
  owners: readonly MarketTruthScheduledOwner[],
  id: ScheduledOwnerId,
) {
  return owners.find((owner) => owner.id === id)?.state ?? "unknown";
}

export function buildMarketTruthReadModel(
  evidence: MarketTruthEvidence,
): MarketTruthReadModel {
  const now = new Date(evidence.generatedAt);
  if (!Number.isFinite(now.valueOf())) {
    throw new Error("market_truth_clock_invalid");
  }

  const ownerAssessment = assessScheduledOwners(
    evidence.scheduledOwnerReceipts,
    evidence.generatedAt,
    now,
  );
  const exceptions = [...ownerAssessment.exceptions];
  const layers: MarketTruthLayer[] = [];

  if (!evidence.inventory) {
    exceptions.push(
      unavailableException(
        "inventory",
        "Offer refresh evidence unavailable",
        evidence.generatedAt,
      ),
    );
    layers.push({
      id: "inventory",
      label: "Retailer refresh",
      state: "unknown",
      summary: "Queue and run state unavailable",
      observedAt: null,
      metrics: [],
    });
    layers.push({
      id: "offers",
      label: "Exact offers",
      state: "unknown",
      summary: "Offer freshness and history unavailable",
      observedAt: null,
      metrics: [],
    });
  } else {
    const inventory = evidence.inventory;
    const activityAge = safeAgeMinutes(inventory.lastJobActivityAt, now);
    let inventoryState = ownerState(
      ownerAssessment.scheduledOwners,
      "inventory-refresh",
    );
    if (
      inventory.due > 0 &&
      (activityAge == null ||
        activityAge > MARKET_TRUTH_THRESHOLDS.inventoryActivityMinutes)
    ) {
      inventoryState = "attention";
      exceptions.push(
        exception({
          id: "inventory:missed-activity",
          code: "inventory-activity-missed",
          severity: "critical",
          layer: "inventory",
          title: "Due offer refreshes are not moving",
          summary: `${inventory.due} due ${inventory.due === 1 ? "offer has" : "offers have"} no recent queue activity.`,
          observedAt: inventory.observedAt,
          threshold: `Activity within ${MARKET_TRUTH_THRESHOLDS.inventoryActivityMinutes} minutes when work is due`,
          owner: "Inventory operations",
          actionLabel: "Inspect refresh queue",
          actionHref: "/ops/market-health#inventory",
          runbook: "Retail intelligence · Inventory refresh recovery",
          overviewEligible: true,
        }),
      );
    }
    if (inventory.leaseExpired > MARKET_TRUTH_THRESHOLDS.expiredLeases) {
      inventoryState = "attention";
      exceptions.push(
        exception({
          id: "inventory:expired-leases",
          code: "inventory-lease-expired",
          severity: "critical",
          layer: "inventory",
          title: "Offer refresh claims need recovery",
          summary: `${inventory.leaseExpired} ${inventory.leaseExpired === 1 ? "claim is" : "claims are"} past the processing lease.`,
          observedAt: inventory.observedAt,
          threshold: "Zero expired processing leases",
          owner: "Inventory operations",
          actionLabel: "Inspect refresh queue",
          actionHref: "/ops/market-health#inventory",
          runbook: "Retail intelligence · Inventory refresh recovery",
          overviewEligible: true,
        }),
      );
    }
    if (inventory.deferred >= MARKET_TRUTH_THRESHOLDS.deferredRechecks) {
      inventoryState = "attention";
      exceptions.push(
        exception({
          id: "inventory:deferred-rechecks",
          code: "inventory-deferred-recheck-threshold-exceeded",
          severity: "warning",
          layer: "inventory",
          title: "Offer refreshes need source review",
          summary: `${inventory.deferred} refreshes are waiting for a later source check.`,
          observedAt: inventory.observedAt,
          threshold: `Fewer than ${MARKET_TRUTH_THRESHOLDS.deferredRechecks} deferred rechecks`,
          owner: "Inventory operations",
          actionLabel: "Inspect refresh queue",
          actionHref: "/ops/market-health#inventory",
          runbook: "Retail intelligence · Inventory adapter recovery",
          overviewEligible: true,
        }),
      );
    }
    if (
      (inventory.recentFailed > 0 || inventory.recentDeferred > 0) &&
      inventory.recentCompleted === 0
    ) {
      inventoryState = "attention";
      exceptions.push(
        exception({
          id: "inventory:no-recent-completions",
          code: "inventory-no-recent-completions",
          severity: "warning",
          layer: "inventory",
          title: "Recent refreshes produced no verified offers",
          summary: `${inventory.recentFailed} failed and ${inventory.recentDeferred} deferred in the last 90 minutes.`,
          observedAt: inventory.observedAt,
          threshold: "At least one completion when failures or deferrals occur",
          owner: "Inventory operations",
          actionLabel: "Inspect refresh queue",
          actionHref: "/ops/market-health#inventory",
          runbook: "Retail intelligence · Inventory adapter recovery",
          overviewEligible: true,
        }),
      );
    }
    layers.push({
      id: "inventory",
      label: "Retailer refresh",
      state: inventoryState,
      summary:
        inventory.due > 0
          ? `${inventory.due} due · ${inventory.recentCompleted} completed recently`
          : `${inventory.recentCompleted} completed recently · nothing due`,
      observedAt: inventory.observedAt,
      metrics: [
        { label: "Due", value: inventory.due },
        { label: "Queued", value: inventory.queued },
        { label: "Deferred", value: inventory.deferred },
        {
          label: "Expired claims",
          value: inventory.leaseExpired,
          state: inventory.leaseExpired > 0 ? "attention" : "current",
        },
      ],
    });

    const historyGaps =
      inventory.pricedCurrentOffers - inventory.pricedCurrentOffersWithHistory;
    let offerState: MarketTruthLayerState = "current";
    const nonCurrentOffers = Math.max(
      0,
      inventory.publishedExactOffers - inventory.currentExactOffers,
    );
    if (nonCurrentOffers > MARKET_TRUTH_THRESHOLDS.staleOffers) {
      offerState = "attention";
      exceptions.push(
        exception({
          id: "offers:stale-threshold",
          code: "stale-offer-threshold-exceeded",
          severity: "warning",
          layer: "offers",
          title: "Exact offers are outside their current window",
          summary: `${nonCurrentOffers} ${nonCurrentOffers === 1 ? "offer is" : "offers are"} not current; ${inventory.staleOffers} have no active refresh work.`,
          observedAt: inventory.observedAt,
          threshold: "Every published exact offer is current",
          owner: "Inventory operations",
          actionLabel: "Inspect exact offers",
          actionHref: "/ops/market-health#offers",
          runbook: "Retail intelligence · Offer freshness",
          overviewEligible: true,
        }),
      );
    }
    if (historyGaps > MARKET_TRUTH_THRESHOLDS.priceHistoryGaps) {
      offerState = "attention";
      exceptions.push(
        exception({
          id: "offers:history-gaps",
          code: "price-history-gap",
          severity: "critical",
          layer: "offers",
          title: "Current prices are missing history",
          summary: `${historyGaps} current priced ${historyGaps === 1 ? "offer has" : "offers have"} no matching price observation.`,
          observedAt: inventory.observedAt,
          threshold: "Zero current priced offers without history",
          owner: "Catalogue operations",
          actionLabel: "Inspect exact offers",
          actionHref: "/ops/market-health#offers",
          runbook: "Retail intelligence · Price-history integrity",
          overviewEligible: true,
        }),
      );
    }
    layers.push({
      id: "offers",
      label: "Exact offers",
      state: offerState,
      summary: `${inventory.currentExactOffers} of ${inventory.publishedExactOffers} listings are current`,
      observedAt: inventory.observedAt,
      metrics: [
        { label: "Current", value: inventory.currentExactOffers },
        { label: "Available", value: inventory.currentAvailableOffers },
        {
          label: "Not current",
          value: nonCurrentOffers,
          state:
            nonCurrentOffers > MARKET_TRUTH_THRESHOLDS.staleOffers
              ? "attention"
              : "current",
        },
        {
          label: "History gaps",
          value: historyGaps,
          state: historyGaps > 0 ? "attention" : "current",
        },
      ],
    });
  }

  const staticRetailers = evidence.staticRetailers;
  const retailerEvidenceGaps =
    staticRetailers.identityEvidenceMissing +
    (staticRetailers.identityEvidenceRecorded -
      staticRetailers.identityEvidenceWithExpiry);
  let retailerState: MarketTruthLayerState = evidence.retailerDiscovery
    ? "current"
    : "unknown";
  if (!evidence.retailerDiscovery) {
    exceptions.push(
      unavailableException(
        "retailers",
        "Retailer evidence unavailable",
        evidence.generatedAt,
      ),
    );
  }
  if (retailerEvidenceGaps > MARKET_TRUTH_THRESHOLDS.retailerEvidenceGaps) {
    retailerState = "attention";
    exceptions.push(
      exception({
        id: "retailers:identity-currentness",
        code: "retailer-identity-currentness-unproven",
        severity: "warning",
        layer: "retailers",
        title: "Retailer identity currentness is incomplete",
        summary: `${staticRetailers.identityEvidenceMissing} retailer records lack identity evidence; ${staticRetailers.identityEvidenceRecorded - staticRetailers.identityEvidenceWithExpiry} evidenced records have no review deadline.`,
        observedAt: evidence.generatedAt,
        threshold:
          "Every public retailer has current reviewed identity evidence",
        owner: "Retail research",
        actionLabel: "Review retailer research",
        actionHref: "/ops/research",
        runbook: "Retail intelligence · Retailer evidence review",
      }),
    );
  }
  if (
    staticRetailers.trustEvidenceWithReviewWindow <
    staticRetailers.registryRetailers
  ) {
    retailerState = "attention";
    exceptions.push(
      exception({
        id: "retailers:trust-currentness",
        code: "retailer-trust-currentness-untracked",
        severity: "warning",
        layer: "retailers",
        title: "Retailer trust freshness is not tracked",
        summary: "Trust scores have no reviewed-at and expiry evidence pair.",
        observedAt: evidence.generatedAt,
        threshold: "Every trust claim has a current review window",
        owner: "Retail research",
        actionLabel: "Inspect retailer evidence",
        actionHref: "/ops/market-health#retailers",
        runbook: "Retail intelligence · Retailer trust governance",
      }),
    );
  }
  if (
    staticRetailers.deliveryServiceEvidenceWithReviewWindow <
    staticRetailers.registryRetailers
  ) {
    retailerState = "attention";
    exceptions.push(
      exception({
        id: "retailers:service-currentness",
        code: "retailer-service-currentness-untracked",
        severity: "warning",
        layer: "retailers",
        title: "Delivery and service freshness is not tracked",
        summary:
          "Registry notes cannot be treated as current reviewed service evidence.",
        observedAt: evidence.generatedAt,
        threshold: "Every public service claim has a current review window",
        owner: "Retail research",
        actionLabel: "Inspect retailer evidence",
        actionHref: "/ops/market-health#retailers",
        runbook: "Retail intelligence · Retailer service governance",
      }),
    );
  }
  layers.push({
    id: "retailers",
    label: "Retailer facts",
    state: retailerState,
    summary: evidence.retailerDiscovery
      ? `${evidence.retailerDiscovery.currentOfferRetailers} retailers have current exact offers`
      : "Retailer activity unavailable",
    observedAt: evidence.retailerDiscovery?.observedAt ?? null,
    metrics: [
      { label: "Registry", value: staticRetailers.registryRetailers },
      {
        label: "Identity recorded",
        value: staticRetailers.identityEvidenceRecorded,
      },
      {
        label: "Current identity",
        value: staticRetailers.identityEvidenceWithExpiry,
        state:
          staticRetailers.identityEvidenceWithExpiry ===
          staticRetailers.registryRetailers
            ? "current"
            : "unknown",
      },
      {
        label: "Current trust",
        value: staticRetailers.trustEvidenceWithReviewWindow,
        state: "unknown",
      },
    ],
  });

  if (!evidence.retailerDiscovery) {
    exceptions.push(
      unavailableException(
        "discovery",
        "Discovery review evidence unavailable",
        evidence.generatedAt,
      ),
    );
    layers.push({
      id: "discovery",
      label: "Discovery and review",
      state: "unknown",
      summary: "Offer and retailer review queues unavailable",
      observedAt: null,
      metrics: [],
    });
  } else {
    const discovery = evidence.retailerDiscovery;
    const reviewCount =
      discovery.pendingResearchTasks +
      discovery.inProgressResearchTasks +
      discovery.submittedRetailerApplications +
      discovery.pendingMarketReports;
    let discoveryState: MarketTruthLayerState =
      reviewCount > 0 ? "review" : "current";
    if (
      discovery.productsWithoutKnownExactOffer >
      MARKET_TRUTH_THRESHOLDS.productOfferGaps
    ) {
      discoveryState = "attention";
      exceptions.push(
        exception({
          id: "discovery:offerless-products",
          code: "published-product-without-known-offer",
          severity: "warning",
          layer: "discovery",
          title: "Published products need offer discovery",
          summary: `${discovery.productsWithoutKnownExactOffer} published ${discovery.productsWithoutKnownExactOffer === 1 ? "product has" : "products have"} no reviewed exact Nigerian offer.`,
          observedAt: discovery.observedAt,
          threshold: "Zero published products without a reviewed exact offer",
          owner: "Catalogue research",
          actionLabel: "Review research",
          actionHref: "/ops/research",
          runbook: "Catalogue operations · New-offer discovery",
          overviewEligible: true,
        }),
      );
    }
    const productsWithKnownButNoCurrentOffer = Math.max(
      0,
      discovery.productsWithoutCurrentExactOffer -
        discovery.productsWithoutKnownExactOffer,
    );
    if (productsWithKnownButNoCurrentOffer > 0) {
      discoveryState = "attention";
      exceptions.push(
        exception({
          id: "discovery:noncurrent-products",
          code: "published-product-without-current-offer",
          severity: "warning",
          layer: "discovery",
          title: "Published products need current offer evidence",
          summary: `${productsWithKnownButNoCurrentOffer} published ${productsWithKnownButNoCurrentOffer === 1 ? "product has" : "products have"} reviewed offers but none currently actionable.`,
          observedAt: discovery.observedAt,
          threshold:
            "Every product with a known offer has one current exact offer",
          owner: "Inventory operations",
          actionLabel: "Inspect exact offers",
          actionHref: "/ops/market-health#offers",
          runbook: "Retail intelligence · Offer freshness",
          overviewEligible: true,
        }),
      );
    }
    layers.push({
      id: "discovery",
      label: "Discovery and review",
      state: discoveryState,
      summary:
        reviewCount > 0
          ? `${reviewCount} reviewed-work items are open`
          : "No reviewed-work items are open",
      observedAt: discovery.observedAt,
      metrics: [
        { label: "Research", value: discovery.pendingResearchTasks },
        { label: "In progress", value: discovery.inProgressResearchTasks },
        {
          label: "Retailer applications",
          value: discovery.submittedRetailerApplications,
        },
        { label: "Market reports", value: discovery.pendingMarketReports },
      ],
    });
  }

  if (!evidence.physicalMarkets) {
    exceptions.push(
      unavailableException(
        "physical-markets",
        "Physical-market evidence unavailable",
        evidence.generatedAt,
      ),
    );
    layers.push({
      id: "physical-markets",
      label: "Physical markets",
      state: "unknown",
      summary: "Location and stock evidence unavailable",
      observedAt: null,
      metrics: [],
    });
  } else {
    const physical = evidence.physicalMarkets;
    const nonCurrentContexts = Math.max(
      0,
      physical.directoryProductContexts - physical.currentProductContexts,
    );
    let physicalState: MarketTruthLayerState =
      physical.pendingLocationEvidence +
        physical.pendingProductObservations +
        physical.pendingMarketReports >
      0
        ? "review"
        : "current";
    if (
      physical.locationsNeedingRecheck > 0 ||
      physical.disputedLocations > 0 ||
      physical.staleApprovedProductObservations > 0 ||
      nonCurrentContexts > 0
    ) {
      physicalState = "attention";
      exceptions.push(
        exception({
          id: "physical-markets:noncurrent-evidence",
          code: "physical-market-evidence-needs-review",
          severity: "warning",
          layer: "physical-markets",
          title: "Physical-market evidence needs review",
          summary: `${physical.locationsNeedingRecheck} locations, ${physical.disputedLocations} disputes and ${physical.staleApprovedProductObservations} observations need recheck.`,
          observedAt: physical.observedAt,
          threshold: "Zero expired, disputed or non-actionable public evidence",
          owner: "Market review",
          actionLabel: "Review contributions",
          actionHref: "/ops/contributions",
          runbook: "Market Finder · Physical evidence review",
          overviewEligible: true,
        }),
      );
    }
    if (nonCurrentContexts > 0) {
      exceptions.push(
        exception({
          id: "physical-markets:directory-context-gap",
          code: "market-directory-context-not-current",
          severity: "warning",
          layer: "physical-markets",
          title: "Market directory includes non-current products",
          summary: `${nonCurrentContexts} ${nonCurrentContexts === 1 ? "product context appears" : "product contexts appear"} in discovery without a current actionable place.`,
          observedAt: physical.observedAt,
          threshold: "Directory contexts equal current actionable contexts",
          owner: "Market review",
          actionLabel: "Inspect physical markets",
          actionHref: "/ops/market-health#physical-markets",
          runbook: "Market Finder · Public projection integrity",
          overviewEligible: true,
        }),
      );
    }
    layers.push({
      id: "physical-markets",
      label: "Physical markets",
      state: physicalState,
      summary: `${physical.currentProductContexts} current product-place contexts across ${physical.publishedMarkets} published ${physical.publishedMarkets === 1 ? "market" : "markets"}`,
      observedAt: physical.observedAt,
      metrics: [
        { label: "Current places", value: physical.currentActionableLocations },
        { label: "Current products", value: physical.currentProductContexts },
        {
          label: "Needs recheck",
          value: physical.locationsNeedingRecheck,
          state: physical.locationsNeedingRecheck > 0 ? "attention" : "current",
        },
        {
          label: "Pending evidence",
          value:
            physical.pendingLocationEvidence +
            physical.pendingProductObservations,
        },
      ],
    });
  }

  const dailyDeskOwner = ownerAssessment.scheduledOwners.find(
    (owner) => owner.id === "daily-desk-reconcile",
  );
  if (!evidence.dailyDesk || evidence.dailyDesk.status === "unavailable") {
    exceptions.push(
      unavailableException(
        "daily-desk",
        "Daily Desk state unavailable",
        evidence.generatedAt,
      ),
    );
    layers.push({
      id: "daily-desk",
      label: "Daily Desk",
      state: "unknown",
      summary: "Current public evidence unavailable",
      observedAt: evidence.dailyDesk?.observedAt ?? null,
      metrics: [],
    });
  } else {
    const desk = evidence.dailyDesk;
    const receipt = dailyDeskOwner?.receipt;
    let deskState = dailyDeskOwner?.state ?? "unknown";
    if (desk.status === "evidence-expired") {
      deskState = "attention";
      exceptions.push(
        exception({
          id: "daily-desk:evidence-expired",
          code: "daily-desk-evidence-expired",
          severity: "warning",
          layer: "daily-desk",
          title: "Daily Desk evidence is no longer current",
          summary:
            "The accepted story no longer matches an actionable exact offer.",
          observedAt: desk.observedAt,
          threshold:
            "Every public Desk story matches current exact-offer evidence",
          owner: "Campaign operations",
          actionLabel: "Inspect Daily Desk",
          actionHref: "/ops/market-health#daily-desk",
          runbook: "Daily campaigns · Daily Desk reconciliation",
          overviewEligible: true,
        }),
      );
    }
    if (
      desk.status === "no-campaign" &&
      receipt?.state === "completed" &&
      ["accepted", "already-current"].includes(receipt.outcomeCode)
    ) {
      deskState = "attention";
      exceptions.push(
        exception({
          id: "daily-desk:acceptance-mismatch",
          code: "daily-desk-acceptance-mismatch",
          severity: "critical",
          layer: "daily-desk",
          title: "Daily Desk receipt and acceptance disagree",
          summary:
            "The scheduled owner reports acceptance, but today’s public record is absent.",
          observedAt: desk.observedAt,
          threshold: "Accepted outcome has one same-day public record",
          owner: "Campaign operations",
          actionLabel: "Inspect Daily Desk",
          actionHref: "/ops/market-health#daily-desk",
          runbook: "Daily campaigns · Daily Desk reconciliation",
          overviewEligible: true,
        }),
      );
    }
    const noCandidate = receipt?.outcomeCode === "no-current-candidate";
    const disabled = receipt?.outcomeCode === "disabled";
    if (disabled) {
      deskState = "attention";
      exceptions.push(
        exception({
          id: "daily-desk:disabled",
          code: "daily-desk-reconciliation-disabled",
          severity: "warning",
          layer: "daily-desk",
          title: "Daily Desk reconciliation is disabled",
          summary:
            "The scheduled owner is healthy, but automatic same-day acceptance is off.",
          observedAt: desk.observedAt,
          threshold: "Same-day reconciliation is enabled",
          owner: "Campaign operations",
          actionLabel: "Inspect Daily Desk",
          actionHref: "/ops/market-health#daily-desk",
          runbook: "Daily campaigns · Daily Desk reconciliation",
          overviewEligible: true,
        }),
      );
    }
    if (
      desk.status === "no-campaign" &&
      receipt?.state === "completed" &&
      !noCandidate &&
      !disabled &&
      !["accepted", "already-current"].includes(receipt.outcomeCode)
    ) {
      deskState = "attention";
      exceptions.push(
        exception({
          id: "daily-desk:settled-without-resolution",
          code: "daily-desk-settled-without-resolution",
          severity: "warning",
          layer: "daily-desk",
          title: "Daily Desk has no resolved public outcome",
          summary:
            "The owner settled, but the result does not explain the missing Desk story.",
          observedAt: desk.observedAt,
          threshold:
            "A settled run records accepted, already current or no current candidate",
          owner: "Campaign operations",
          actionLabel: "Inspect Daily Desk",
          actionHref: "/ops/market-health#daily-desk",
          runbook: "Daily campaigns · Daily Desk reconciliation",
          overviewEligible: true,
        }),
      );
    }
    layers.push({
      id: "daily-desk",
      label: "Daily Desk",
      state: deskState,
      summary: disabled
        ? "Automatic same-day reconciliation is disabled"
        : desk.status === "ready"
          ? desk.recency === "previous-day"
            ? `Current fallback from ${desk.acceptedDate}`
            : `Accepted for ${desk.acceptedDate}`
          : desk.status === "evidence-expired"
            ? "Accepted story suppressed after evidence changed"
            : noCandidate
              ? `No qualified candidate for ${desk.date}`
              : `No accepted record for ${desk.date}`,
      observedAt: desk.observedAt,
      metrics: [
        {
          label: "Today",
          value: disabled
            ? "Disabled"
            : desk.status === "ready"
              ? desk.recency === "previous-day"
                ? "Current fallback"
                : "Accepted"
              : desk.status === "evidence-expired"
                ? "Suppressed"
                : noCandidate
                  ? "No candidate"
                  : "Unknown",
          state: disabled
            ? "attention"
            : desk.status === "ready" || noCandidate
              ? "current"
              : desk.status === "evidence-expired"
                ? "attention"
                : "unknown",
        },
      ],
    });
  }

  const offerLayer = layers.find((layer) => layer.id === "offers");
  const retailerLayer = layers.find((layer) => layer.id === "retailers");
  const discoveryLayer = layers.find((layer) => layer.id === "discovery");
  const physicalLayer = layers.find((layer) => layer.id === "physical-markets");
  const deskLayer = layers.find((layer) => layer.id === "daily-desk");
  const currentProductCount =
    evidence.retailerDiscovery?.productsWithCurrentExactOffer ?? "Unknown";
  const currentMarketContextCount =
    evidence.physicalMarkets?.currentProductContexts ?? "Unknown";
  layers.push({
    id: "public-projections",
    label: "Public projections",
    state: strongestState(
      offerLayer?.state,
      retailerLayer?.state,
      discoveryLayer?.state,
      physicalLayer?.state,
      deskLayer?.state,
    ),
    summary:
      "Products, Share, Markets and Daily Desk read the governed evidence chain",
    observedAt: evidence.generatedAt,
    metrics: [
      { label: "Products current", value: currentProductCount },
      { label: "Market contexts", value: currentMarketContextCount },
      {
        label: "Daily Desk",
        value:
          dailyDeskOwner?.receipt?.outcomeCode === "disabled"
            ? "Reconciliation off"
            : evidence.dailyDesk?.status === "ready"
              ? "Current"
              : evidence.dailyDesk?.status === "evidence-expired"
                ? "Suppressed"
                : evidence.dailyDesk?.status === "no-campaign"
                  ? "No record"
                  : "Unknown",
      },
    ],
  });

  const orderedLayers = layerOrder.flatMap((id) => {
    const layer = layers.find((candidate) => candidate.id === id);
    return layer ? [layer] : [];
  });
  const orderedExceptions = exceptions.sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "critical" ? -1 : 1;
    }
    const layerDifference =
      layerOrder.indexOf(left.layer) - layerOrder.indexOf(right.layer);
    return layerDifference || left.id.localeCompare(right.id);
  });

  return {
    generatedAt: evidence.generatedAt,
    state: strongestState(...orderedLayers.map((layer) => layer.state)),
    layers: orderedLayers,
    scheduledOwners: ownerAssessment.scheduledOwners,
    exceptions: orderedExceptions,
  };
}
