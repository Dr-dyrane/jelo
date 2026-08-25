import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignDeliveryIntentKey,
  campaignDeliveryOutcomeKey,
  type ArchivedCampaignImage,
  type ArchivedCampaignPacket,
} from "@/lib/campaigns/campaign-archive";
import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";
import { runDailyCampaign } from "@/lib/campaigns/daily-campaign-runner";
import type {
  CampaignPacketRole,
  RenderedCampaignPacket,
  RenderedCampaignStory,
} from "@/lib/campaigns/campaign-render";

const now = new Date("2026-08-13T07:00:00Z");

const draft: DailyCampaignDraft = {
  schemaVersion: 1,
  campaignKind: "market-plus-editorial",
  dailyDeskEligible: true,
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
    catalogueProductCount: 157,
    freshPriceCandidateCount: 24,
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
    packet: [
      {
        role: "proof",
        renderKind: "product-story",
        renderPath: "/share/exact-product/story?kind=price&campaignRole=proof",
        pillar: {
          role: "proof",
          kind: "market",
          label: "Market",
          eyebrow: "Today’s market check",
          headline: "Same product.",
          body: "Exact current listing evidence.",
          action: "Compare current prices",
          actionUrl: "https://www.jelocare.com/share/exact-product",
          caption: "Compare current prices.",
          footerNote: "Exact product. Fresh listings.",
          evidenceNote: "Fresh exact evidence.",
        },
      },
      {
        role: "use",
        renderKind: "review-pillar",
        renderPath: "/share/exact-product/story?kind=price&campaignRole=use",
        pillar: {
          role: "use",
          kind: "useful",
          label: "Useful",
          eyebrow: "One retailer",
          headline: "Build one exact basket.",
          body: "Choose products and compare retailers.",
          action: "Build a basket",
          actionUrl: "https://www.jelocare.com/bundle",
          caption: "Build one basket.",
          footerNote: "Choose one exact basket.",
          evidenceNote: "Service guidance only.",
        },
      },
      {
        role: "remember",
        renderKind: "review-pillar",
        renderPath:
          "/share/exact-product/story?kind=price&campaignRole=remember",
        pillar: {
          role: "remember",
          kind: "relatable",
          label: "Relatable",
          eyebrow: "Small skincare truth",
          headline: "Same bottle. Different price.",
          body: "Naturally, we checked.",
          action: "Open JeloCare",
          actionUrl: "https://www.jelocare.com",
          caption: "Same bottle. Different price.",
          footerNote: "Fewer tabs. Clearer choices.",
          evidenceNote: "No product or health claim.",
        },
      },
    ],
  },
  channels: ["whatsapp-status", "instagram-stories", "snapchat"],
  actionUrl: "https://www.jelocare.com/share/exact-product",
  publication: [],
};

function renderedStory<Role extends CampaignPacketRole>(
  role: Role,
  digest: string,
): RenderedCampaignStory<Role> {
  return {
    role,
    bytes: Buffer.from(`png-${role}`),
    sha256: digest.repeat(64),
    width: 1080 as const,
    height: 1920 as const,
    contentType: "image/png" as const,
    sourceAssetVerified: true as const,
    renderUrl: `https://preview.example/share/exact-product/story?kind=price&campaignRole=${role}`,
  };
}

const rendered: RenderedCampaignPacket = [
  renderedStory("proof", "d"),
  renderedStory("use", "f"),
  renderedStory("remember", "a"),
] as const;

function archivedImage<Role extends CampaignPacketRole>(
  story: RenderedCampaignStory<Role>,
): ArchivedCampaignImage<Role> {
  return {
    role: story.role,
    path: `campaigns/tests/2026-08-13/run/v1/${story.role}.png`,
    url: `https://blob.example/${story.role}.png`,
    downloadUrl: `https://blob.example/${story.role}.png?download=1`,
    sha256: story.sha256,
    width: 1080 as const,
    height: 1920 as const,
  };
}

const packetImages: ArchivedCampaignPacket = [
  archivedImage(rendered[0]),
  archivedImage(rendered[1]),
  archivedImage(rendered[2]),
];

const archive = {
  mode: "test" as const,
  runPath: "campaigns/tests/2026-08-13/run/v1",
  image: packetImages[0],
  packetImages,
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

const operatorRecipients = ["a", "b", "c"].map((key, index) => ({
  kind: "operator" as const,
  email: `operator-${index + 1}@example.com`,
  displayName: `Operator ${index + 1}`,
  record: {
    kind: "operator" as const,
    recipientKey: key.repeat(64),
  },
}));

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
    campaignDeliveryIntentKey(first, operatorRecipients[0]!.record),
    campaignDeliveryIntentKey(nextCandidate, operatorRecipients[0]!.record),
  );
  assert.notEqual(
    campaignDeliveryIntentKey(first, operatorRecipients[0]!.record),
    campaignDeliveryIntentKey(tomorrow, operatorRecipients[0]!.record),
  );
  assert.notEqual(
    campaignDeliveryIntentKey(first, operatorRecipients[0]!.record),
    campaignDeliveryIntentKey(first, operatorRecipients[1]!.record),
  );
  assert.match(
    campaignDeliveryIntentKey(archive, recipient.record),
    new RegExp(`^${archive.campaignRecordKey}:delivery-intent:[0-9a-f]{64}$`),
  );
  assert.match(
    campaignDeliveryOutcomeKey(archive, "accepted", recipient.record),
    new RegExp(`^${archive.campaignRecordKey}:delivery-accepted:[0-9a-f]{64}$`),
  );
  assert.notEqual(
    campaignDeliveryOutcomeKey(
      archive,
      "accepted",
      operatorRecipients[0]!.record,
    ),
    campaignDeliveryOutcomeKey(
      archive,
      "accepted",
      operatorRecipients[1]!.record,
    ),
  );
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    now: () => now,
    recentSlugs: async () => new Set<string>(),
    recentBrands: async () => new Set<string>(),
    select: async () => ({ status: "selected" as const, draft }),
    render: async () => rendered,
    archive: async () => archive,
    resolveRecipients: async () => [recipient],
    reserveDelivery: async () => ({
      reserved: true as const,
      key: `${archive.campaignRecordKey}:delivery-intent`,
    }),
    send: async () => undefined,
    recordOutcome: async () => `${archive.runPath}/delivery-accepted.json`,
    alertNoCandidate: async () => undefined,
    ...overrides,
  };
}

test("a retry after a failed delivery reuses the existing archive and resumes unsent recipients", async () => {
  let archiveCalls = 0;
  const sent: string[] = [];

  // First run: archive succeeds, delivery fails for one recipient
  await assert.rejects(
    runDailyCampaign(
      {
        mode: "production",
        iteration: 1,
        requestOrigin: "https://www.jelocare.com",
      },
      dependencies({
        resolveRecipients: async () => operatorRecipients,
        archive: async () => {
          archiveCalls += 1;
          return archive;
        },
        send: async ({ to }: { to: string }) => {
          sent.push(to);
          if (to === "operator-2@example.com") {
            throw new Error("provider-temporarily-unavailable");
          }
        },
      }),
    ),
    /campaign_delivery_batch_failed_1_of_3/,
  );

  // Second run (retry): archive is called again (idempotent at the archive
  // level — returns existing record instead of throwing), delivery resumes
  // for the previously-failed recipient without resending the accepted one.
  const retryResult = await runDailyCampaign(
    {
      mode: "production",
      iteration: 1,
      requestOrigin: "https://www.jelocare.com",
    },
    dependencies({
      resolveRecipients: async () => operatorRecipients,
      archive: async () => {
        archiveCalls += 1;
        return archive;
      },
      reserveDelivery: async ({
        recipient: record,
      }: {
        recipient: { recipientKey: string };
      }) => ({
        reserved:
          record.recipientKey !== operatorRecipients[0]!.record.recipientKey,
        key: `${archive.campaignRecordKey}:delivery-intent:${record.recipientKey}`,
      }),
      send: async ({ to }: { to: string }) => {
        sent.push(to);
      },
    }),
  );

  assert.equal(retryResult.status, "accepted");
  assert.equal(archiveCalls, 2);
  assert.deepEqual(sent, [
    "operator-1@example.com",
    "operator-2@example.com",
    "operator-3@example.com",
    "operator-2@example.com",
    "operator-3@example.com",
  ]);
});

test("preview archives the exact story but cannot resolve or send email", async () => {
  let recipientCalls = 0;
  let sendCalls = 0;
  const result = await runDailyCampaign(
    { mode: "preview", iteration: 1, requestOrigin: "https://preview.example" },
    dependencies({
      resolveRecipients: async () => {
        recipientCalls += 1;
        return [recipient];
      },
      send: async () => {
        sendCalls += 1;
      },
    }),
  );
  assert.equal(result.status, "preview-ready");
  if (result.status === "preview-ready") {
    assert.deepEqual(
      result.packetImages.map((image) => image.role),
      ["proof", "use", "remember"],
    );
    assert.equal(result.image, result.packetImages[0]);
  }
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
  if (result.status === "duplicate-suppressed") {
    assert.deepEqual(result.delivery, {
      recipientCount: 1,
      recipientKinds: ["test"],
      acceptedCount: 0,
      duplicateSuppressedCount: 1,
      failedCount: 0,
    });
  }
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
  if (result.status === "accepted") {
    assert.deepEqual(result.delivery, {
      recipientCount: 1,
      recipientKinds: ["test"],
      acceptedCount: 1,
      duplicateSuppressedCount: 0,
      failedCount: 0,
    });
  }
  assert.deepEqual(events, [
    "reserved",
    "sent:owner@example.com",
    "recorded:accepted",
  ]);
});

test("production attempts all three private recipients and fails after sibling outcomes", async () => {
  const sent: string[] = [];
  const outcomes: Array<{
    recipientKey: string;
    state: string;
    errorCode?: string;
  }> = [];

  await assert.rejects(
    runDailyCampaign(
      {
        mode: "production",
        iteration: 1,
        requestOrigin: "https://www.jelocare.com",
      },
      dependencies({
        resolveRecipients: async () => operatorRecipients,
        send: async ({ to }: { to: string }) => {
          sent.push(to);
          if (to === "operator-2@example.com") {
            throw new Error("provider-temporarily-unavailable");
          }
        },
        recordOutcome: async ({
          recipient: record,
          state,
          errorCode,
        }: {
          recipient: { recipientKey: string };
          state: string;
          errorCode?: string;
        }) => {
          outcomes.push({
            recipientKey: record.recipientKey,
            state,
            errorCode,
          });
          return `${archive.runPath}/delivery-${state}.json`;
        },
      }),
    ),
    /campaign_delivery_batch_failed_1_of_3/,
  );

  assert.deepEqual(sent, [
    "operator-1@example.com",
    "operator-2@example.com",
    "operator-3@example.com",
  ]);
  assert.deepEqual(
    outcomes.map((outcome) => outcome.state),
    ["accepted", "failed", "accepted"],
  );
  assert.equal(
    new Set(outcomes.map((outcome) => outcome.recipientKey)).size,
    3,
  );
  assert.equal(outcomes[1]?.errorCode, "campaign_email_send_failed");
  assert.equal(outcomes[0]?.errorCode, undefined);
  assert.equal(outcomes[2]?.errorCode, undefined);
});

test("production resumes unsent siblings without resending a reserved recipient", async () => {
  const sent: string[] = [];
  const result = await runDailyCampaign(
    {
      mode: "production",
      iteration: 1,
      requestOrigin: "https://www.jelocare.com",
    },
    dependencies({
      resolveRecipients: async () => operatorRecipients,
      reserveDelivery: async ({
        recipient: record,
      }: {
        recipient: { recipientKey: string };
      }) => ({
        reserved:
          record.recipientKey !== operatorRecipients[0]!.record.recipientKey,
        key: `${archive.campaignRecordKey}:delivery-intent:${record.recipientKey}`,
      }),
      send: async ({ to }: { to: string }) => {
        sent.push(to);
      },
    }),
  );

  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.deepEqual(sent, ["operator-2@example.com", "operator-3@example.com"]);
  assert.deepEqual(result.delivery, {
    recipientCount: 3,
    recipientKinds: ["operator"],
    acceptedCount: 2,
    duplicateSuppressedCount: 1,
    failedCount: 0,
  });
});

test("no-candidate triggers the alert with rejection details", async () => {
  let alertCalls = 0;
  let alertCheckedAt: string | null = null;
  let alertCount: number | null = null;

  const result = await runDailyCampaign(
    {
      mode: "production",
      iteration: 1,
      requestOrigin: "https://www.jelocare.com",
    },
    dependencies({
      select: async () => ({
        status: "no-candidate" as const,
        checkedAt: "2026-08-17T07:01:00.000Z",
        rejectedCandidates: [
          { slug: "product-a", blocker: "sent-within-14-day-cooldown" },
          { slug: "product-b", blocker: "live-product-dossier-identity-drift" },
        ],
      }),
      alertNoCandidate: async (
        checkedAt: string,
        rejected: readonly { slug: string; blocker: string }[],
      ) => {
        alertCalls += 1;
        alertCheckedAt = checkedAt;
        alertCount = rejected.length;
      },
    }),
  );

  assert.equal(result.status, "no-candidate");
  assert.equal(alertCalls, 1);
  assert.equal(alertCheckedAt, "2026-08-17T07:01:00.000Z");
  assert.equal(alertCount, 2);
});

test("no-candidate does not resolve recipient or send email", async () => {
  let recipientCalls = 0;
  let sendCalls = 0;

  const result = await runDailyCampaign(
    {
      mode: "production",
      iteration: 1,
      requestOrigin: "https://www.jelocare.com",
    },
    dependencies({
      select: async () => ({
        status: "no-candidate" as const,
        checkedAt: "2026-08-17T07:01:00.000Z",
        rejectedCandidates: [
          { slug: "product-a", blocker: "sent-within-14-day-cooldown" },
        ],
      }),
      resolveRecipients: async () => {
        recipientCalls += 1;
        return [recipient];
      },
      send: async () => {
        sendCalls += 1;
      },
    }),
  );

  assert.equal(result.status, "no-candidate");
  assert.equal(recipientCalls, 0);
  assert.equal(sendCalls, 0);
});

test("brand cooldown passes recent brands to selection so the same brand cannot dominate consecutive days", async () => {
  let receivedBrands: ReadonlySet<string> | null = null;
  let receivedSlugs: ReadonlySet<string> | null = null;

  await runDailyCampaign(
    {
      mode: "preview",
      iteration: 1,
      requestOrigin: "https://www.jelocare.com",
    },
    dependencies({
      recentSlugs: async () => new Set<string>(["old-slug"]),
      recentBrands: async () => new Set<string>(["DANG! Lifestyle", "COSRX"]),
      select: async (input: {
        recentProductSlugs: ReadonlySet<string>;
        recentBrands: ReadonlySet<string>;
      }) => {
        receivedSlugs = input.recentProductSlugs;
        receivedBrands = input.recentBrands;
        return { status: "selected" as const, draft };
      },
    }),
  );

  assert.ok(receivedSlugs !== null, "recentProductSlugs was not passed");
  assert.ok(receivedBrands !== null, "recentBrands was not passed");
  assert.ok(
    (receivedSlugs as Set<string>).has("old-slug"),
    "recentProductSlugs should contain old-slug",
  );
  assert.ok(
    (receivedBrands as Set<string>).has("DANG! Lifestyle"),
    "recentBrands should contain DANG! Lifestyle",
  );
  assert.ok(
    (receivedBrands as Set<string>).has("COSRX"),
    "recentBrands should contain COSRX",
  );
});
