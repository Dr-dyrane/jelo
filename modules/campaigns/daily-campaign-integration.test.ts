import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { dailyCampaignEmail } from "@/lib/campaigns/campaign-email";
import { selectDailyCampaign } from "@/lib/campaigns/daily-campaign";

const root = process.cwd();

test("a fixed current snapshot produces one dossier-bound deterministic draft", async () => {
  const result = await selectDailyCampaign({
    now: new Date("2026-08-13T07:00:00Z"),
  });
  assert.equal(result.status, "selected");
  if (result.status !== "selected") return;

  const { draft } = result;
  assert.match(draft.campaignId, /^2026-08-13-[a-z0-9-]+-price-/);
  assert.ok(draft.offerEvidence.length > 0);
  assert.ok(draft.offerEvidence.every((offer) => offer.priceNgn > 0));
  assert.ok(
    draft.offerEvidence.every((offer) =>
      offer.listingUrl.startsWith("https://"),
    ),
  );
  assert.equal(draft.creativePlan.width, 1080);
  assert.equal(draft.creativePlan.height, 1920);
  assert.equal(draft.creativePlan.mode, "dark");
  assert.equal(
    draft.creativePlan.generationRoute,
    "deterministic-next-og-story",
  );
  assert.match(draft.sourceAsset.sha256, /^[0-9a-f]{64}$/);
  assert.match(draft.publicationEvidence.dossierFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(draft.publication.length, 0);
  assert.match(draft.copy.caption, /^[\s\S]{20,240}$/);
});

test("the reminder email presents one minimal draft without tracking", async () => {
  const result = await selectDailyCampaign({
    now: new Date("2026-08-13T07:00:00Z"),
  });
  assert.equal(result.status, "selected");
  if (result.status !== "selected") return;

  const email = dailyCampaignEmail({
    mode: "test",
    draft: result.draft,
    archive: {
      mode: "test",
      runPath: "campaigns/tests/2026-08-13/run/v1",
      image: {
        path: "campaigns/tests/2026-08-13/run/v1/story.png",
        url: "https://blob.example/story.png",
        downloadUrl: "https://blob.example/story.png?download=1",
        sha256: "a".repeat(64),
        width: 1080,
        height: 1920,
      },
      campaignRecordKey: "jelocare:campaigns:v1:test:run:v1:campaign",
      checksumKey: "jelocare:campaigns:v1:test:run:v1:checksum",
    },
    recipient: {
      kind: "test",
      email: "owner@example.com",
      displayName: null,
      record: {
        kind: "test",
        recipientKey: "b".repeat(64),
      },
    },
  });
  assert.match(email.subject, /^\[TEST\] Today’s JeloCare campaign/);
  assert.match(email.html, /width="620"/);
  assert.match(email.html, /Download story/);
  assert.match(
    email.html,
    /Draft only\. Nothing has been posted or published\./,
  );
  assert.doesNotMatch(email.html, /tracking|pixel|email\.opened|utm_/i);
});

test("the protected cron and immutable archive preserve activation boundaries", async () => {
  const [route, archive, recipient, envTemplate, vercel] = await Promise.all([
    readFile(path.join(root, "app/api/cron/daily-campaign/route.ts"), "utf8"),
    readFile(path.join(root, "lib/campaigns/campaign-archive.ts"), "utf8"),
    readFile(path.join(root, "lib/campaigns/campaign-recipient.ts"), "utf8"),
    readFile(path.join(root, ".env.example"), "utf8"),
    readFile(path.join(root, "vercel.json"), "utf8"),
  ]);

  assert.match(route, /isAuthorizedCronRequest/);
  assert.match(route, /runMode === "production" && !campaignDailyEnabled\(\)/);
  assert.match(route, /requestedMode !== "preview"/);
  assert.match(route, /requestedMode !== "test"/);
  assert.match(
    route,
    /process\.env\.VERCEL_ENV[\s\S]*https:\/\/www\.jelocare\.com/,
  );
  assert.match(archive, /access: "public"/);
  assert.match(archive, /new Redis/);
  assert.match(archive, /\{ nx: true \}/);
  assert.match(archive, /acceptedProductionIndex/);
  assert.match(archive, /allowOverwrite: false/);
  assert.match(archive, /delivery-intent/);
  assert.match(archive, /delivery-accepted/);
  assert.doesNotMatch(archive, /emailSha256|access: "private"/);
  assert.match(recipient, /from moderation_operators/);
  assert.match(recipient, /where active = true/);
  assert.match(recipient, /email = \$\{configuredEmail\}/);
  assert.doesNotMatch(
    `${route}\n${archive}\n${recipient}`,
    /halodyrane@gmail\.com|umehangelachioma@gmail\.com/,
  );
  assert.match(envTemplate, /^CAMPAIGN_DAILY_ENABLED=false$/m);
  assert.match(envTemplate, /^CAMPAIGN_TEST_EMAIL=$/m);
  assert.match(envTemplate, /^CAMPAIGN_DAILY_OPERATOR_EMAIL=$/m);

  const configuration = JSON.parse(vercel) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.deepEqual(
    configuration.crons.find(
      (cron) => cron.path === "/api/cron/daily-campaign",
    ),
    { path: "/api/cron/daily-campaign", schedule: "0 7 * * *" },
  );
});
