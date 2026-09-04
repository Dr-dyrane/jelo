export type MarketTruthLayerId =
  | "inventory"
  | "offers"
  | "retailers"
  | "discovery"
  | "physical-markets"
  | "daily-desk"
  | "public-projections";

export type MarketTruthLayerState =
  "current" | "review" | "attention" | "unknown";

export type MarketTruthExceptionSeverity = "critical" | "warning";

export type MarketTruthMetric = {
  label: string;
  value: number | string;
  state?: "current" | "attention" | "unknown";
};

export type MarketTruthLayer = {
  id: MarketTruthLayerId;
  label: string;
  state: MarketTruthLayerState;
  summary: string;
  observedAt: string | null;
  metrics: MarketTruthMetric[];
};

export type MarketTruthException = {
  id: string;
  code: string;
  severity: MarketTruthExceptionSeverity;
  layer: MarketTruthLayerId;
  title: string;
  summary: string;
  observedAt: string;
  threshold: string;
  owner: string;
  actionLabel: string;
  actionHref: string;
  runbook: string;
  overviewEligible: boolean;
};

export const scheduledOwnerIds = [
  "inventory-refresh",
  "daily-desk-reconcile",
] as const;

export type ScheduledOwnerId = (typeof scheduledOwnerIds)[number];
export type ScheduledOwnerReceiptState = "started" | "completed" | "failed";

export const scheduledOwnerOutcomeCodes = [
  "started",
  "completed",
  "completed-with-exceptions",
  "no-due-work",
  "accepted",
  "already-current",
  "no-current-candidate",
  "disabled",
  "database-unavailable",
  "source-unavailable",
  "reconciliation-failed",
  "unexpected-failure",
] as const;

export type ScheduledOwnerOutcomeCode =
  (typeof scheduledOwnerOutcomeCodes)[number];

export type ScheduledOwnerReceipt = {
  schemaVersion: 1;
  owner: ScheduledOwnerId;
  state: ScheduledOwnerReceiptState;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  outcomeCode: ScheduledOwnerOutcomeCode;
  counts: Record<string, number>;
  revision: string;
};

export type ScheduledOwnerReceiptRead =
  | { status: "present"; receipt: ScheduledOwnerReceipt }
  | { status: "missing" }
  | { status: "invalid" };

export type MarketTruthScheduledOwner = {
  id: ScheduledOwnerId;
  label: string;
  state: MarketTruthLayerState;
  cadenceMinutes: number;
  staleAfterMinutes: number;
  summary: string;
  receipt: ScheduledOwnerReceipt | null;
};

export type InventoryMarketTruthFacts = {
  observedAt: string;
  lastJobActivityAt: string | null;
  recentCompleted: number;
  recentFailed: number;
  recentDeferred: number;
  queued: number;
  due: number;
  processing: number;
  leaseExpired: number;
  deferred: number;
  publishedExactOffers: number;
  currentExactOffers: number;
  currentAvailableOffers: number;
  staleOffers: number;
  pricedCurrentOffers: number;
  pricedCurrentOffersWithHistory: number;
};

export type RetailerDiscoveryMarketTruthFacts = {
  observedAt: string;
  databaseRetailers: number;
  currentOfferRetailers: number;
  publishedProducts: number;
  productsWithKnownExactOffer: number;
  productsWithCurrentExactOffer: number;
  productsWithoutKnownExactOffer: number;
  productsWithoutCurrentExactOffer: number;
  pendingResearchTasks: number;
  inProgressResearchTasks: number;
  oldestOpenResearchAt: string | null;
  submittedRetailerApplications: number;
  pendingMarketReports: number;
};

export type StaticRetailerMarketTruthFacts = {
  registryRetailers: number;
  directoryListedRetailers: number;
  provisionalRetailers: number;
  identityEvidenceRecorded: number;
  identityEvidenceMissing: number;
  identityEvidenceWithExpiry: number;
  trustEvidenceWithReviewWindow: number;
  deliveryServiceEvidenceWithReviewWindow: number;
};

export type PhysicalMarketTruthFacts = {
  observedAt: string;
  publishedMarkets: number;
  verifiedLocations: number;
  currentActionableLocations: number;
  locationsNeedingRecheck: number;
  disputedLocations: number;
  pendingLocationEvidence: number;
  pendingProductObservations: number;
  staleApprovedProductObservations: number;
  directoryProductContexts: number;
  currentProductContexts: number;
  pendingMarketReports: number;
};

export type DailyDeskMarketTruthFacts = {
  date: string;
  status: "ready" | "no-campaign" | "evidence-expired" | "unavailable";
  acceptedDate: string | null;
  recency: "current-day" | "previous-day" | null;
  observedAt: string;
};

export type MarketTruthEvidence = {
  generatedAt: string;
  inventory: InventoryMarketTruthFacts | null;
  retailerDiscovery: RetailerDiscoveryMarketTruthFacts | null;
  staticRetailers: StaticRetailerMarketTruthFacts;
  physicalMarkets: PhysicalMarketTruthFacts | null;
  dailyDesk: DailyDeskMarketTruthFacts | null;
  scheduledOwnerReceipts: Partial<
    Record<ScheduledOwnerId, ScheduledOwnerReceiptRead>
  > | null;
};

export type MarketTruthReadModel = {
  generatedAt: string;
  state: MarketTruthLayerState;
  layers: MarketTruthLayer[];
  scheduledOwners: MarketTruthScheduledOwner[];
  exceptions: MarketTruthException[];
};
