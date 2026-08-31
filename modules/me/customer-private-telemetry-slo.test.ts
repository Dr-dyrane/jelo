import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateCustomerPrivateTelemetrySlo,
  type CustomerPrivateTelemetrySloMinimumTraffic,
} from "@/lib/customer/private-telemetry-slo";

const minimumTraffic: CustomerPrivateTelemetrySloMinimumTraffic = {
  minimumReadOperations: 1_000,
  minimumWriteOperations: 200,
};

function report(overrides: Record<string, unknown> = {}) {
  return {
    environment: "production",
    window: {
      days: 28,
      hours: 672,
      startHour: "2026-08-02T09Z",
      endHour: "2026-08-30T08Z",
    },
    read: {
      total: 1_000,
      success: 999,
      failure: 1,
      successRate: 0.999,
    },
    write: {
      total: 200,
      success: 199,
      failure: 1,
      successRate: 0.995,
    },
    counts: {
      surface: { home: 3_999 },
    },
    ...overrides,
  };
}

test("the canonical 28-day production report passes at both exact targets", () => {
  assert.deepEqual(
    evaluateCustomerPrivateTelemetrySlo(report(), minimumTraffic),
    {
      status: "pass",
      environment: "production",
      window: {
        days: 28,
        hours: 672,
        startHour: "2026-08-02T09Z",
        endHour: "2026-08-30T08Z",
      },
      targets: {
        readSuccessRate: 0.999,
        writeSuccessRate: 0.995,
      },
      minimumTraffic: {
        readOperations: 1_000,
        writeOperations: 200,
      },
      read: {
        total: 1_000,
        success: 999,
        failure: 1,
        successRate: 0.999,
        status: "pass",
      },
      write: {
        total: 200,
        success: 199,
        failure: 1,
        successRate: 0.995,
        status: "pass",
      },
    },
  );
});

test("raw counts fail a target even when a rounded supplied rate tries to pass", () => {
  const evaluation = evaluateCustomerPrivateTelemetrySlo(
    report({
      read: {
        total: 3_999,
        success: 3_995,
        failure: 4,
        successRate: 0.999,
      },
    }),
    minimumTraffic,
  );
  assert.equal(evaluation.status, "fail");
  assert.equal(evaluation.read.status, "fail");
  assert.equal(evaluation.read.successRate, 0.999);
  assert.equal(evaluation.write.status, "pass");
});

test("safe-integer boundary counts use exact target arithmetic", () => {
  const evaluation = evaluateCustomerPrivateTelemetrySlo(
    report({
      read: {
        total: 9_007_199_254_740_991,
        success: 8_998_192_055_486_250,
        failure: 9_007_199_254_741,
        successRate: 0.999,
      },
      write: {
        total: 9_007_199_254_740_991,
        success: 8_962_163_258_467_286,
        failure: 45_035_996_273_705,
        successRate: 0.995,
      },
    }),
    minimumTraffic,
  );
  assert.equal(evaluation.status, "fail");
  assert.equal(evaluation.read.status, "fail");
  assert.equal(evaluation.write.status, "fail");
});

test("insufficient traffic is not evaluable and never passes", () => {
  const evaluation = evaluateCustomerPrivateTelemetrySlo(
    report({
      write: {
        total: 199,
        success: 199,
        failure: 0,
        successRate: 1,
      },
    }),
    minimumTraffic,
  );
  assert.equal(evaluation.status, "not-evaluable");
  assert.equal(evaluation.read.status, "pass");
  assert.equal(evaluation.write.status, "not-evaluable");
});

test("a known failure remains a failure when the other signal lacks traffic", () => {
  const evaluation = evaluateCustomerPrivateTelemetrySlo(
    report({
      read: {
        total: 1_000,
        success: 998,
        failure: 2,
        successRate: 0.998,
      },
      write: {
        total: 1,
        success: 1,
        failure: 0,
        successRate: 1,
      },
    }),
    minimumTraffic,
  );
  assert.equal(evaluation.status, "fail");
  assert.equal(evaluation.read.status, "fail");
  assert.equal(evaluation.write.status, "not-evaluable");
});

test("evaluation requires explicit positive safe-integer traffic policy", () => {
  for (const invalid of [
    { minimumReadOperations: 0, minimumWriteOperations: 1 },
    { minimumReadOperations: 1, minimumWriteOperations: -1 },
    { minimumReadOperations: 1.5, minimumWriteOperations: 1 },
    {
      minimumReadOperations: Number.MAX_SAFE_INTEGER + 1,
      minimumWriteOperations: 1,
    },
  ]) {
    assert.throws(
      () => evaluateCustomerPrivateTelemetrySlo(report(), invalid),
      /customer_private_telemetry_slo_minimum_traffic_invalid/,
    );
  }
});

test("non-production, non-28-day, incomplete, and malformed reports fail closed", () => {
  const invalidReports = [
    report({ environment: "preview" }),
    report({ window: { days: 27, hours: 648 } }),
    report({
      window: {
        days: 28,
        hours: 672,
        startHour: "2026-08-02T10Z",
        endHour: "2026-08-30T08Z",
      },
    }),
    report({
      window: {
        days: 28,
        hours: 672,
        startHour: "2026-02-30T09Z",
        endHour: "2026-03-30T08Z",
      },
    }),
    report({
      read: {
        total: 1_000,
        success: 999,
        failure: 2,
        successRate: 0.999,
      },
    }),
    report({
      read: {
        total: 1_001,
        success: 1_000,
        failure: 1,
        successRate: 0.999,
      },
    }),
    report({
      write: {
        total: Number.MAX_SAFE_INTEGER + 1,
        success: Number.MAX_SAFE_INTEGER + 1,
        failure: 0,
        successRate: 1,
      },
    }),
  ];
  for (const invalidReport of invalidReports) {
    assert.throws(
      () => evaluateCustomerPrivateTelemetrySlo(invalidReport, minimumTraffic),
      /customer_private_telemetry_slo_report_invalid/,
    );
  }
});

test("the operator command fixes the canonical report and distinct exit contract", () => {
  const script = readFileSync(
    "scripts/evaluate-customer-telemetry-slo.ts",
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(script, /environment: ["']production["']/);
  assert.match(script, /days: 28/);
  assert.match(script, /pass: 0/);
  assert.match(script, /fail: 1/);
  assert.match(script, /["']not-evaluable["']: 2/);
  assert.match(script, /ERROR_EXIT_CODE = 3/);
  assert.doesNotMatch(script, /error\.message|console\.error\(error/);
  assert.equal(
    packageJson.scripts["customer:telemetry:slo"],
    "tsx scripts/evaluate-customer-telemetry-slo.ts",
  );
});
