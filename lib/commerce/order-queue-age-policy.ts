export const OPS_ORDER_QUEUE_AGE_POLICY_SCHEMA_VERSION = 1;
export const OPS_ORDER_QUEUE_AGE_POLICY_SOURCE =
  "recommended-policy-2026-09-03";
export const OPS_ORDER_QUEUE_AGE_ACCOUNTABLE_OWNER = "JeloCare Operations";

export const OPS_ORDER_QUEUE_AGE_POLICY = [
  {
    kind: "operator_action",
    label: "Operator action",
    warningMinutes: 240,
    criticalMinutes: 1_440,
  },
  {
    kind: "payment_review",
    label: "Payment review",
    warningMinutes: 30,
    criticalMinutes: 120,
  },
  {
    kind: "return_review",
    label: "Return review",
    warningMinutes: 120,
    criticalMinutes: 480,
  },
] as const;

export type OpsOrderQueueAgeKind =
  (typeof OPS_ORDER_QUEUE_AGE_POLICY)[number]["kind"];
export type OpsOrderQueueAgeStatus = "healthy" | "warning" | "critical";

export type OpsOrderQueueAgeFact = {
  kind: OpsOrderQueueAgeKind;
  actionableCount: number;
  clockedCount: number;
  oldestWaitingAt: string | null;
};

export type OpsOrderQueueAgeBucket = OpsOrderQueueAgeFact & {
  label: string;
  missingClockCount: number;
  oldestAgeMinutes: number | null;
  warningMinutes: number;
  criticalMinutes: number;
  status: OpsOrderQueueAgeStatus;
};

export type OpsOrderQueueAgeHealth = {
  schemaVersion: typeof OPS_ORDER_QUEUE_AGE_POLICY_SCHEMA_VERSION;
  sourceLabel: typeof OPS_ORDER_QUEUE_AGE_POLICY_SOURCE;
  accountableOwner: typeof OPS_ORDER_QUEUE_AGE_ACCOUNTABLE_OWNER;
  generatedAt: string;
  status: OpsOrderQueueAgeStatus;
  actionableCount: number;
  missingClockCount: number;
  buckets: OpsOrderQueueAgeBucket[];
  writesPerformed: 0;
};

function requiredCount(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Ops order queue age ${label} is invalid.`);
  }
  return value;
}

function ageInMinutes(value: string, asOf: number) {
  const observedAt = Date.parse(value);
  if (!Number.isFinite(observedAt)) {
    throw new Error("Ops order queue age timestamp is invalid.");
  }
  return Math.max(0, Math.floor((asOf - observedAt) / 60_000));
}

function severityRank(status: OpsOrderQueueAgeStatus) {
  return status === "critical" ? 2 : status === "warning" ? 1 : 0;
}

export function evaluateOpsOrderQueueAgeHealth(
  facts: readonly OpsOrderQueueAgeFact[],
  asOf: string,
): OpsOrderQueueAgeHealth {
  const asOfMilliseconds = Date.parse(asOf);
  if (!Number.isFinite(asOfMilliseconds)) {
    throw new Error("Ops order queue age cutoff is invalid.");
  }

  const factsByKind = new Map<OpsOrderQueueAgeKind, OpsOrderQueueAgeFact>();
  for (const fact of facts) {
    if (factsByKind.has(fact.kind)) {
      throw new Error(
        "Ops order queue age returned a duplicate policy bucket.",
      );
    }
    factsByKind.set(fact.kind, fact);
  }

  const buckets = OPS_ORDER_QUEUE_AGE_POLICY.map<OpsOrderQueueAgeBucket>(
    (policy) => {
      const fact = factsByKind.get(policy.kind) ?? {
        kind: policy.kind,
        actionableCount: 0,
        clockedCount: 0,
        oldestWaitingAt: null,
      };
      const actionableCount = requiredCount(
        fact.actionableCount,
        "actionable count",
      );
      const clockedCount = requiredCount(fact.clockedCount, "clocked count");
      if (clockedCount > actionableCount) {
        throw new Error("Ops order queue age clocked count exceeds its queue.");
      }

      const missingClockCount = actionableCount - clockedCount;
      const oldestAgeMinutes = fact.oldestWaitingAt
        ? ageInMinutes(fact.oldestWaitingAt, asOfMilliseconds)
        : null;
      if (
        (clockedCount === 0 && oldestAgeMinutes !== null) ||
        (clockedCount > 0 && oldestAgeMinutes === null)
      ) {
        throw new Error("Ops order queue age clock evidence is inconsistent.");
      }

      const status: OpsOrderQueueAgeStatus =
        missingClockCount > 0 ||
        (oldestAgeMinutes !== null &&
          oldestAgeMinutes >= policy.criticalMinutes)
          ? "critical"
          : oldestAgeMinutes !== null &&
              oldestAgeMinutes >= policy.warningMinutes
            ? "warning"
            : "healthy";

      return {
        kind: policy.kind,
        label: policy.label,
        actionableCount,
        clockedCount,
        missingClockCount,
        oldestWaitingAt: fact.oldestWaitingAt,
        oldestAgeMinutes,
        warningMinutes: policy.warningMinutes,
        criticalMinutes: policy.criticalMinutes,
        status,
      };
    },
  );

  const status = buckets.reduce<OpsOrderQueueAgeStatus>(
    (current, bucket) =>
      severityRank(bucket.status) > severityRank(current)
        ? bucket.status
        : current,
    "healthy",
  );

  return {
    schemaVersion: OPS_ORDER_QUEUE_AGE_POLICY_SCHEMA_VERSION,
    sourceLabel: OPS_ORDER_QUEUE_AGE_POLICY_SOURCE,
    accountableOwner: OPS_ORDER_QUEUE_AGE_ACCOUNTABLE_OWNER,
    generatedAt: asOf,
    status,
    actionableCount: buckets.reduce(
      (total, bucket) => total + bucket.actionableCount,
      0,
    ),
    missingClockCount: buckets.reduce(
      (total, bucket) => total + bucket.missingClockCount,
      0,
    ),
    buckets,
    writesPerformed: 0,
  };
}
