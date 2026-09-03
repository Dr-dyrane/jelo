import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateOpsOrderQueueAgeHealth,
  OPS_ORDER_QUEUE_AGE_ACCOUNTABLE_OWNER,
  OPS_ORDER_QUEUE_AGE_POLICY,
  OPS_ORDER_QUEUE_AGE_POLICY_SOURCE,
  type OpsOrderQueueAgeFact,
} from "@/lib/commerce/order-queue-age-policy";

const generatedAt = "2026-09-03T12:00:00.000Z";
const overviewReadModelSource = readFileSync(
  new URL("../../app/(ops)/ops/overview-read-model.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("../../app/api/cron/ops-order-health/route.ts", import.meta.url),
  "utf8",
);
const healthReadSource =
  overviewReadModelSource.match(
    /export async function readOpsOrderQueueAgeFacts[\s\S]*?\n}\n/,
  )?.[0] ?? "";

function fact(
  kind: OpsOrderQueueAgeFact["kind"],
  oldestAgeMinutes: number,
): OpsOrderQueueAgeFact {
  return {
    kind,
    actionableCount: 1,
    clockedCount: 1,
    oldestWaitingAt: new Date(
      Date.parse(generatedAt) - oldestAgeMinutes * 60_000,
    ).toISOString(),
  };
}

test("recommended policy is explicit, risk-tiered, and accountable", () => {
  assert.equal(
    OPS_ORDER_QUEUE_AGE_POLICY_SOURCE,
    "recommended-policy-2026-09-03",
  );
  assert.equal(OPS_ORDER_QUEUE_AGE_ACCOUNTABLE_OWNER, "JeloCare Operations");
  assert.deepEqual(
    OPS_ORDER_QUEUE_AGE_POLICY.map(
      ({ kind, warningMinutes, criticalMinutes }) => ({
        kind,
        warningMinutes,
        criticalMinutes,
      }),
    ),
    [
      {
        kind: "operator_action",
        warningMinutes: 240,
        criticalMinutes: 1_440,
      },
      {
        kind: "payment_review",
        warningMinutes: 30,
        criticalMinutes: 120,
      },
      {
        kind: "return_review",
        warningMinutes: 120,
        criticalMinutes: 480,
      },
    ],
  );
});

test("severity is deterministic at warning and critical boundaries", () => {
  const healthy = evaluateOpsOrderQueueAgeHealth(
    [fact("operator_action", 239)],
    generatedAt,
  );
  const warning = evaluateOpsOrderQueueAgeHealth(
    [fact("operator_action", 240), fact("payment_review", 119)],
    generatedAt,
  );
  const critical = evaluateOpsOrderQueueAgeHealth(
    [fact("operator_action", 1_439), fact("payment_review", 120)],
    generatedAt,
  );

  assert.equal(healthy.status, "healthy");
  assert.equal(warning.status, "warning");
  assert.equal(critical.status, "critical");
  assert.equal(critical.actionableCount, 2);
  assert.equal(critical.writesPerformed, 0);
});

test("missing immutable wait clocks fail closed without inventing an age", () => {
  const report = evaluateOpsOrderQueueAgeHealth(
    [
      {
        kind: "return_review",
        actionableCount: 2,
        clockedCount: 1,
        oldestWaitingAt: "2026-09-03T10:00:00.000Z",
      },
    ],
    generatedAt,
  );
  const returns = report.buckets.find(
    (bucket) => bucket.kind === "return_review",
  );

  assert.equal(report.status, "critical");
  assert.equal(report.missingClockCount, 1);
  assert.equal(returns?.oldestAgeMinutes, 120);
  assert.equal(returns?.status, "critical");
});

test("health read reuses the append-only Ops wait clock and customer approval exclusion", () => {
  assert.notEqual(healthReadSource, "");
  assert.match(healthReadSource, /sql\.begin\(["']read only["']/);
  assert.doesNotMatch(healthReadSource, /orders\.updated_at/);
  assert.doesNotMatch(healthReadSource, /orders\.created_at/);
  assert.match(
    healthReadSource,
    /anchor\.from_state is distinct from anchor\.to_state\s+or anchor\.action = ["']payment_review_required["']/,
  );
  assert.match(
    healthReadSource,
    /when wait_anchor\.action = ["']payment_review_required["'] then ["']payment_review["']/,
  );
  assert.match(
    healthReadSource,
    /when orders\.state = ["']delivered["'] then open_return\.created_at/,
  );
  assert.match(
    healthReadSource,
    /requested_return\.action = ["']return_requested["'][\s\S]*?return_decision\.sequence_id > requested_return\.sequence_id[\s\S]*?return_decision\.action in \(["']return_declined["'], ["']refund_pending["']\)/,
  );

  const stateList = healthReadSource.match(
    /orders\.state in \(\s*([\s\S]*?)\s*\)\s*or \(orders\.state = ["']delivered["']/,
  );
  assert.ok(stateList);
  assert.doesNotMatch(stateList[1], /awaiting_approval/);
  assert.match(stateList[1], /payment_pending/);
  assert.match(stateList[1], /refund_pending/);
});

test("queue age evaluation uses the database snapshot clock, including an empty queue", () => {
  assert.match(
    healthReadSource,
    /with database_clock as \(\s*select now\(\) as as_of\s*\)/,
  );
  assert.match(
    healthReadSource,
    /orders\.retain_until > database_clock\.as_of/,
  );
  assert.match(
    healthReadSource,
    /database_clock\.as_of::text as as_of[\s\S]*?from database_clock\s+left join ops_order_waiting on true/,
  );
  assert.match(healthReadSource, /const asOf = rows\[0\]\?\.as_of/);
  assert.match(
    routeSource,
    /evaluateOpsOrderQueueAgeHealth\(\s*snapshot\.facts,\s*snapshot\.asOf,?\s*\)/,
  );
  assert.doesNotMatch(routeSource, /new Date\s*\(/);

  const databaseBoundary = evaluateOpsOrderQueueAgeHealth(
    [fact("payment_review", 30)],
    generatedAt,
  );
  assert.equal(databaseBoundary.status, "warning");
  assert.equal(databaseBoundary.generatedAt, generatedAt);
});

test("cron health signal is secret-authenticated, private, aggregate-only, and mutation-free", () => {
  assert.match(routeSource, /isAuthorizedCronRequest/);
  assert.match(routeSource, /process\.env\.CRON_SECRET/);
  assert.match(
    routeSource,
    /["']Cache-Control["']:\s*["']private, no-store["']/,
  );
  assert.match(routeSource, /ops_order_queue_age_health_checked/);
  assert.match(routeSource, /ops_order_queue_age_health_failed/);
  assert.match(routeSource, /writesPerformed: report\.writesPerformed/);
  assert.doesNotMatch(
    `${healthReadSource}\n${routeSource}`,
    /\b(?:insert|update|delete|notify|email|send)\b/i,
  );
  assert.doesNotMatch(
    routeSource,
    /orderId|publicReference|ownerSubject|contactName|contactEmail|contactPhone|deliveryAddress/i,
  );
});
