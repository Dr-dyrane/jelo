import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY,
  CUSTOMER_PRIVATE_TELEMETRY_SLO_MINIMUM_TRAFFIC,
  evaluateCustomerPrivateTelemetryFastBurn,
} from "@/lib/customer/private-telemetry-alert";

function report(overrides: Record<string, unknown> = {}) {
  return {
    environment: "production",
    window: {
      minutes: 15,
      startMinute: "2026-09-03T14:15Z",
      endMinuteExclusive: "2026-09-03T14:30Z",
    },
    read: {
      total: 100,
      success: 99,
      failure: 1,
      successRate: 0.99,
    },
    write: {
      total: 50,
      success: 49,
      failure: 1,
      successRate: 0.98,
    },
    writesPerformed: 0,
    ...overrides,
  };
}

test("the recorded long-window and exact fast-burn policy are explicit", () => {
  assert.deepEqual(CUSTOMER_PRIVATE_TELEMETRY_SLO_MINIMUM_TRAFFIC, {
    minimumReadOperations: 1_000,
    minimumWriteOperations: 200,
  });
  assert.deepEqual(CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY, {
    windowMinutes: 15,
    minimumTraffic: { readOperations: 100, writeOperations: 50 },
    rollbackFailureRate: {
      read: { numerator: 1, denominator: 100 },
      write: { numerator: 2, denominator: 100 },
    },
  });
});

test("exact threshold boundaries remain healthy", () => {
  const evaluation = evaluateCustomerPrivateTelemetryFastBurn(report());
  assert.equal(evaluation.status, "healthy");
  assert.equal(evaluation.read.status, "healthy");
  assert.equal(evaluation.write.status, "healthy");
  assert.equal(evaluation.writesPerformed, 0);
});

test("integer counts strictly above either failure threshold require rollback", () => {
  const readFailure = evaluateCustomerPrivateTelemetryFastBurn(
    report({
      read: { total: 100, success: 98, failure: 2, successRate: 0.98 },
    }),
  );
  assert.equal(readFailure.status, "rollback-required");
  assert.equal(readFailure.read.status, "rollback-required");

  const writeFailure = evaluateCustomerPrivateTelemetryFastBurn(
    report({
      write: { total: 50, success: 48, failure: 2, successRate: 0.96 },
    }),
  );
  assert.equal(writeFailure.status, "rollback-required");
  assert.equal(writeFailure.write.status, "rollback-required");
});

test("empty or low traffic is not evaluable and never falsely healthy", () => {
  const empty = evaluateCustomerPrivateTelemetryFastBurn(
    report({
      read: { total: 0, success: 0, failure: 0, successRate: null },
      write: { total: 0, success: 0, failure: 0, successRate: null },
    }),
  );
  assert.equal(empty.status, "not-evaluable");
  assert.equal(empty.read.status, "not-evaluable");
  assert.equal(empty.write.status, "not-evaluable");

  const lowTraffic = evaluateCustomerPrivateTelemetryFastBurn(
    report({
      read: { total: 99, success: 99, failure: 0, successRate: 1 },
    }),
  );
  assert.equal(lowTraffic.status, "not-evaluable");
  assert.equal(lowTraffic.read.status, "not-evaluable");
  assert.equal(lowTraffic.write.status, "healthy");
});

test("a qualified rollback signal dominates an unqualified companion", () => {
  const evaluation = evaluateCustomerPrivateTelemetryFastBurn(
    report({
      read: { total: 100, success: 98, failure: 2, successRate: 0.98 },
      write: { total: 0, success: 0, failure: 0, successRate: null },
    }),
  );
  assert.equal(evaluation.status, "rollback-required");
  assert.equal(evaluation.write.status, "not-evaluable");
});

test("malformed, non-production, partial, and non-quarter reports fail closed", () => {
  const invalidReports = [
    report({ environment: "preview" }),
    report({ writesPerformed: 1 }),
    report({
      window: {
        minutes: 15,
        startMinute: "2026-09-03T14:16Z",
        endMinuteExclusive: "2026-09-03T14:31Z",
      },
    }),
    report({
      window: {
        minutes: 15,
        startMinute: "2026-09-03T14:15Z",
        endMinuteExclusive: "2026-09-03T14:45Z",
      },
    }),
    report({
      read: { total: 100, success: 99, failure: 2, successRate: 0.99 },
    }),
    report({
      write: { total: 50, success: 49, failure: 1, successRate: 0.99 },
    }),
  ];
  for (const invalid of invalidReports) {
    assert.throws(
      () => evaluateCustomerPrivateTelemetryFastBurn(invalid),
      /customer_private_telemetry_fast_burn_report_invalid/,
    );
  }
});

test("the cron is authenticated, private, read-only, and fails only rollback quarters", () => {
  const route = readFileSync(
    "app/api/cron/private-service-health/route.ts",
    "utf8",
  );
  assert.match(route, /isAuthorizedCronRequest/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /environment: ["']production["']/);
  assert.match(route, /readCustomerPrivateTelemetryCompletedQuarterReport/);
  assert.match(route, /evaluateCustomerPrivateTelemetryFastBurn/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(route, /noindex, nofollow, noarchive/);
  assert.match(
    route,
    /evaluation\.status === ["']rollback-required["'] \? 503 : 200/,
  );
  assert.match(route, /customer_private_telemetry_fast_burn_checked/);
  assert.match(route, /customer_private_telemetry_fast_burn_failed/);
  assert.doesNotMatch(
    route,
    /sendAlertEmail|sendMail|recordCustomerPrivateTelemetry/,
  );
});
