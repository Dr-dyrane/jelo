export const CUSTOMER_PRIVATE_TELEMETRY_SLO_READ_TARGET = 0.999;
export const CUSTOMER_PRIVATE_TELEMETRY_SLO_WRITE_TARGET = 0.995;
export const CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_DAYS = 28;
export const CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_HOURS = 672;

const CUSTOMER_PRIVATE_TELEMETRY_SLO_TARGET_DENOMINATOR = 1_000;
const CUSTOMER_PRIVATE_TELEMETRY_SLO_READ_TARGET_NUMERATOR = 999;
const CUSTOMER_PRIVATE_TELEMETRY_SLO_WRITE_TARGET_NUMERATOR = 995;

export type CustomerPrivateTelemetrySloStatus =
  "pass" | "fail" | "not-evaluable";

export type CustomerPrivateTelemetrySloMinimumTraffic = {
  minimumReadOperations: number;
  minimumWriteOperations: number;
};

type AggregateReport = {
  total: number;
  success: number;
  failure: number;
  successRate: number | null;
};

type CanonicalReport = {
  environment: "production";
  window: {
    days: 28;
    hours: 672;
    startHour: string;
    endHour: string;
  };
  read: AggregateReport;
  write: AggregateReport;
};

const UTC_HOUR_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}Z$/;
const HOUR_MILLISECONDS = 60 * 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseUtcHour(value: unknown) {
  if (typeof value !== "string" || !UTC_HOUR_PATTERN.test(value)) return null;
  const timestamp = Date.parse(`${value.slice(0, 13)}:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString().slice(0, 13) + "Z";
  return canonical === value ? timestamp : null;
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

function parseCanonicalReport(value: unknown): CanonicalReport {
  if (
    !isRecord(value) ||
    value.environment !== "production" ||
    !isRecord(value.window) ||
    value.window.days !== CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_DAYS ||
    value.window.hours !== CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_HOURS
  ) {
    throw new Error("customer_private_telemetry_slo_report_invalid");
  }
  const start = parseUtcHour(value.window.startHour);
  const end = parseUtcHour(value.window.endHour);
  const read = parseAggregate(value.read);
  const write = parseAggregate(value.write);
  if (
    start === null ||
    end === null ||
    end - start !==
      (CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_HOURS - 1) * HOUR_MILLISECONDS ||
    !read ||
    !write
  ) {
    throw new Error("customer_private_telemetry_slo_report_invalid");
  }
  return {
    environment: "production",
    window: {
      days: CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_DAYS,
      hours: CUSTOMER_PRIVATE_TELEMETRY_SLO_WINDOW_HOURS,
      startHour: value.window.startHour as string,
      endHour: value.window.endHour as string,
    },
    read,
    write,
  };
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function signalStatus(
  aggregate: AggregateReport,
  minimumTraffic: number,
  targetNumerator: number,
): CustomerPrivateTelemetrySloStatus {
  if (aggregate.total < minimumTraffic) return "not-evaluable";
  return BigInt(aggregate.success) *
    BigInt(CUSTOMER_PRIVATE_TELEMETRY_SLO_TARGET_DENOMINATOR) >=
    BigInt(aggregate.total) * BigInt(targetNumerator)
    ? "pass"
    : "fail";
}

export function evaluateCustomerPrivateTelemetrySlo(
  reportValue: unknown,
  minimumTraffic: CustomerPrivateTelemetrySloMinimumTraffic,
) {
  if (
    !isRecord(minimumTraffic) ||
    !positiveSafeInteger(minimumTraffic.minimumReadOperations) ||
    !positiveSafeInteger(minimumTraffic.minimumWriteOperations)
  ) {
    throw new Error("customer_private_telemetry_slo_minimum_traffic_invalid");
  }
  const report = parseCanonicalReport(reportValue);
  const readStatus = signalStatus(
    report.read,
    minimumTraffic.minimumReadOperations,
    CUSTOMER_PRIVATE_TELEMETRY_SLO_READ_TARGET_NUMERATOR,
  );
  const writeStatus = signalStatus(
    report.write,
    minimumTraffic.minimumWriteOperations,
    CUSTOMER_PRIVATE_TELEMETRY_SLO_WRITE_TARGET_NUMERATOR,
  );
  const status: CustomerPrivateTelemetrySloStatus =
    readStatus === "fail" || writeStatus === "fail"
      ? "fail"
      : readStatus === "not-evaluable" || writeStatus === "not-evaluable"
        ? "not-evaluable"
        : "pass";

  return {
    status,
    environment: report.environment,
    window: report.window,
    targets: {
      readSuccessRate: CUSTOMER_PRIVATE_TELEMETRY_SLO_READ_TARGET,
      writeSuccessRate: CUSTOMER_PRIVATE_TELEMETRY_SLO_WRITE_TARGET,
    },
    minimumTraffic: {
      readOperations: minimumTraffic.minimumReadOperations,
      writeOperations: minimumTraffic.minimumWriteOperations,
    },
    read: {
      ...report.read,
      status: readStatus,
    },
    write: {
      ...report.write,
      status: writeStatus,
    },
  };
}
