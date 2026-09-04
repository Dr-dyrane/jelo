import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MARKET_TRUTH_RECEIPT_MAX_FUTURE_SKEW_MS,
  MARKET_TRUTH_RECEIPT_MAX_COUNTS,
  MARKET_TRUTH_RECEIPT_TTL_SECONDS,
  createScheduledOwnerReceipt,
  parseScheduledOwnerReceipt,
  serializeScheduledOwnerReceipt,
} from "@/lib/market-truth/receipt-contract";
import {
  SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT,
  START_SCHEDULED_OWNER_IF_LATEST_SCRIPT,
} from "@/lib/market-truth/receipt-store-scripts";

const storeSource = [
  "../../lib/market-truth/scheduled-owner-receipts.ts",
  "../../lib/market-truth/receipt-store-scripts.ts",
]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n");

test("scheduled owner receipts retain only bounded aggregate evidence", () => {
  const receipt = createScheduledOwnerReceipt({
    owner: "inventory-refresh",
    state: "completed",
    startedAt: "2026-09-04T17:16:00.000Z",
    settledAt: "2026-09-04T17:18:00.000Z",
    outcomeCode: "completed",
    counts: { completed: 12, deferred: 2 },
    revision: "abcdef1",
  });
  const stored = serializeScheduledOwnerReceipt(receipt);

  assert.deepEqual(parseScheduledOwnerReceipt(JSON.parse(stored)), receipt);
  assert.equal(stored.includes("url"), false);
  assert.equal(stored.includes("payload"), false);
  assert.equal(stored.includes("error"), false);
});

test("receipt parsing rejects arbitrary fields, raw strings and mismatched outcomes", () => {
  const valid = createScheduledOwnerReceipt({
    owner: "daily-desk-reconcile",
    state: "failed",
    startedAt: "2026-09-04T17:41:00.000Z",
    settledAt: "2026-09-04T17:42:00.000Z",
    outcomeCode: "reconciliation-failed",
    counts: { candidates: 1 },
    revision: "abcdef1",
  });

  assert.equal(
    parseScheduledOwnerReceipt({ ...valid, rawError: "secret" }),
    null,
  );
  assert.equal(
    parseScheduledOwnerReceipt({ ...valid, outcomeCode: "database exploded" }),
    null,
  );
  assert.equal(
    parseScheduledOwnerReceipt({
      ...valid,
      state: "completed",
      completedAt: valid.failedAt,
      failedAt: null,
      outcomeCode: "reconciliation-failed",
    }),
    null,
  );
  assert.equal(
    parseScheduledOwnerReceipt({
      ...valid,
      owner: "inventory-refresh",
      state: "completed",
      completedAt: valid.failedAt,
      failedAt: null,
      outcomeCode: "accepted",
    }),
    null,
  );
  assert.equal(
    parseScheduledOwnerReceipt({
      ...valid,
      state: "completed",
      completedAt: valid.failedAt,
      failedAt: null,
      outcomeCode: "started",
    }),
    null,
  );
});

test("receipt parsing rejects timestamps beyond bounded clock skew", () => {
  const now = Date.parse("2026-09-04T18:00:00.000Z");
  assert.equal(MARKET_TRUTH_RECEIPT_MAX_FUTURE_SKEW_MS, 5 * 60 * 1000);
  assert.equal(
    parseScheduledOwnerReceipt(
      {
        schemaVersion: 1,
        owner: "inventory-refresh",
        state: "completed",
        startedAt: "2099-01-01T00:00:00.000Z",
        completedAt: "2099-01-01T00:01:00.000Z",
        failedAt: null,
        outcomeCode: "completed",
        counts: {},
        revision: "abcdef1",
      },
      undefined,
      now,
    ),
    null,
  );
});

test("receipt counts are numeric, named and strictly bounded", () => {
  const tooManyCounts = Object.fromEntries(
    Array.from({ length: MARKET_TRUTH_RECEIPT_MAX_COUNTS + 1 }, (_, index) => [
      `count${index}`,
      index,
    ]),
  );
  assert.throws(
    () =>
      createScheduledOwnerReceipt({
        owner: "inventory-refresh",
        state: "completed",
        startedAt: "2026-09-04T17:46:00.000Z",
        settledAt: "2026-09-04T17:47:00.000Z",
        outcomeCode: "completed",
        counts: tooManyCounts,
        revision: "abcdef1",
      }),
    /market_truth_receipt_invalid/,
  );
});

test("the Redis owner store uses a TTL and cannot regress a newer or settled run", () => {
  assert.equal(MARKET_TRUTH_RECEIPT_TTL_SECONDS, 7 * 24 * 60 * 60);
  assert.match(storeSource, /currentStartedAt >= ARGV\[1\]/);
  assert.match(storeSource, /decoded\["startedAt"\] ~= ARGV\[1\]/);
  assert.match(storeSource, /decoded\["state"\] ~= "started"/);
  assert.match(storeSource, /"SET", KEYS\[1\], ARGV\[2\], "EX", ARGV\[3\]/);
  assert.doesNotMatch(
    storeSource,
    /lastError|rawError|productPayload|sourceUrl/,
  );
});

test("the receipt Lua transition preserves the first terminal settlement", () => {
  let stored: string | null = null;
  const run = (script: string, startedAt: string, next: string) => {
    if (script === START_SCHEDULED_OWNER_IF_LATEST_SCRIPT) {
      if (stored) {
        const current = JSON.parse(stored) as { startedAt: string };
        if (current.startedAt >= startedAt) return 0;
      }
      stored = next;
      return 1;
    }
    assert.equal(script, SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT);
    if (!stored) return 0;
    const current = JSON.parse(stored) as {
      startedAt: string;
      state: string;
    };
    if (current.startedAt !== startedAt) return 0;
    if (
      script.includes('decoded["state"] ~= "started"') &&
      current.state !== "started"
    ) {
      return 0;
    }
    stored = next;
    return 1;
  };
  const startedAt = "2026-09-04T17:16:00.000Z";
  const started = JSON.stringify({ state: "started", startedAt });
  const completed = JSON.stringify({ state: "completed", startedAt });
  const failed = JSON.stringify({ state: "failed", startedAt });

  assert.equal(
    run(START_SCHEDULED_OWNER_IF_LATEST_SCRIPT, startedAt, started),
    1,
  );
  assert.equal(
    run(SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT, startedAt, completed),
    1,
  );
  assert.equal(
    run(SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT, startedAt, failed),
    0,
  );
  assert.equal(stored, completed);
});
