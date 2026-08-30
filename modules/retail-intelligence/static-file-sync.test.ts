import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStaticOfferRefreshes,
  describeStaticFileSyncGetFailure,
  staticFileSyncConfig,
  staticFileSyncConfiguration,
  type StaticFileRefreshedOffer,
} from "@/lib/inventory/static-file-sync";

const content = `const checkedAt = "2026-08-10T10:00:00Z";
const verifiedRetailOffers = {
  "exact-product": [
    exactNg(
      "Exact Store",
      "https://store.example/exact-product",
      90,
      10000,
      "Exact Product",
      "50 ml",
      {
        observedAt: "2026-08-10T10:00:00Z",
        expiresAt: "2026-08-15T10:00:00Z",
      },
    ),
  ],
};
`;

function offer(
  overrides: Partial<StaticFileRefreshedOffer> = {},
): StaticFileRefreshedOffer {
  return {
    productSlug: "exact-product",
    retailer: "Exact Store",
    priceNgn: 12_000,
    available: true,
    inventoryStatus: "in_stock",
    lastVerifiedAt: new Date("2026-08-11T10:00:00Z"),
    verificationExpiresAt: new Date("2026-08-14T10:00:00Z"),
    verificationMethod: "retailer_page",
    extractionConfidence: 85,
    ...overrides,
  };
}

test("static sync requires an explicit non-production review branch", () => {
  const base = {
    STATIC_FILE_SYNC_ENABLED: "true",
    GITHUB_TOKEN: "configured",
  };
  assert.equal(staticFileSyncConfig(base), null);
  assert.equal(
    staticFileSyncConfig({ ...base, GITHUB_REPO_BRANCH: "main" }),
    null,
  );
  assert.equal(
    staticFileSyncConfig({ ...base, GITHUB_REPO_BRANCH: "master" }),
    null,
  );
  assert.equal(
    staticFileSyncConfig({ ...base, GITHUB_REPO_BRANCH: "production" }),
    null,
  );
  assert.equal(
    staticFileSyncConfig({
      ...base,
      GITHUB_REPO_BRANCH: "review-but-not-inventory-sync",
    }),
    null,
  );
  assert.equal(
    staticFileSyncConfig({
      ...base,
      GITHUB_REPO_BRANCH: "inventory-sync-review",
    })?.branch,
    "inventory-sync-review",
  );
  assert.equal(
    staticFileSyncConfig({
      ...base,
      GITHUB_REPO_BRANCH: "inventory-sync-review/2026-08-13",
    })?.branch,
    "inventory-sync-review/2026-08-13",
  );
});

test("enabled static sync reports actionable configuration issues", () => {
  assert.deepEqual(
    staticFileSyncConfiguration({ STATIC_FILE_SYNC_ENABLED: "false" }),
    { status: "disabled" },
  );
  assert.deepEqual(
    staticFileSyncConfiguration({ STATIC_FILE_SYNC_ENABLED: "true" }),
    { status: "misconfigured", issue: "missing_github_token" },
  );
  assert.deepEqual(
    staticFileSyncConfiguration({
      STATIC_FILE_SYNC_ENABLED: "true",
      GITHUB_TOKEN: "configured",
    }),
    { status: "misconfigured", issue: "missing_review_branch" },
  );
  assert.deepEqual(
    staticFileSyncConfiguration({
      STATIC_FILE_SYNC_ENABLED: "true",
      GITHUB_TOKEN: "configured",
      GITHUB_REPO_BRANCH: "main",
    }),
    { status: "misconfigured", issue: "invalid_review_branch" },
  );
});

test("a missing remote review branch has a stable actionable failure code", () => {
  assert.equal(
    describeStaticFileSyncGetFailure({ status: 404, statusText: "Not Found" }),
    "static_file_sync_review_branch_not_found: GITHUB_REPO_BRANCH must name an existing inventory-sync-review* branch",
  );
  assert.equal(
    describeStaticFileSyncGetFailure({
      status: 403,
      statusText: "Forbidden",
      rateLimitRemaining: "0",
    }),
    "static_file_sync_github_rate_limited",
  );
});

test("AI and low-confidence observations remain database-only", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [
      offer({ verificationMethod: "ai_extraction", extractionConfidence: 50 }),
      offer({ extractionConfidence: 59 }),
    ],
  });
  assert.equal(result.synced, 0);
  assert.equal(result.skipped, 2);
  assert.equal(result.content, content);
});

test("eligible observations preserve provenance and their shorter actual expiry", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [offer()],
  });
  assert.equal(result.synced, 1);
  assert.equal(result.skipped, 0);
  assert.match(result.content, /\b12000,/);
  assert.match(result.content, /observedAt: "2026-08-11T10:00:00Z"/);
  assert.match(result.content, /expiresAt: "2026-08-14T10:00:00Z"/);
  assert.match(result.content, /verificationMethod: "retailer_page"/);
});

test("terminal contradictions propose unavailable expired static fallback without deleting provenance", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [],
    invalidatedOffers: [
      {
        productSlug: "exact-product",
        retailer: "Exact Store",
        invalidatedAt: new Date("2026-08-12T10:00:00Z"),
        reason: "package_size",
      },
    ],
  });

  assert.equal(result.synced, 0);
  assert.equal(result.invalidated, 1);
  assert.equal(result.skipped, 0);
  assert.match(result.content, /\b10000,/);
  assert.match(result.content, /observedAt: "2026-08-10T10:00:00Z"/);
  assert.match(result.content, /expiresAt: "2026-08-12T10:00:00Z"/);
  assert.match(result.content, /available: false/);
  assert.match(result.content, /stock: "unknown"/);
  assert.match(result.content, /"Exact Product",\s*"50 ml"/);
});

test("no terminal invalidation leaves static fallback bytes unchanged", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [],
    invalidatedOffers: [],
  });
  assert.equal(result.synced, 0);
  assert.equal(result.invalidated, 0);
  assert.equal(result.content, content);
});

test("a missing product slug is a counted no-op without a sync error", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [],
    invalidatedOffers: [
      {
        productSlug: "not-checked-in",
        retailer: "Exact Store",
        invalidatedAt: new Date("2026-08-12T10:00:00Z"),
        reason: "product_identity",
      },
    ],
  });

  assert.equal(result.invalidated, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.content, content);
});

test("a missing exact retailer pair is a counted no-op without a sync error", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [],
    invalidatedOffers: [
      {
        productSlug: "exact-product",
        retailer: "Not Checked-In Store",
        invalidatedAt: new Date("2026-08-12T10:00:00Z"),
        reason: "route_scope",
      },
    ],
  });

  assert.equal(result.invalidated, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.content, content);
});

test("a stale terminal invalidation cannot override newer static evidence", () => {
  const result = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [],
    invalidatedOffers: [
      {
        productSlug: "exact-product",
        retailer: "Exact Store",
        invalidatedAt: new Date("2026-08-09T10:00:00Z"),
        reason: "route_scope",
      },
    ],
  });
  assert.equal(result.invalidated, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.content, content);
});

test("freshness is capped and large automated price changes stop for review", () => {
  const capped = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [
      offer({ verificationExpiresAt: new Date("2026-08-30T10:00:00Z") }),
    ],
  });
  assert.equal(capped.synced, 1);
  assert.match(capped.content, /expiresAt: "2026-08-16T10:00:00Z"/);

  const blocked = applyStaticOfferRefreshes({
    content,
    refreshedOffers: [offer({ priceNgn: 14_000 })],
  });
  assert.equal(blocked.synced, 0);
  assert.equal(blocked.skipped, 1);
  assert.match(blocked.errors[0] ?? "", /exceeds 35% review bound/);
  assert.equal(blocked.content, content);
});
