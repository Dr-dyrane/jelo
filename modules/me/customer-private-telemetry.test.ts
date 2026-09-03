import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUSTOMER_PRIVATE_TELEMETRY_DEFAULT_REPORT_DAYS,
  CUSTOMER_PRIVATE_TELEMETRY_PREFIX,
  CUSTOMER_PRIVATE_TELEMETRY_QUARTER_MINUTES,
  CUSTOMER_PRIVATE_TELEMETRY_RETENTION_SECONDS,
  customerPrivateTelemetryEnvironment,
  customerPrivateTelemetryExpiresAt,
  customerPrivateTelemetryField,
  customerPrivateTelemetryHourKey,
  customerPrivateTelemetryLatencyBucket,
  customerPrivateTelemetryQuarterKey,
  customerPrivateTelemetryUtcQuarter,
  measureCustomerPrivateOperation,
  measureCustomerPrivateResponseOperation,
  measureCustomerPrivateResultOperation,
  parseCustomerPrivateTelemetryEvent,
  readCustomerPrivateTelemetryCompletedQuarterReport,
  readCustomerPrivateTelemetryReport,
  recordCustomerPrivateTelemetry,
  type CustomerPrivateTelemetryEvent,
} from "@/lib/customer/private-telemetry";
import { customerCapabilities } from "@/lib/customer/customer-capabilities";

const validEvent: CustomerPrivateTelemetryEvent = {
  surface: "shelf",
  operation: "add",
  outcome: "success",
  latencyBucket: "100_499ms",
};

test("private telemetry accepts only its four enum fields", () => {
  assert.deepEqual(parseCustomerPrivateTelemetryEvent(validEvent), validEvent);
  assert.equal(
    parseCustomerPrivateTelemetryEvent({
      ...validEvent,
      ownerSubject: "customer-private-subject",
    }),
    null,
  );
  assert.equal(
    parseCustomerPrivateTelemetryEvent({
      ...validEvent,
      note: "free text must never be accepted",
    }),
    null,
  );
  assert.equal(
    parseCustomerPrivateTelemetryEvent({ ...validEvent, surface: "/me/shelf" }),
    null,
  );
  assert.equal(
    parseCustomerPrivateTelemetryEvent({
      ...validEvent,
      operation: "add:item-42",
    }),
    null,
  );
  assert.equal(
    parseCustomerPrivateTelemetryEvent({ ...validEvent, outcome: "conflict" }),
    null,
  );
  assert.equal(
    parseCustomerPrivateTelemetryEvent({
      ...validEvent,
      latencyBucket: "412ms",
    }),
    null,
  );
  assert.equal(
    parseCustomerPrivateTelemetryEvent({
      ...validEvent,
      [Symbol("private")]: "private",
    }),
    null,
  );
  assert.throws(
    () =>
      customerPrivateTelemetryField({ ...validEvent, query: "private query" }),
    /customer_private_telemetry_event_invalid/,
  );
  assert.equal(
    customerPrivateTelemetryField(validEvent),
    "shelf:add:success:100_499ms",
  );
});

test("hour and quarter keys use UTC boundaries and a fixed deployment environment", () => {
  const recordedAt = new Date("2026-08-13T23:45:12-07:00");
  assert.equal(
    customerPrivateTelemetryHourKey("production", recordedAt),
    `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:production:2026-08-14T06Z`,
  );
  assert.equal(
    customerPrivateTelemetryQuarterKey("production", recordedAt),
    `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:quarter:production:2026-08-14T06:45Z`,
  );
  assert.equal(
    customerPrivateTelemetryUtcQuarter(new Date("2026-08-14T06:59:59.999Z")),
    "2026-08-14T06:45Z",
  );
  assert.equal(CUSTOMER_PRIVATE_TELEMETRY_QUARTER_MINUTES, 15);
  assert.equal(customerPrivateTelemetryEnvironment("production"), "production");
  assert.equal(customerPrivateTelemetryEnvironment("preview"), "preview");
  assert.equal(
    customerPrivateTelemetryEnvironment("development"),
    "development",
  );
  assert.equal(customerPrivateTelemetryEnvironment("staging"), "development");
  assert.throws(
    () =>
      customerPrivateTelemetryHourKey("staging" as "production", recordedAt),
    /customer_private_telemetry_environment_invalid/,
  );

  const keyAndField = `${customerPrivateTelemetryHourKey("preview", recordedAt)}:${customerPrivateTelemetryQuarterKey("preview", recordedAt)}:${customerPrivateTelemetryField(validEvent)}`;
  for (const privateValue of [
    "customer-private-subject",
    "owner@example.com",
    "session-123",
    "/me/shelf?query=private",
    "routine-42",
    "product-slug-42",
  ]) {
    assert.ok(!keyAndField.includes(privateValue));
  }
});

test("latency is reduced to a bounded coarse enum", () => {
  assert.equal(customerPrivateTelemetryLatencyBucket(-1), "under_100ms");
  assert.equal(customerPrivateTelemetryLatencyBucket(99), "under_100ms");
  assert.equal(customerPrivateTelemetryLatencyBucket(100), "100_499ms");
  assert.equal(customerPrivateTelemetryLatencyBucket(499), "100_499ms");
  assert.equal(customerPrivateTelemetryLatencyBucket(500), "500_999ms");
  assert.equal(customerPrivateTelemetryLatencyBucket(999), "500_999ms");
  assert.equal(customerPrivateTelemetryLatencyBucket(1_000), "1_2s");
  assert.equal(customerPrivateTelemetryLatencyBucket(1_999), "1_2s");
  assert.equal(customerPrivateTelemetryLatencyBucket(2_000), "at_least_2s");
});

test("recording atomically writes hourly and quarter counters with one fixed expiry", async () => {
  const writes: Array<[readonly [string, string], string, number]> = [];
  const recordedAt = [
    new Date("2026-08-14T06:01:00.000Z"),
    new Date("2026-08-14T06:59:59.999Z"),
  ];
  const dependencies = {
    now: () => recordedAt.shift()!,
    environment: () => "preview",
    write: async (
      keys: readonly [string, string],
      field: string,
      expiresAtUnixSeconds: number,
    ) => {
      writes.push([keys, field, expiresAtUnixSeconds]);
      return true;
    },
  } as const;
  assert.equal(
    await recordCustomerPrivateTelemetry(validEvent, dependencies),
    true,
  );
  assert.equal(
    await recordCustomerPrivateTelemetry(validEvent, dependencies),
    true,
  );
  const fixedExpiry = customerPrivateTelemetryExpiresAt(
    new Date("2026-08-14T06:00:00.000Z"),
  );
  assert.deepEqual(writes, [
    [
      [
        `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:preview:2026-08-14T06Z`,
        `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:quarter:preview:2026-08-14T06:00Z`,
      ],
      "shelf:add:success:100_499ms",
      fixedExpiry,
    ],
    [
      [
        `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:preview:2026-08-14T06Z`,
        `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:quarter:preview:2026-08-14T06:45Z`,
      ],
      "shelf:add:success:100_499ms",
      fixedExpiry,
    ],
  ]);
  assert.equal(CUSTOMER_PRIVATE_TELEMETRY_RETENTION_SECONDS, 3_024_000);
});

test("missing, failing, and invalid telemetry writes are best-effort no-ops", async () => {
  assert.equal(
    await recordCustomerPrivateTelemetry(validEvent, { write: null }),
    false,
  );
  assert.equal(
    await recordCustomerPrivateTelemetry(validEvent, {
      write: async () => {
        throw new Error("provider failed");
      },
    }),
    false,
  );
  let called = false;
  const malformed = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("malformed object");
      },
    },
  );
  assert.equal(parseCustomerPrivateTelemetryEvent(malformed), null);
  assert.equal(
    await recordCustomerPrivateTelemetry(
      {
        ...validEvent,
        requestBody: "private",
      },
      {
        write: async () => {
          called = true;
          return true;
        },
      },
    ),
    false,
  );
  assert.equal(
    await recordCustomerPrivateTelemetry(
      {
        ...validEvent,
        [Symbol("private")]: "private",
      },
      {
        write: async () => {
          called = true;
          return true;
        },
      },
    ),
    false,
  );
  assert.equal(
    await recordCustomerPrivateTelemetry(malformed, {
      write: async () => {
        called = true;
        return true;
      },
    }),
    false,
  );
  assert.equal(called, false);
});

test("successful operations schedule measurement after completion", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  const events: CustomerPrivateTelemetryEvent[] = [];
  const times = [1_000, 1_620];
  const value = await measureCustomerPrivateOperation(
    { surface: "home", operation: "read" },
    async () => "unchanged-result",
    {
      now: () => times.shift() ?? 0,
      schedule: (task) => scheduled.push(task),
      record: async (event) => {
        events.push(event);
        return true;
      },
    },
  );
  assert.equal(value, "unchanged-result");
  assert.equal(scheduled.length, 1);
  assert.deepEqual(events, []);
  await scheduled[0]();
  assert.deepEqual(events, [
    {
      surface: "home",
      operation: "read",
      outcome: "success",
      latencyBucket: "500_999ms",
    },
  ]);
});

test("failed operations schedule failure and rethrow the original signal", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  const events: CustomerPrivateTelemetryEvent[] = [];
  const signal = new Error("NEXT_NOT_FOUND");
  const times = [10, 2_010];
  await assert.rejects(
    measureCustomerPrivateOperation(
      { surface: "product", operation: "read" },
      async () => {
        throw signal;
      },
      {
        now: () => times.shift() ?? 0,
        schedule: (task) => scheduled.push(task),
        record: async (event) => {
          events.push(event);
          return true;
        },
      },
    ),
    (error) => error === signal,
  );
  assert.deepEqual(events, []);
  await scheduled[0]();
  assert.deepEqual(events, [
    {
      surface: "product",
      operation: "read",
      outcome: "failure",
      latencyBucket: "at_least_2s",
    },
  ]);

  const unchanged = await measureCustomerPrivateOperation(
    { surface: "shelf", operation: "clear" },
    async () => "still returned",
    {
      schedule: () => {
        throw new Error("after unavailable");
      },
    },
  );
  assert.equal(unchanged, "still returned");
});

test("response measurement preserves the response and classifies its status", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  const events: CustomerPrivateTelemetryEvent[] = [];
  const response = Response.json({ error: "unchanged" }, { status: 503 });
  const returned = await measureCustomerPrivateResponseOperation(
    { surface: "product_requests", operation: "read" },
    async () => response,
    {
      now: () => 0,
      schedule: (task) => scheduled.push(task),
      record: async (event) => {
        events.push(event);
        return true;
      },
    },
  );
  assert.equal(returned, response);
  await scheduled[0]();
  assert.equal(events[0]?.outcome, "failure");
});

test("semantic mutation failures preserve their result and measurement failures stay inert", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  const events: CustomerPrivateTelemetryEvent[] = [];
  const result = { status: "error" as const, message: "unchanged" };
  const returned = await measureCustomerPrivateResultOperation(
    { surface: "locations", operation: "save" },
    async () => result,
    (value) => value.status === ("saved" as string),
    {
      now: () => {
        throw new Error("clock unavailable");
      },
      schedule: (task) => scheduled.push(task),
      record: async (event) => {
        events.push(event);
        return true;
      },
    },
  );
  assert.equal(returned, result);
  await scheduled[0]();
  assert.equal(events[0]?.outcome, "failure");
  assert.equal(events[0]?.latencyBucket, "under_100ms");
});

test("the report reads only the rolling 28-day production hashes and aggregates enums", async () => {
  let requestedKeys: readonly string[] = [];
  const now = new Date("2026-08-14T06:42:00Z");
  const report = await readCustomerPrivateTelemetryReport(
    {},
    {
      now: () => now,
      readHours: async (keys) => {
        requestedKeys = keys;
        const records: Array<Readonly<Record<string, unknown>> | null> =
          Array.from({ length: keys.length }, () => null);
        records[0] = {
          "home:read:success:under_100ms": 9,
          "home:read:failure:500_999ms": "1",
          "shelf:add:success:100_499ms": "3",
          "shelf:remove:failure:at_least_2s": 1,
          "owner@example.com:read:success:under_100ms": 100,
          "home:read:success:under_100ms:private": 100,
          "home:read:success:100_499ms": "-1",
        };
        return records;
      },
    },
  );

  assert.equal(CUSTOMER_PRIVATE_TELEMETRY_DEFAULT_REPORT_DAYS, 28);
  assert.equal(requestedKeys.length, 28 * 24);
  assert.equal(
    requestedKeys[0],
    customerPrivateTelemetryHourKey(
      "production",
      new Date(now.valueOf() - (28 * 24 - 1) * 60 * 60 * 1_000),
    ),
  );
  assert.equal(
    requestedKeys.at(-1),
    customerPrivateTelemetryHourKey("production", now),
  );
  assert.ok(requestedKeys.every((key) => key.includes(":production:")));
  assert.deepEqual(report.read, {
    total: 10,
    success: 9,
    failure: 1,
    successRate: 0.9,
  });
  assert.deepEqual(report.write, {
    total: 4,
    success: 3,
    failure: 1,
    successRate: 0.75,
  });
  assert.equal(report.counts.surface.home, 10);
  assert.equal(report.counts.surface.shelf, 4);
  assert.equal(report.counts.operation.read, 10);
  assert.equal(report.counts.operation.add, 3);
  assert.equal(report.counts.operation.remove, 1);
  assert.equal(report.counts.outcome.success, 12);
  assert.equal(report.counts.outcome.failure, 2);
  assert.equal(report.counts.latency.under_100ms, 9);
  assert.equal(report.counts.latency["100_499ms"], 3);
  assert.equal(report.counts.latency["500_999ms"], 1);
  assert.equal(report.counts.latency.at_least_2s, 1);
});

test("non-production reports require a fixed explicit environment and config errors are clear", async () => {
  let keys: readonly string[] = [];
  const report = await readCustomerPrivateTelemetryReport(
    {
      environment: "preview",
      days: 1,
    },
    {
      now: () => new Date("2026-08-14T06:00:00Z"),
      readHours: async (requested) => {
        keys = requested;
        return Array.from({ length: requested.length }, () => null);
      },
    },
  );
  assert.equal(report.environment, "preview");
  assert.equal(keys.length, 24);
  assert.ok(keys.every((key) => key.includes(":preview:")));
  await assert.rejects(
    readCustomerPrivateTelemetryReport(
      {
        environment: "staging" as "production",
      },
      { readHours: async () => [] },
    ),
    /customer_private_telemetry_environment_invalid/,
  );
  await assert.rejects(
    readCustomerPrivateTelemetryReport({}, { readHours: null }),
    /customer_private_telemetry_redis_not_configured/,
  );
});

test("the fast-burn report reads only the last completed UTC quarter", async () => {
  let requestedKeys: readonly string[] = [];
  const report = await readCustomerPrivateTelemetryCompletedQuarterReport(
    { environment: "production" },
    {
      now: () => new Date("2026-08-14T06:37:42.123Z"),
      readHours: async (keys) => {
        requestedKeys = keys;
        return [
          {
            "home:read:success:under_100ms": "99",
            "home:read:failure:500_999ms": "1",
            "shelf:add:success:100_499ms": "49",
            "shelf:add:failure:at_least_2s": "1",
            "owner@example.com:read:success:under_100ms": "100",
          },
        ];
      },
    },
  );

  assert.deepEqual(requestedKeys, [
    `${CUSTOMER_PRIVATE_TELEMETRY_PREFIX}:quarter:production:2026-08-14T06:15Z`,
  ]);
  assert.deepEqual(report, {
    environment: "production",
    window: {
      minutes: 15,
      startMinute: "2026-08-14T06:15Z",
      endMinuteExclusive: "2026-08-14T06:30Z",
    },
    read: { total: 100, success: 99, failure: 1, successRate: 0.99 },
    write: { total: 50, success: 49, failure: 1, successRate: 0.98 },
    writesPerformed: 0,
  });
});

test("all current authenticated Me reads and mutations use the private aggregate helper", () => {
  const home = readFileSync("app/(customer)/me/page.tsx", "utf8");
  const child = readFileSync("app/(customer)/me/[...route]/page.ts", "utf8");
  const actions = readFileSync("app/(customer)/me/actions.ts", "utf8");
  const notificationActions = readFileSync(
    "app/(customer)/me/notification-actions.ts",
    "utf8",
  );
  const shelfExport = readFileSync(
    "app/(customer)/me/shelf/export/route.ts",
    "utf8",
  );
  const notifications = readFileSync(
    "app/api/me/notifications/route.ts",
    "utf8",
  );
  const requestCollection = readFileSync(
    "app/api/me/product-requests/route.ts",
    "utf8",
  );
  const requestItem = readFileSync(
    "app/api/me/product-requests/[id]/route.ts",
    "utf8",
  );
  const requestImage = readFileSync(
    "app/api/me/product-requests/[id]/image/route.ts",
    "utf8",
  );

  assert.match(
    home,
    /await requireCustomer\(\)[\s\S]*surface: 'home', operation: 'read'/,
  );
  assert.match(home, /model\.shelfSection\.state\.status === 'ready'/);
  assert.match(home, /model\.routineSection\.state\.status === 'ready'/);
  assert.match(
    child,
    /await requireCustomer\(continuation\)[\s\S]*measureMeRead\(\s*"product"/,
  );
  for (const surface of [
    "product",
    "explore",
    "routine",
    "consult",
    "orders",
    "notifications",
    "locations",
    "shelf",
  ]) {
    assert.match(
      child,
      new RegExp(`measureMeRead\\(\\s*"${surface}"`),
      surface,
    );
  }
  assert.match(child, /measureCustomerPrivateResultOperation/);
  assert.match(child, /locationRead\.status === "ready"/);
  for (const [surface, operation] of [
    ["shelf", "add"],
    ["shelf", "remove"],
    ["shelf", "clear"],
    ["concerns", "add"],
    ["concerns", "remove"],
    ["concerns", "clear"],
    ["locations", "save"],
    ["locations", "remove"],
    ["routine", "create"],
    ["routine", "update"],
    ["routine", "delete"],
  ]) {
    assert.match(
      actions,
      new RegExp(`measureMeMutation\\(\\s*"${surface}",\\s*"${operation}"`),
      `${surface}:${operation}`,
    );
  }
  assert.equal(
    notificationActions.match(/surface: 'notifications'/g)?.length,
    2,
  );
  assert.equal(notificationActions.match(/operation: 'update'/g)?.length, 2);

  for (const [source, dimensions] of [
    [shelfExport, "{ surface: 'shelf', operation: 'export' }"],
    [notifications, "{ surface: 'notifications', operation: 'read' }"],
    [requestCollection, "{ surface: 'product_requests', operation: 'read' }"],
    [requestCollection, "{ surface: 'product_requests', operation: 'create' }"],
    [requestItem, "{ surface: 'product_requests', operation: 'read' }"],
    [requestItem, "{ surface: 'product_requests', operation: 'update' }"],
    [requestItem, "{ surface: 'product_requests', operation: 'delete' }"],
    [requestImage, "{ surface: 'product_requests', operation: 'read' }"],
    [requestImage, "{ surface: 'product_requests', operation: 'save' }"],
    [requestImage, "{ surface: 'product_requests', operation: 'remove' }"],
  ] as const) {
    assert.ok(source.includes(dimensions), dimensions);
  }
  assert.match(
    requestCollection,
    /authenticatedProductRequestCustomer\(\)[\s\S]*measureCustomerPrivateResponseOperation/,
  );
  assert.match(
    notifications,
    /getCustomerIdentity\(\)[\s\S]*measureCustomerPrivateResponseOperation/,
  );
});

test("telemetry remains server-only, aggregate-only, and operator-readable only by command", () => {
  const telemetry = readFileSync("lib/customer/private-telemetry.ts", "utf8");
  const script = readFileSync("scripts/report-customer-telemetry.ts", "utf8");
  const analytics = readFileSync("docs/ANALYTICS.md", "utf8");
  const roadmap = readFileSync(
    "docs/product/JELOCARE_ME_PRODUCTION_ROADMAP.md",
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(telemetry, /import "server-only"/);
  assert.match(telemetry, /import \{ after \} from "next\/server"/);
  assert.match(telemetry, /HINCRBY/);
  assert.match(telemetry, /EXPIREAT/);
  assert.doesNotMatch(
    telemetry,
    /cookies\(|headers\(|console\.|userAgent|referrer/i,
  );
  assert.match(
    script,
    /environment: CustomerPrivateTelemetryEnvironment = 'production'/,
  );
  assert.match(script, /console\.log\(JSON\.stringify\(report/);
  assert.equal(
    packageJson.scripts["customer:telemetry:report"],
    "tsx scripts/report-customer-telemetry.ts",
  );
  assert.match(analytics, /expire no later than 35 days/);
  assert.match(analytics, /npm run customer:telemetry:report/);
  assert.match(
    roadmap,
    /authenticated production evidence, SLO observation, alerts, and recovery remain/i,
  );
  assert.equal(customerCapabilities.privateTelemetry, true);
});
