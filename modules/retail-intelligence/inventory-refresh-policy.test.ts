import assert from "node:assert/strict";
import test from "node:test";
import {
  assertClassifiedInventoryRefreshScope,
  canClaimInventoryRefreshJob,
  classifyInventoryRefreshFailure,
  INVENTORY_CRON_CLAIM_BUDGET_MS,
  INVENTORY_REFRESH_LEASE_MS,
  inventoryRefreshFailureSettlement,
  summarizeInventoryRefreshRun,
  transientInventoryRefreshFailure,
} from "@/lib/inventory/refresh-policy";
import { assertRetailerResponseScope } from "./response-scope";

const validScope = {
  requestedUrl: "https://retailer.example/exact-product",
  responseUrl: "https://retailer.example/exact-product",
  expectedTitle: "Example Barrier Serum",
  expectedSize: "50 ml",
  observedTitle: "Example Barrier Serum",
  observedSize: "50 ml",
  marketCode: "NG",
  currencyCode: "NGN",
};

function classifiedScopeFailure(overrides: Partial<typeof validScope>) {
  let caught: unknown;
  try {
    assertClassifiedInventoryRefreshScope(() => {
      assertRetailerResponseScope({ ...validScope, ...overrides });
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, "scope fixture should fail closed");
  return classifyInventoryRefreshFailure(caught);
}

test("the cron claim deadline is absolute and leaves bounded settlement room", () => {
  const requestStartedAt = 1_000_000;
  const deadline = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;

  assert.equal(canClaimInventoryRefreshJob(undefined, deadline + 1), true);
  assert.equal(canClaimInventoryRefreshJob(deadline, deadline - 1), true);
  assert.equal(canClaimInventoryRefreshJob(deadline, deadline), false);
  assert.equal(canClaimInventoryRefreshJob(deadline, deadline + 1), false);
  assert.ok(INVENTORY_CRON_CLAIM_BUDGET_MS + 12_000 < 300_000);
  assert.ok(INVENTORY_REFRESH_LEASE_MS > 12_000);
});

test("deterministic scope fixtures become typed terminal failures", () => {
  const fixtures = [
    {
      overrides: { responseUrl: "https://retailer.example/category" },
      reason: "route_scope",
    },
    {
      overrides: { observedTitle: "Example Foaming Cleanser" },
      reason: "product_identity",
    },
    {
      overrides: { observedSize: "100 ml" },
      reason: "package_size",
    },
    {
      overrides: { expectedSize: "Variant pack" },
      reason: "package_size",
    },
    {
      overrides: { currencyCode: "USD" },
      reason: "market_currency",
    },
  ] as const;

  for (const fixture of fixtures) {
    const failure = classifiedScopeFailure(fixture.overrides);
    assert.equal(failure.disposition, "terminal");
    assert.equal(failure.reason, fixture.reason);
  }
});

test("missing or unmeasurable observed evidence remains transient", () => {
  const fixtures = [
    { observedTitle: undefined },
    { observedSize: undefined },
    { observedSize: "large bottle" },
  ];

  for (const fixture of fixtures) {
    const failure = classifiedScopeFailure(fixture);
    assert.equal(failure.disposition, "transient");
    assert.equal(failure.reason, "evidence_incomplete");
  }
});

test("fetch and untyped runtime failures remain transient", () => {
  const fetchFailure = classifyInventoryRefreshFailure(
    transientInventoryRefreshFailure("fetch_unavailable", "retailer timed out"),
  );
  assert.equal(fetchFailure.disposition, "transient");
  assert.equal(fetchFailure.reason, "fetch_unavailable");

  const runtimeFailure = classifyInventoryRefreshFailure(
    new Error("temporary database connection failure"),
  );
  assert.equal(runtimeFailure.disposition, "transient");
  assert.equal(runtimeFailure.reason, "runtime");
});

test("only proven contradictions invalidate offers, even when transient retries are exhausted", () => {
  const titleMissing = inventoryRefreshFailureSettlement({
    error: classifiedScopeFailure({ observedTitle: undefined }),
    attemptCount: 1,
    maxAttempts: 5,
  });
  assert.equal(titleMissing.terminal, false);
  assert.equal(titleMissing.invalidateOffer, false);

  const exhaustedFetch = inventoryRefreshFailureSettlement({
    error: transientInventoryRefreshFailure(
      "fetch_unavailable",
      "retailer timed out",
    ),
    attemptCount: 5,
    maxAttempts: 5,
  });
  assert.equal(exhaustedFetch.terminal, true);
  assert.equal(exhaustedFetch.invalidateOffer, false);

  const contradiction = inventoryRefreshFailureSettlement({
    error: classifiedScopeFailure({ observedSize: "100 ml" }),
    attemptCount: 1,
    maxAttempts: 5,
  });
  assert.equal(contradiction.terminal, true);
  assert.equal(contradiction.invalidateOffer, true);
  assert.equal(contradiction.failure.reason, "package_size");
});

test("the structured run summary separates retry and terminal outcomes", () => {
  const summary = summarizeInventoryRefreshRun({
    queued: 3,
    withdrawn: 1,
    stoppedByDeadline: true,
    results: [
      {
        status: "completed",
        productSlug: "zinc-cleanser",
        recoveredLease: false,
      },
      {
        status: "completed",
        productSlug: "alpha-serum",
        recoveredLease: true,
      },
      {
        status: "completed",
        productSlug: "alpha-serum",
        recoveredLease: false,
      },
      {
        status: "retrying",
        productSlug: "retry-toner",
        recoveredLease: false,
        failureReason: "fetch_unavailable",
      },
      {
        status: "failed",
        productSlug: "failed-lotion",
        recoveredLease: true,
        failureReason: "package_size",
      },
      {
        status: "discarded",
        productSlug: "withdrawn-cream",
        recoveredLease: false,
      },
    ],
  });

  assert.deepEqual(summary, {
    queued: 3,
    withdrawn: 1,
    processed: 6,
    completed: 3,
    retrying: 1,
    failed: 1,
    discarded: 1,
    recoveredLeases: 2,
    failureReasons: {
      package_size: 1,
      fetch_unavailable: 1,
    },
    stoppedByDeadline: true,
    affectedProductSlugs: ["alpha-serum", "zinc-cleanser"],
  });
});
