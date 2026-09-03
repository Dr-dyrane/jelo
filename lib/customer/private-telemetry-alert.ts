import "server-only";
import type { CustomerPrivateTelemetrySloMinimumTraffic } from "@/lib/customer/private-telemetry-slo";

// This is the recorded 28-day policy input, not an implicit evaluator fallback.
export const CUSTOMER_PRIVATE_TELEMETRY_SLO_MINIMUM_TRAFFIC = {
  minimumReadOperations: 1_000,
  minimumWriteOperations: 200,
} as const satisfies CustomerPrivateTelemetrySloMinimumTraffic;

export const CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY = {
  windowMinutes: 15,
  minimumTraffic: {
    readOperations: 100,
    writeOperations: 50,
  },
  rollbackFailureRate: {
    read: { numerator: 1, denominator: 100 },
    write: { numerator: 2, denominator: 100 },
  },
} as const;

export type CustomerPrivateTelemetryFastBurnStatus =
  "healthy" | "rollback-required" | "not-evaluable";

type AggregateReport = {
  total: number;
  success: number;
  failure: number;
  successRate: number | null;
};

type CompletedQuarterReport = {
  environment: "production";
  window: {
    minutes: 15;
    startMinute: string;
    endMinuteExclusive: string;
  };
  read: AggregateReport;
  write: AggregateReport;
  writesPerformed: 0;
};

const UTC_QUARTER_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|15|30|45)Z$/;
const MINUTE_MILLISECONDS = 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roundedRate(success: number, total: number) {
  return total === 0 ? null : Number((success / total).toFixed(6));
}

function parseAggregate(value: unknown): AggregateReport | null {
  if (!isRecord(value)) return null;
  const { total, success, failure, successRate } = value;
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(success) ||
    !Number.isSafeInteger(failure) ||
    (total as number) < 0 ||
    (success as number) < 0 ||
    (failure as number) < 0 ||
    BigInt(success as number) + BigInt(failure as number) !==
      BigInt(total as number) ||
    successRate !== roundedRate(success as number, total as number)
  ) {
    return null;
  }
  return {
    total: total as number,
    success: success as number,
    failure: failure as number,
    successRate: successRate as number | null,
  };
}

function parseUtcQuarter(value: unknown) {
  if (typeof value !== "string" || !UTC_QUARTER_PATTERN.test(value)) {
    return null;
  }
  const timestamp = Date.parse(`${value.slice(0, 16)}:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = `${new Date(timestamp).toISOString().slice(0, 16)}Z`;
  return canonical === value ? timestamp : null;
}

function parseCompletedQuarterReport(value: unknown): CompletedQuarterReport {
  if (
    !isRecord(value) ||
    value.environment !== "production" ||
    value.writesPerformed !== 0 ||
    !isRecord(value.window) ||
    value.window.minutes !==
      CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.windowMinutes
  ) {
    throw new Error("customer_private_telemetry_fast_burn_report_invalid");
  }
  const start = parseUtcQuarter(value.window.startMinute);
  const end = parseUtcQuarter(value.window.endMinuteExclusive);
  const read = parseAggregate(value.read);
  const write = parseAggregate(value.write);
  if (
    start === null ||
    end === null ||
    end - start !==
      CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.windowMinutes *
        MINUTE_MILLISECONDS ||
    !read ||
    !write
  ) {
    throw new Error("customer_private_telemetry_fast_burn_report_invalid");
  }
  return {
    environment: "production",
    window: {
      minutes: CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.windowMinutes,
      startMinute: value.window.startMinute as string,
      endMinuteExclusive: value.window.endMinuteExclusive as string,
    },
    read,
    write,
    writesPerformed: 0,
  };
}

function signalStatus(
  aggregate: AggregateReport,
  minimumTraffic: number,
  rollbackThreshold: { numerator: number; denominator: number },
): CustomerPrivateTelemetryFastBurnStatus {
  if (aggregate.total < minimumTraffic) return "not-evaluable";
  return BigInt(aggregate.failure) * BigInt(rollbackThreshold.denominator) >
    BigInt(aggregate.total) * BigInt(rollbackThreshold.numerator)
    ? "rollback-required"
    : "healthy";
}

/**
 * Evaluate the last completed UTC quarter without floats or partial-window data.
 * The 100-read and 50-write minimums are the smallest populations that express
 * the strict >1% and >2% rollback boundaries exactly as integer counts. A
 * smaller or empty population is therefore not evaluable, never healthy.
 */
export function evaluateCustomerPrivateTelemetryFastBurn(reportValue: unknown) {
  const report = parseCompletedQuarterReport(reportValue);
  const readStatus = signalStatus(
    report.read,
    CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.minimumTraffic.readOperations,
    CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.rollbackFailureRate.read,
  );
  const writeStatus = signalStatus(
    report.write,
    CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.minimumTraffic.writeOperations,
    CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY.rollbackFailureRate.write,
  );
  const status: CustomerPrivateTelemetryFastBurnStatus =
    readStatus === "rollback-required" || writeStatus === "rollback-required"
      ? "rollback-required"
      : readStatus === "not-evaluable" || writeStatus === "not-evaluable"
        ? "not-evaluable"
        : "healthy";

  return {
    schemaVersion: "customer-private-telemetry-fast-burn/v1" as const,
    status,
    environment: report.environment,
    window: report.window,
    policy: CUSTOMER_PRIVATE_TELEMETRY_FAST_BURN_POLICY,
    read: { ...report.read, status: readStatus },
    write: { ...report.write, status: writeStatus },
    writesPerformed: 0 as const,
  };
}
