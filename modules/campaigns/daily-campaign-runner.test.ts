import assert from "node:assert/strict";
import test from "node:test";
import { campaignDeliveryIntentKey } from "@/lib/campaigns/campaign-archive";
import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";
import { runDailyCampaign } from "@/lib/campaigns/daily-campaign-runner";

const now = new Date("2026-08-13T07:00:00Z");

const draft: DailyCampaignDraft = {
  schemaVersion: 1,
  campaignId: "2026-08-13-exact-product-price-context",
  status: "draft",
  createdAt: now.toISOString(),
  dataCheckedAt: now.toISOString(),
  objective: "current multi-store price comparison",
  selection: {
    source: "live-share-ranked-pool",
    signalKind: "gap",
    evidenceRank: 1,
    recentProductCooldownDays: 14,
    rejectedCandidates: [],
  },
  product: {
    slug: "exact-product",
    brand: "Exact Brand",
    name: "Exact Product",
    size: "50 ml",
    packageVersion: "Current package",
    identifier: { kind: "gtin", value: "12345670", label: "GTIN" },
    publicationScope: "neutral-reference",
  },
  sourceAsset: {
    url: "https://blob.example/packshot.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    width: 2000,
    height: 2000,
  },
  publicationEvidence: {
    dossierFingerprint: "b".repeat(64),
    releaseFingerprint: "c".repeat(64),
  },
  offerEvidence: [
    {
      retailer: "Store",
      listingUrl: "https://store.example/product",
      priceNgn: 12_000,
      stock: "in-stock",
      observedAt: now.toISOString(),
      checkedAt: now.toISOString(),
    },
  ],
  evidenceBoundary: "Share-ready exact price evidence.",
  careBoundary: "Price context only.",
  copy: {
    headline: "Same product.",
    productLine: "EXACT BRAND · Exact Product · 50 ml",
    priceLine: "₦12,000 — ₦14,000",
    action: "Compare current prices",
    disclaimer: "Prices change.",
    caption:
      "Same product. Compare current prices: https://www.jelocare.com/share/exact-product Prices change.",
    embeddedUrl: null,
  },
  creativePlan: {
    mode: "dark",
    width: 1080,
    height: 1920,
    generationRoute: "deterministic-next-og-story",
    storyKind: "price",
    trendWindow: null,
    renderPath: "/share/exact-product/story?kind=price",
  },
  channels: ["whatsapp-status", "instagram-stories", "snapchat"],
  actionUrl: "https://www.jelocare.com/share/exact-product",
  publication: [],
};

const rendered = {
  bytes: Buffer.from("png"),
  sha256: "d".repeat(64),
  width: 1080 as const,
  height: 1920 as const,
  contentType: "image/png" as const,
  sourceAssetVerified: true as const,
  renderUrl: "https://preview.example/share/exact-product/story?kind=price",
};

const archive = {
  mode: "test" as const,
  runPath: "campaigns/tests/2026-08-13/run/v1",
  image: {
    path: "campaigns/tests/2026-08-13/run/v1/story.png",
    url: "https://blob.example/story.png",
    downloadUrl: "https://blob.example/story.png?download=1",
    sha256: rendered.sha256,
    width: 1080 as const,
    height: 1920 as const,
  },
  campaignRecordKey: "jelocare:campaigns:v1:test:run:v1:campaign",
  checksumKey: "jelocare:campaigns:v1:test:run:v1:checksum",
};

const recipient = {
  kind: "test" as const,
  email: "owner@example.com",
  displayName: null,
  record: {
    kind: "test" as const,
    recipientKey: "e".repeat(64),
  },
};

test("production delivery intent is one atomic slot per WAT date", () => {
  const first = {
    ...archive,
    mode: "production" as const,
    runPath: "campaigns/daily/2026-08-13/first-campaign/v1",
    campaignRecordKey:
      "jelocare:campaigns:v1:production:first-campaign:v1:campaign",
  };
  const nextCandidate = {
    ...first,
    runPath: "campaigns/daily/2026-08-13/next-campaign/v1",
    campaignRecordKey:
      "jelocare:campaigns:v1:production:next-campaign:v1:campaign",
  };
  const tomorrow = {
    ...first,
    runPath: "campaigns/daily/2026-08-14/tomorrow-campaign/v1",
  };

  assert.equal(
    campaignDeliveryIntentKey(first),
    campaignDeliveryIntentKey(nextCandidate),
  );
  assert.notEqual(
    campaignDeliveryIntentKey(first),
    campaignDeliveryIntentKey(tomorrow),
  );
  assert.equal(
    campaignDeliveryIntentKey(archive),
    `${archive.campaignRecordKey}:delivery-intent`,
  );
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    now: () => now,
    recentSlugs: async () => new Set<string>(),
    select: async () => ({ status: "selected" as const, draft }),
    render: async () => rendered,
    archive: async () => archive,
    resolveRecipient: async () => recipient,
    reserveDelivery: async () => ({
      reserved: true as const,
      key: `${archive.campaignRecordKey}:delivery-intent`,
    }),
    send: async () => undefined,
    recordOutcome: async () => `${archive.runPath}/delivery-accepted.json`,
    ...overrides,
  };
}

test("preview archives the exact story but cannot resolve or send email", async () => {
  let recipientCalls = 0;
  let sendCalls = 0;
  const result = await runDailyCampaign(
    { mode: "preview", iteration: 1, requestOrigin: "https://preview.example" },
    dependencies({
      resolveRecipient: async () => {
        recipientCalls += 1;
        return recipient;
      },
      send: async () => {
        sendCalls += 1;
      },
    }),
  );
  assert.equal(result.status, "preview-ready");
  assert.equal(recipientCalls, 0);
  assert.equal(sendCalls, 0);
});

test("an existing delivery intent suppresses a duplicate Hostinger send", async () => {
  let sendCalls = 0;
  const result = await runDailyCampaign(
    { mode: "test", iteration: 1, requestOrigin: "https://preview.example" },
    dependencies({
      reserveDelivery: async () => ({
        reserved: false as const,
        key: `${archive.campaignRecordKey}:delivery-intent`,
      }),
      send: async () => {
        sendCalls += 1;
      },
    }),
  );
  assert.equal(result.status, "duplicate-suppressed");
  assert.equal(sendCalls, 0);
});

test("a test run sends only after reservation and records provider acceptance", async () => {
  const events: string[] = [];
  const result = await runDailyCampaign(
    { mode: "test", iteration: 2, requestOrigin: "https://preview.example" },
    dependencies({
      reserveDelivery: async () => {
        events.push("reserved");
        return {
          reserved: true as const,
          key: `${archive.campaignRecordKey}:delivery-intent`,
        };
      },
      send: async ({ to }: { to: string }) => {
        events.push(`sent:${to}`);
      },
      recordOutcome: async ({ state }: { state: string }) => {
        events.push(`recorded:${state}`);
        return `${archive.runPath}/delivery-accepted.json`;
      },
    }),
  );
  assert.equal(result.status, "accepted");
  assert.deepEqual(events, [
    "reserved",
    "sent:owner@example.com",
    "recorded:accepted",
  ]);
});
