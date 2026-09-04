import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { Product } from "@/data/products";
import { dailyDeskAggregateMetricKey } from "@/lib/campaigns/campaign-archive";
import {
  dailyDeskEvidenceIsCurrent,
  getDailyDeskReadModel,
  projectAcceptedCampaignForDailyDesk,
} from "@/lib/campaigns/daily-desk";

const date = "2026-08-13";
const campaignId = `${date}-exact-product-price-context`;

function acceptedRecord(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    campaignId,
    dataCheckedAt: "2026-08-13T07:00:00.000Z",
    product: {
      slug: "exact-product",
      brand: "Exact Brand",
      name: "Exact Product",
      size: "50 ml",
      packageVersion: "Current package",
    },
    offerEvidence: [
      {
        retailer: "Exact store",
        listingUrl: "https://retailer.example/exact-product",
        priceNgn: 12_000,
        stock: "in-stock",
        observedAt: "2026-08-13T07:00:00.000Z",
        checkedAt: "2026-08-13T07:00:00.000Z",
      },
    ],
    evidenceBoundary:
      "Price/share-ready only: 1 fresh, exact, evidence-bound Nigerian listing.",
    copy: {
      headline: "Current price.",
      productLine: "EXACT BRAND · Exact Product · 50 ml",
      priceLine: "₦12,000",
      action: "Compare current prices",
      disclaimer: "Prices change.",
      caption: "Not projected to the public read model.",
    },
    actionUrl: "https://www.jelocare.com/share/exact-product",
    creative: [
      {
        mode: "dark",
        url: "https://blob.example/exact-product-story.png",
        downloadUrl: "https://blob.example/exact-product-story.png?download=1",
        width: 1080,
        height: 1920,
        sha256: "a".repeat(64),
        generationRoute: "deterministic-next-og-story",
        sourceAssetVerified: true,
      },
    ],
    delivery: {
      recipient: { recipientKey: "must-never-project" },
    },
    ...overrides,
  });
}

function currentProduct(offerOverrides: Record<string, unknown> = {}): Product {
  return {
    slug: "exact-product",
    brand: "Exact Brand",
    name: "Exact Product",
    size: "50 ml",
    category: "Face",
    step: "Treat",
    image: "/exact-product.png",
    displayLine: "Treat",
    bestFor: [],
    concerns: [],
    skinTypes: [],
    sensitiveFriendly: true,
    usage: "Use as directed.",
    evidence: "moderate",
    offers: [
      {
        retailer: "Exact store",
        url: "https://retailer.example/exact-product",
        trust: 90,
        available: true,
        priceNgn: 12_000,
        checkedAt: "2026-08-13T07:00:00.000Z",
        expiresAt: "2026-08-20T07:00:00.000Z",
        match: "exact",
        listingEvidence: {
          sourceUrl: "https://retailer.example/exact-product",
          observedAt: "2026-08-13T07:00:00.000Z",
          basis: "retailer-page",
        },
        priceObservation: {
          observedAt: "2026-08-13T07:00:00.000Z",
          variant: "Exact Brand Exact Product",
          size: "50 ml",
          stock: "in-stock",
          landedCost: "unknown",
        },
        location: ["NG"],
        ...offerOverrides,
      },
    ],
  };
}

function dependencies(
  readAcceptedCampaign: (date: string) => Promise<string | null>,
  product: Product | null = currentProduct(),
) {
  return {
    readAcceptedCampaign,
    readProduct: async () => product,
  };
}

test("the Daily Desk projects only a current accepted share-ready campaign", () => {
  const result = projectAcceptedCampaignForDailyDesk(acceptedRecord(), date);
  assert.equal(result?.status, "ready");
  assert.equal(result?.recency, "current-day");
  assert.equal(result?.campaignId, campaignId);
  assert.equal(
    result?.actionUrl,
    "https://www.jelocare.com/share/exact-product",
  );
  assert.equal(result?.evidence.offerCount, 1);
  assert.equal(
    result?.evidence.offers[0]?.listingUrl,
    "https://retailer.example/exact-product",
  );
  assert.deepEqual(result?.product, {
    slug: "exact-product",
    brand: "Exact Brand",
    name: "Exact Product",
    size: "50 ml",
  });
  assert.doesNotMatch(JSON.stringify(result), /recipient|downloadUrl|caption/);
});

test("malformed, stale, non-price, or unverified creative records fail closed", () => {
  assert.equal(projectAcceptedCampaignForDailyDesk("not-json", date), null);
  assert.equal(
    projectAcceptedCampaignForDailyDesk(acceptedRecord(), "2026-08-14"),
    null,
  );
  assert.equal(
    projectAcceptedCampaignForDailyDesk(
      acceptedRecord({ actionUrl: "https://example.com/wrong" }),
      date,
    ),
    null,
  );
  assert.equal(
    projectAcceptedCampaignForDailyDesk(
      acceptedRecord({ evidenceBoundary: "Reference only." }),
      date,
    ),
    null,
  );
  assert.equal(
    projectAcceptedCampaignForDailyDesk(
      acceptedRecord({ offerEvidence: [{ priceNgn: 0 }] }),
      date,
    ),
    null,
  );
  const record = JSON.parse(acceptedRecord()) as {
    creative: Array<Record<string, unknown>>;
  };
  record.creative[0]!.sourceAssetVerified = false;
  assert.equal(
    projectAcceptedCampaignForDailyDesk(JSON.stringify(record), date),
    null,
  );
});

test("missing or unreadable accepted records become bounded fallback states", async () => {
  const noCampaign = await getDailyDeskReadModel(
    { now: new Date("2026-08-13T08:00:00Z") },
    dependencies(async () => null),
  );
  assert.deepEqual(noCampaign, { status: "no-campaign", date });

  const unavailable = await getDailyDeskReadModel(
    { now: new Date("2026-08-13T08:00:00Z") },
    dependencies(async () => {
      throw new Error("ledger unavailable");
    }),
  );
  assert.deepEqual(unavailable, { status: "unavailable", date });
});

test("the previous accepted Desk bridges only the next Lagos calendar day", async () => {
  const requestedDates: string[] = [];
  const result = await getDailyDeskReadModel(
    { now: new Date("2026-08-14T01:00:00Z") },
    dependencies(async (requestedDate) => {
      requestedDates.push(requestedDate);
      return requestedDate === date ? acceptedRecord() : null;
    }),
  );

  assert.deepEqual(requestedDates, ["2026-08-14", "2026-08-13"]);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.date, "2026-08-13");
  assert.equal(result.recency, "previous-day");
  assert.equal(result.campaignId, campaignId);
});

test("a malformed current-day record fails closed instead of carrying yesterday", async () => {
  const requestedDates: string[] = [];
  const result = await getDailyDeskReadModel(
    { now: new Date("2026-08-14T01:00:00Z") },
    dependencies(async (requestedDate) => {
      requestedDates.push(requestedDate);
      return requestedDate === "2026-08-14" ? "not-json" : acceptedRecord();
    }),
  );

  assert.deepEqual(requestedDates, ["2026-08-14"]);
  assert.deepEqual(result, { status: "unavailable", date: "2026-08-14" });
});

test("an accepted Desk is suppressed when its exact offer is no longer current", async () => {
  const accepted = projectAcceptedCampaignForDailyDesk(acceptedRecord(), date);
  assert.ok(accepted);
  assert.equal(
    dailyDeskEvidenceIsCurrent(
      accepted,
      currentProduct({ priceNgn: 12_500 }),
      new Date("2026-08-13T08:00:00Z"),
    ),
    false,
  );

  const result = await getDailyDeskReadModel(
    { now: new Date("2026-08-13T08:00:00Z") },
    dependencies(
      async () => acceptedRecord(),
      currentProduct({ available: false }),
    ),
  );
  assert.deepEqual(result, { status: "evidence-expired", date });
});

test("an accepted Desk is suppressed when the current exact-offer set grows", () => {
  const accepted = projectAcceptedCampaignForDailyDesk(acceptedRecord(), date);
  assert.ok(accepted);
  const product = currentProduct();
  product.offers.push({
    ...product.offers[0]!,
    retailer: "New exact store",
    url: "https://new-retailer.example/exact-product",
    priceNgn: 10_500,
    checkedAt: "2026-08-13T07:30:00.000Z",
    listingEvidence: {
      sourceUrl: "https://new-retailer.example/exact-product",
      observedAt: "2026-08-13T07:30:00.000Z",
      basis: "retailer-page",
    },
    priceObservation: {
      ...product.offers[0]!.priceObservation!,
      observedAt: "2026-08-13T07:30:00.000Z",
    },
  });

  assert.equal(
    dailyDeskEvidenceIsCurrent(
      accepted,
      product,
      new Date("2026-08-13T08:00:00Z"),
    ),
    false,
  );
});

test("aggregate keys contain only date, public campaign identity, and event", () => {
  assert.equal(
    dailyDeskAggregateMetricKey({ date, campaignId, event: "view" }),
    `jelocare:campaigns:v1:daily-desk:aggregate:${date}:${campaignId}:view`,
  );
  assert.throws(() =>
    dailyDeskAggregateMetricKey({
      date,
      campaignId: `${campaignId}:visitor@example.com`,
      event: "view",
    }),
  );
});

test("the event boundary is same-site, bounded, write-only, and identifier-free", async () => {
  const root = process.cwd();
  const [route, client, archive] = await Promise.all([
    readFile(
      path.join(root, "app/api/campaigns/daily-desk/events/route.ts"),
      "utf8",
    ),
    readFile(
      path.join(root, "components/campaigns/daily-desk-measurement.tsx"),
      "utf8",
    ),
    readFile(path.join(root, "lib/campaigns/campaign-archive.ts"), "utf8"),
  ]);

  assert.match(route, /sameSiteRequest\(request\)/);
  assert.match(route, /readBoundedJson\(request\)/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.doesNotMatch(route, /user-agent|x-forwarded-for|request\.cookies/i);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /referrerPolicy: "no-referrer"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(archive, /request\.headers|request\.cookies/);
});
