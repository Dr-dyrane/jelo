export const INVENTORY_REFRESH_LEASE_MS = 2 * 60 * 1000;
export const INVENTORY_CRON_CLAIM_BUDGET_MS = 270 * 1000;
export const INVENTORY_CRON_BATCH_SIZE = 100;
export const INVENTORY_CRON_RUNS_PER_DAY = 24;
export const INVENTORY_CRON_LOOKAHEAD_HOURS = 1;
export const INVENTORY_REFRESH_FRESHNESS_MS = 24 * 60 * 60 * 1000;
export const INVENTORY_DEFERRED_RECHECK_MS = 24 * 60 * 60 * 1000;
export const INVENTORY_DEFERRED_RECHECK_ERROR_CODE =
  "inventory_refresh_daily_deferred";
const INVENTORY_REFRESH_LAST_ERROR_MAX_LENGTH = 1000;

export type InventoryRefreshRunStatus =
  "completed" | "retrying" | "deferred" | "failed" | "discarded";

export const INVENTORY_REFRESH_FAILURE_REASONS = [
  "route_scope",
  "product_identity",
  "package_size",
  "market_currency",
  "evidence_incomplete",
  "fetch_unavailable",
  "runtime",
  "claim_changed",
  "eligibility_changed",
] as const;

export type InventoryRefreshFailureReason =
  (typeof INVENTORY_REFRESH_FAILURE_REASONS)[number];

export type InventoryRefreshFailureDisposition = "terminal" | "transient";

export type InventoryRefreshTerminalReason = Extract<
  InventoryRefreshFailureReason,
  "route_scope" | "product_identity" | "package_size" | "market_currency"
>;

export function isInventoryRefreshTerminalReason(
  reason: InventoryRefreshFailureReason,
): reason is InventoryRefreshTerminalReason {
  return (
    reason === "route_scope" ||
    reason === "product_identity" ||
    reason === "package_size" ||
    reason === "market_currency"
  );
}

export class InventoryRefreshFailure extends Error {
  readonly disposition: InventoryRefreshFailureDisposition;
  readonly reason: InventoryRefreshFailureReason;

  constructor(input: {
    disposition: InventoryRefreshFailureDisposition;
    reason: InventoryRefreshFailureReason;
    message: string;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "InventoryRefreshFailure";
    this.disposition = input.disposition;
    this.reason = input.reason;
  }
}

type InventoryRefreshRunItem = {
  status: InventoryRefreshRunStatus;
  productSlug: string;
  recoveredLease: boolean;
  failureReason?: InventoryRefreshFailureReason;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function terminalScopeReason(
  message: string,
): InventoryRefreshTerminalReason | undefined {
  if (
    message === "Retailer redirected away from the verified product route." ||
    message ===
      "Retailer canonical URL does not match the verified product route."
  ) {
    return "route_scope";
  }
  if (
    message === "Retailer product title does not match the catalogue product."
  ) {
    return "product_identity";
  }
  if (
    message ===
      "Catalogue product size cannot be verified against retailer evidence." ||
    message === "Retailer product size does not match the catalogue product."
  ) {
    return "package_size";
  }
  if (
    /^Retailer currency does not match the [A-Z]{2} market\.$/i.test(message)
  ) {
    return "market_currency";
  }
  return undefined;
}

export function assertClassifiedInventoryRefreshScope(check: () => void) {
  try {
    check();
  } catch (error) {
    const message = errorMessage(error);
    const terminalReason = terminalScopeReason(message);
    throw new InventoryRefreshFailure({
      disposition: terminalReason ? "terminal" : "transient",
      reason:
        terminalReason ??
        (/evidence is missing|evidence is not measurable/.test(message)
          ? "evidence_incomplete"
          : "runtime"),
      message,
      cause: error,
    });
  }
}

export function transientInventoryRefreshFailure(
  reason: Extract<
    InventoryRefreshFailureReason,
    "evidence_incomplete" | "fetch_unavailable" | "runtime"
  >,
  message: string,
) {
  return new InventoryRefreshFailure({
    disposition: "transient",
    reason,
    message,
  });
}

export function classifyInventoryRefreshFailure(error: unknown) {
  if (error instanceof InventoryRefreshFailure) return error;
  return transientInventoryRefreshFailure("runtime", errorMessage(error));
}

export function inventoryRefreshFailureSettlement(input: {
  error: unknown;
  attemptCount: number;
  maxAttempts: number;
}) {
  const failure = classifyInventoryRefreshFailure(input.error);
  const invalidateOffer =
    failure.disposition === "terminal" &&
    isInventoryRefreshTerminalReason(failure.reason);
  return {
    failure,
    invalidateOffer,
    deferRecheck: invalidateOffer || input.attemptCount >= input.maxAttempts,
  };
}

export function inventoryRefreshLastError(input: {
  deferRecheck: boolean;
  failureReason: InventoryRefreshFailureReason;
  message: string;
}) {
  const prefix = input.deferRecheck
    ? `${INVENTORY_DEFERRED_RECHECK_ERROR_CODE}:${input.failureReason}:`
    : "";
  return `${prefix}${input.message}`.slice(
    0,
    INVENTORY_REFRESH_LAST_ERROR_MAX_LENGTH,
  );
}

export function canClaimInventoryRefreshJob(
  claimDeadlineAt: number | undefined,
  now = Date.now(),
) {
  return claimDeadlineAt == null || now < claimDeadlineAt;
}

export function summarizeInventoryRefreshRun(input: {
  queued: number;
  withdrawn: number;
  results: readonly InventoryRefreshRunItem[];
  stoppedByDeadline: boolean;
}) {
  const affectedProductSlugs = [
    ...new Set(
      input.results
        .filter((result) => result.status === "completed")
        .map((result) => result.productSlug),
    ),
  ].sort();
  const failureReasons = Object.fromEntries(
    INVENTORY_REFRESH_FAILURE_REASONS.map(
      (reason) =>
        [
          reason,
          input.results.filter((result) => result.failureReason === reason)
            .length,
        ] as const,
    ).filter(([, count]) => count > 0),
  ) as Partial<Record<InventoryRefreshFailureReason, number>>;

  return {
    queued: input.queued,
    withdrawn: input.withdrawn,
    processed: input.results.length,
    completed: input.results.filter((result) => result.status === "completed")
      .length,
    retrying: input.results.filter((result) => result.status === "retrying")
      .length,
    deferred: input.results.filter((result) => result.status === "deferred")
      .length,
    failed: input.results.filter((result) => result.status === "failed").length,
    discarded: input.results.filter((result) => result.status === "discarded")
      .length,
    recoveredLeases: input.results.filter((result) => result.recoveredLease)
      .length,
    failureReasons,
    stoppedByDeadline: input.stoppedByDeadline,
    affectedProductSlugs,
  };
}
