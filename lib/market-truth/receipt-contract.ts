import {
  scheduledOwnerIds,
  scheduledOwnerOutcomeCodes,
  type ScheduledOwnerId,
  type ScheduledOwnerOutcomeCode,
  type ScheduledOwnerReceipt,
  type ScheduledOwnerReceiptState,
} from "@/lib/market-truth/types";

export const MARKET_TRUTH_RECEIPT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MARKET_TRUTH_RECEIPT_SCHEMA_VERSION = 1 as const;
export const MARKET_TRUTH_RECEIPT_MAX_COUNTS = 16;
export const MARKET_TRUTH_RECEIPT_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const receiptKeys = new Set([
  "schemaVersion",
  "owner",
  "state",
  "startedAt",
  "completedAt",
  "failedAt",
  "outcomeCode",
  "counts",
  "revision",
]);

const ownerSet = new Set<string>(scheduledOwnerIds);
const outcomeSet = new Set<string>(scheduledOwnerOutcomeCodes);
const states = new Set<string>(["started", "completed", "failed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function isNullableIso(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

function isSafeRevision(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 80 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  );
}

function normalizeCounts(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MARKET_TRUTH_RECEIPT_MAX_COUNTS) return null;

  const normalized: Record<string, number> = {};
  for (const [key, count] of entries.sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!/^[a-z][A-Za-z0-9]{0,31}$/.test(key)) return null;
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > 1_000_000_000
    ) {
      return null;
    }
    normalized[key] = count;
  }
  return normalized;
}

function stateTimestampsAreConsistent(
  input: {
    state: ScheduledOwnerReceiptState;
    startedAt: string;
    completedAt: string | null;
    failedAt: string | null;
  },
  now: number,
) {
  const start = Date.parse(input.startedAt);
  const latestAllowed = now + MARKET_TRUTH_RECEIPT_MAX_FUTURE_SKEW_MS;
  if (start > latestAllowed) return false;
  if (input.state === "started") {
    return input.completedAt === null && input.failedAt === null;
  }
  if (input.state === "completed") {
    return (
      input.completedAt !== null &&
      input.failedAt === null &&
      Date.parse(input.completedAt) >= start &&
      Date.parse(input.completedAt) <= latestAllowed
    );
  }
  return (
    input.completedAt === null &&
    input.failedAt !== null &&
    Date.parse(input.failedAt) >= start &&
    Date.parse(input.failedAt) <= latestAllowed
  );
}

const completedOutcomesByOwner: Record<
  ScheduledOwnerId,
  ReadonlySet<ScheduledOwnerOutcomeCode>
> = {
  "inventory-refresh": new Set([
    "completed",
    "completed-with-exceptions",
    "no-due-work",
  ]),
  "daily-desk-reconcile": new Set([
    "accepted",
    "already-current",
    "no-current-candidate",
    "disabled",
    "completed-with-exceptions",
  ]),
};

const failedOutcomesByOwner: Record<
  ScheduledOwnerId,
  ReadonlySet<ScheduledOwnerOutcomeCode>
> = {
  "inventory-refresh": new Set([
    "database-unavailable",
    "source-unavailable",
    "unexpected-failure",
  ]),
  "daily-desk-reconcile": new Set([
    "database-unavailable",
    "source-unavailable",
    "reconciliation-failed",
    "unexpected-failure",
  ]),
};

function outcomeMatchesState(
  owner: ScheduledOwnerId,
  state: ScheduledOwnerReceiptState,
  outcomeCode: ScheduledOwnerOutcomeCode,
) {
  if (state === "started") return outcomeCode === "started";
  return state === "failed"
    ? failedOutcomesByOwner[owner].has(outcomeCode)
    : completedOutcomesByOwner[owner].has(outcomeCode);
}

export function parseScheduledOwnerReceipt(
  value: unknown,
  expectedOwner?: ScheduledOwnerId,
  now: number | Date = Date.now(),
): ScheduledOwnerReceipt | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !receiptKeys.has(key))) return null;
  if (value.schemaVersion !== MARKET_TRUTH_RECEIPT_SCHEMA_VERSION) return null;
  if (typeof value.owner !== "string" || !ownerSet.has(value.owner))
    return null;
  if (expectedOwner && value.owner !== expectedOwner) return null;
  if (typeof value.state !== "string" || !states.has(value.state)) return null;
  if (!isIsoTimestamp(value.startedAt)) return null;
  if (!isNullableIso(value.completedAt) || !isNullableIso(value.failedAt))
    return null;
  if (
    typeof value.outcomeCode !== "string" ||
    !outcomeSet.has(value.outcomeCode)
  ) {
    return null;
  }
  if (!isSafeRevision(value.revision)) return null;
  const counts = normalizeCounts(value.counts);
  if (!counts) return null;

  const state = value.state as ScheduledOwnerReceiptState;
  const outcomeCode = value.outcomeCode as ScheduledOwnerOutcomeCode;
  const timestamps = {
    state,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
    failedAt: value.failedAt,
  };
  const nowMs = typeof now === "number" ? now : now.valueOf();
  if (!Number.isFinite(nowMs)) return null;
  if (!stateTimestampsAreConsistent(timestamps, nowMs)) return null;
  if (!outcomeMatchesState(value.owner as ScheduledOwnerId, state, outcomeCode))
    return null;

  return {
    schemaVersion: MARKET_TRUTH_RECEIPT_SCHEMA_VERSION,
    owner: value.owner as ScheduledOwnerId,
    state,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
    failedAt: value.failedAt,
    outcomeCode,
    counts,
    revision: value.revision,
  };
}

export function createScheduledOwnerReceipt(input: {
  owner: ScheduledOwnerId;
  state: ScheduledOwnerReceiptState;
  startedAt: string;
  settledAt?: string;
  outcomeCode: ScheduledOwnerOutcomeCode;
  counts?: Record<string, number>;
  revision: string;
}): ScheduledOwnerReceipt {
  const candidate = {
    schemaVersion: MARKET_TRUTH_RECEIPT_SCHEMA_VERSION,
    owner: input.owner,
    state: input.state,
    startedAt: input.startedAt,
    completedAt: input.state === "completed" ? (input.settledAt ?? null) : null,
    failedAt: input.state === "failed" ? (input.settledAt ?? null) : null,
    outcomeCode: input.outcomeCode,
    counts: input.counts ?? {},
    revision: input.revision,
  };
  const receipt = parseScheduledOwnerReceipt(candidate, input.owner);
  if (!receipt) throw new Error("market_truth_receipt_invalid");
  return receipt;
}

export function serializeScheduledOwnerReceipt(receipt: ScheduledOwnerReceipt) {
  const validated = parseScheduledOwnerReceipt(receipt, receipt.owner);
  if (!validated) throw new Error("market_truth_receipt_invalid");
  return JSON.stringify(validated);
}
