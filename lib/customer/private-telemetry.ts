import "server-only";

import { Redis } from "@upstash/redis";
import { after } from "next/server";

export const customerPrivateTelemetryEnvironments = [
  "production",
  "preview",
  "development",
] as const;
export const customerPrivateTelemetrySurfaces = [
  "home",
  "explore",
  "product",
  "shelf",
  "routine",
  "consult",
  "orders",
  "notifications",
  "locations",
  "concerns",
  "product_requests",
] as const;
export const customerPrivateTelemetryOperations = [
  "read",
  "export",
  "add",
  "remove",
  "clear",
  "save",
  "create",
  "update",
  "delete",
] as const;
export const customerPrivateTelemetryOutcomes = [
  "success",
  "failure",
] as const;
export const customerPrivateTelemetryLatencyBuckets = [
  "under_100ms",
  "100_499ms",
  "500_999ms",
  "1_2s",
  "at_least_2s",
] as const;

export type CustomerPrivateTelemetryEnvironment =
  (typeof customerPrivateTelemetryEnvironments)[number];
export type CustomerPrivateTelemetrySurface =
  (typeof customerPrivateTelemetrySurfaces)[number];
export type CustomerPrivateTelemetryOperation =
  (typeof customerPrivateTelemetryOperations)[number];
export type CustomerPrivateTelemetryOutcome =
  (typeof customerPrivateTelemetryOutcomes)[number];
export type CustomerPrivateTelemetryLatencyBucket =
  (typeof customerPrivateTelemetryLatencyBuckets)[number];

export type CustomerPrivateTelemetryEvent = {
  surface: CustomerPrivateTelemetrySurface;
  operation: CustomerPrivateTelemetryOperation;
  outcome: CustomerPrivateTelemetryOutcome;
  latencyBucket: CustomerPrivateTelemetryLatencyBucket;
};

type CustomerPrivateTelemetryDimensions = Pick<
  CustomerPrivateTelemetryEvent,
  "surface" | "operation"
>;

type Schedule = (task: () => Promise<void>) => void;
type WriteCounter = (
  key: string,
  field: string,
  expiresAtUnixSeconds: number,
) => Promise<boolean>;
type ReadHours = (
  keys: readonly string[],
) => Promise<readonly (Readonly<Record<string, unknown>> | null)[]>;

export type CustomerPrivateTelemetryMeasurementDependencies = {
  now?: () => number;
  schedule?: Schedule;
  record?: (event: CustomerPrivateTelemetryEvent) => Promise<boolean>;
};

export type CustomerPrivateTelemetryWriteDependencies = {
  now?: () => Date;
  environment?: () => unknown;
  write?: WriteCounter | null;
};

export type CustomerPrivateTelemetryReportDependencies = {
  now?: () => Date;
  readHours?: ReadHours | null;
};

export const CUSTOMER_PRIVATE_TELEMETRY_RETENTION_SECONDS =
  35 * 24 * 60 * 60;
export const CUSTOMER_PRIVATE_TELEMETRY_DEFAULT_REPORT_DAYS = 28;
export const CUSTOMER_PRIVATE_TELEMETRY_PREFIX =
  "jelocare:me:private-telemetry:v1";

const incrementAndExpireScript = `
local total = redis.call("HINCRBY", KEYS[1], ARGV[1], 1)
redis.call("EXPIREAT", KEYS[1], ARGV[2])
return total
`;

let redis: Redis | undefined;

function isFixedValue<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

function hasExactEventKeys(value: object) {
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === 4 &&
    keys.includes("latencyBucket") &&
    keys.includes("operation") &&
    keys.includes("outcome") &&
    keys.includes("surface")
  );
}

export function parseCustomerPrivateTelemetryEvent(
  value: unknown,
): CustomerPrivateTelemetryEvent | null {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      !hasExactEventKeys(value)
    ) {
      return null;
    }
    const event = value as Record<string, unknown>;
    if (
      !isFixedValue(customerPrivateTelemetrySurfaces, event.surface) ||
      !isFixedValue(customerPrivateTelemetryOperations, event.operation) ||
      !isFixedValue(customerPrivateTelemetryOutcomes, event.outcome) ||
      !isFixedValue(
        customerPrivateTelemetryLatencyBuckets,
        event.latencyBucket,
      )
    ) {
      return null;
    }
    return {
      surface: event.surface,
      operation: event.operation,
      outcome: event.outcome,
      latencyBucket: event.latencyBucket,
    };
  } catch {
    return null;
  }
}

export function customerPrivateTelemetryEnvironment(
  vercelEnvironment: unknown = process.env.VERCEL_ENV,
): CustomerPrivateTelemetryEnvironment {
  if (vercelEnvironment === "production") return "production";
  if (vercelEnvironment === "preview") return "preview";
  return "development";
}

export function parseCustomerPrivateTelemetryEnvironment(
  value: unknown,
): CustomerPrivateTelemetryEnvironment {
  if (!isFixedValue(customerPrivateTelemetryEnvironments, value)) {
    throw new Error("customer_private_telemetry_environment_invalid");
  }
  return value;
}

export function customerPrivateTelemetryUtcHour(recordedAt: Date) {
  const timestamp = recordedAt.valueOf();
  if (!Number.isFinite(timestamp)) {
    throw new Error("customer_private_telemetry_time_invalid");
  }
  return `${recordedAt.toISOString().slice(0, 13)}Z`;
}

export function customerPrivateTelemetryHourKey(
  environment: CustomerPrivateTelemetryEnvironment,
  recordedAt: Date,
) {
  const safeEnvironment = parseCustomerPrivateTelemetryEnvironment(environment);
  return `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:${safeEnvironment}:${customerPrivateTelemetryUtcHour(recordedAt)}`;
}

export function customerPrivateTelemetryExpiresAt(recordedAt: Date) {
  customerPrivateTelemetryUtcHour(recordedAt);
  const hourStart = new Date(recordedAt.valueOf());
  hourStart.setUTCMinutes(0, 0, 0);
  return (
    Math.floor(hourStart.valueOf() / 1_000) +
    CUSTOMER_PRIVATE_TELEMETRY_RETENTION_SECONDS
  );
}

export function customerPrivateTelemetryField(value: unknown) {
  const event = parseCustomerPrivateTelemetryEvent(value);
  if (!event) throw new Error("customer_private_telemetry_event_invalid");
  return `${event.surface}:${event.operation}:${event.outcome}:${event.latencyBucket}`;
}

function parseCustomerPrivateTelemetryField(
  field: string,
): CustomerPrivateTelemetryEvent | null {
  const [surface, operation, outcome, latencyBucket, extra] = field.split(":");
  if (extra !== undefined) return null;
  return parseCustomerPrivateTelemetryEvent({
    surface,
    operation,
    outcome,
    latencyBucket,
  });
}

export function customerPrivateTelemetryLatencyBucket(
  durationMs: number,
): CustomerPrivateTelemetryLatencyBucket {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  if (duration < 100) return "under_100ms";
  if (duration < 500) return "100_499ms";
  if (duration < 1_000) return "500_999ms";
  if (duration < 2_000) return "1_2s";
  return "at_least_2s";
}

function configuredRedis() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || !url.startsWith("https://")) return null;
  redis = new Redis({ url, token, automaticDeserialization: false });
  return redis;
}

async function writeCounter(
  key: string,
  field: string,
  expiresAtUnixSeconds: number,
) {
  const client = configuredRedis();
  if (!client) return false;
  await client.eval(
    incrementAndExpireScript,
    [key],
    [field, expiresAtUnixSeconds],
  );
  return true;
}

export async function recordCustomerPrivateTelemetry(
  value: unknown,
  dependencies: CustomerPrivateTelemetryWriteDependencies = {},
) {
  const event = parseCustomerPrivateTelemetryEvent(value);
  if (!event) return false;

  try {
    const writer =
      dependencies.write === undefined ? writeCounter : dependencies.write;
    if (!writer) return false;
    const recordedAt = (dependencies.now ?? (() => new Date()))();
    const environment = parseCustomerPrivateTelemetryEnvironment(
      (dependencies.environment ?? (() =>
        customerPrivateTelemetryEnvironment()))(),
    );
    return await writer(
      customerPrivateTelemetryHourKey(environment, recordedAt),
      customerPrivateTelemetryField(event),
      customerPrivateTelemetryExpiresAt(recordedAt),
    );
  } catch {
    return false;
  }
}

function scheduleCustomerPrivateTelemetry(
  event: CustomerPrivateTelemetryEvent,
  dependencies: CustomerPrivateTelemetryMeasurementDependencies,
) {
  try {
    const schedule = dependencies.schedule ?? after;
    const record = dependencies.record ?? recordCustomerPrivateTelemetry;
    schedule(async () => {
      await record(event);
    });
    return true;
  } catch {
    return false;
  }
}

async function measureOperation<T>(
  dimensions: CustomerPrivateTelemetryDimensions,
  operation: () => Promise<T>,
  outcomeForValue: (value: T) => CustomerPrivateTelemetryOutcome,
  dependencies: CustomerPrivateTelemetryMeasurementDependencies,
) {
  const now = dependencies.now ?? (() => performance.now());
  let startedAt = 0;
  try {
    startedAt = now();
  } catch {}
  const scheduleOutcome = (outcome: CustomerPrivateTelemetryOutcome) => {
    try {
      let duration = 0;
      try {
        duration = now() - startedAt;
      } catch {}
      const event = parseCustomerPrivateTelemetryEvent({
        surface: dimensions.surface,
        operation: dimensions.operation,
        outcome,
        latencyBucket: customerPrivateTelemetryLatencyBucket(duration),
      });
      return event
        ? scheduleCustomerPrivateTelemetry(event, dependencies)
        : false;
    } catch {
      return false;
    }
  };
  try {
    const value = await operation();
    let outcome: CustomerPrivateTelemetryOutcome = "failure";
    try {
      outcome = outcomeForValue(value);
    } catch {}
    scheduleOutcome(outcome);
    return value;
  } catch (error) {
    scheduleOutcome("failure");
    throw error;
  }
}

export function measureCustomerPrivateOperation<T>(
  dimensions: CustomerPrivateTelemetryDimensions,
  operation: () => Promise<T>,
  dependencies: CustomerPrivateTelemetryMeasurementDependencies = {},
) {
  return measureOperation(
    dimensions,
    operation,
    () => "success",
    dependencies,
  );
}

export function measureCustomerPrivateResponseOperation<T extends Response>(
  dimensions: CustomerPrivateTelemetryDimensions,
  operation: () => Promise<T>,
  dependencies: CustomerPrivateTelemetryMeasurementDependencies = {},
) {
  return measureOperation(
    dimensions,
    operation,
    (response) => (response.ok ? "success" : "failure"),
    dependencies,
  );
}

export function measureCustomerPrivateResultOperation<T>(
  dimensions: CustomerPrivateTelemetryDimensions,
  operation: () => Promise<T>,
  succeeded: (value: T) => boolean,
  dependencies: CustomerPrivateTelemetryMeasurementDependencies = {},
) {
  return measureOperation(
    dimensions,
    operation,
    (value) => (succeeded(value) ? "success" : "failure"),
    dependencies,
  );
}

function zeroCounts<const Values extends readonly string[]>(values: Values) {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<
    Values[number],
    number
  >;
}

function telemetryCount(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function rate(success: number, total: number) {
  return total === 0 ? null : Number((success / total).toFixed(6));
}

async function readHours(keys: readonly string[]) {
  const client = configuredRedis();
  if (!client) {
    throw new Error("customer_private_telemetry_redis_not_configured");
  }
  try {
    const pipeline = client.pipeline();
    for (const key of keys) pipeline.hgetall(key);
    return (await pipeline.exec()) as readonly (
      | Readonly<Record<string, unknown>>
      | null
    )[];
  } catch {
    throw new Error("customer_private_telemetry_report_unavailable");
  }
}

export async function readCustomerPrivateTelemetryReport(
  input: {
    environment?: CustomerPrivateTelemetryEnvironment;
    days?: number;
  } = {},
  dependencies: CustomerPrivateTelemetryReportDependencies = {},
) {
  const environment = parseCustomerPrivateTelemetryEnvironment(
    input.environment ?? "production",
  );
  const days = input.days ?? CUSTOMER_PRIVATE_TELEMETRY_DEFAULT_REPORT_DAYS;
  if (!Number.isSafeInteger(days) || days < 1 || days > 35) {
    throw new Error("customer_private_telemetry_report_days_invalid");
  }
  const now = (dependencies.now ?? (() => new Date()))();
  const end = new Date(now.valueOf());
  if (!Number.isFinite(end.valueOf())) {
    throw new Error("customer_private_telemetry_time_invalid");
  }
  end.setUTCMinutes(0, 0, 0);
  const hours = days * 24;
  const start = new Date(end.valueOf() - (hours - 1) * 60 * 60 * 1_000);
  const keys = Array.from({ length: hours }, (_, index) =>
    customerPrivateTelemetryHourKey(
      environment,
      new Date(start.valueOf() + index * 60 * 60 * 1_000),
    ),
  );
  const reader =
    dependencies.readHours === undefined ? readHours : dependencies.readHours;
  if (!reader) {
    throw new Error("customer_private_telemetry_redis_not_configured");
  }
  const records = await reader(keys);
  if (records.length !== keys.length) {
    throw new Error("customer_private_telemetry_report_incomplete");
  }

  const counts = {
    surface: zeroCounts(customerPrivateTelemetrySurfaces),
    operation: zeroCounts(customerPrivateTelemetryOperations),
    outcome: zeroCounts(customerPrivateTelemetryOutcomes),
    latency: zeroCounts(customerPrivateTelemetryLatencyBuckets),
  };
  let readSuccess = 0;
  let readFailure = 0;
  let writeSuccess = 0;
  let writeFailure = 0;

  for (const record of records) {
    if (!record) continue;
    for (const [field, rawCount] of Object.entries(record)) {
      const event = parseCustomerPrivateTelemetryField(field);
      const count = telemetryCount(rawCount);
      if (!event || count === null) continue;
      counts.surface[event.surface] += count;
      counts.operation[event.operation] += count;
      counts.outcome[event.outcome] += count;
      counts.latency[event.latencyBucket] += count;
      const isRead = event.operation === "read" || event.operation === "export";
      if (isRead && event.outcome === "success") readSuccess += count;
      else if (isRead) readFailure += count;
      else if (event.outcome === "success") writeSuccess += count;
      else writeFailure += count;
    }
  }

  const readTotal = readSuccess + readFailure;
  const writeTotal = writeSuccess + writeFailure;
  return {
    environment,
    window: {
      days,
      hours,
      startHour: customerPrivateTelemetryUtcHour(start),
      endHour: customerPrivateTelemetryUtcHour(end),
    },
    read: {
      total: readTotal,
      success: readSuccess,
      failure: readFailure,
      successRate: rate(readSuccess, readTotal),
    },
    write: {
      total: writeTotal,
      success: writeSuccess,
      failure: writeFailure,
      successRate: rate(writeSuccess, writeTotal),
    },
    counts,
  };
}
