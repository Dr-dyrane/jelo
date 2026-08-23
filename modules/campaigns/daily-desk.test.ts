import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { dailyDeskAggregateMetricKey } from "@/lib/campaigns/campaign-archive";
import {
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
    offerEvidence: [{ priceNgn: 12_000 }],
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
    { readAcceptedCampaign: async () => null },
  );
  assert.deepEqual(noCampaign, { status: "no-campaign", date });

  const unavailable = await getDailyDeskReadModel(
    { now: new Date("2026-08-13T08:00:00Z") },
    {
      readAcceptedCampaign: async () => {
        throw new Error("ledger unavailable");
      },
    },
  );
  assert.deepEqual(unavailable, { status: "unavailable", date });
});

test("the previous accepted Desk bridges only the next Lagos calendar day", async () => {
  const requestedDates: string[] = [];
  const result = await getDailyDeskReadModel(
    { now: new Date("2026-08-14T01:00:00Z") },
    {
      readAcceptedCampaign: async (requestedDate) => {
        requestedDates.push(requestedDate);
        return requestedDate === date ? acceptedRecord() : null;
      },
    },
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
    {
      readAcceptedCampaign: async (requestedDate) => {
        requestedDates.push(requestedDate);
        return requestedDate === "2026-08-14" ? "not-json" : acceptedRecord();
      },
    },
  );

  assert.deepEqual(requestedDates, ["2026-08-14"]);
  assert.deepEqual(result, { status: "unavailable", date: "2026-08-14" });
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
