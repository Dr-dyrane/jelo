import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { dailyCampaignEmail } from "@/lib/campaigns/campaign-email";
import { selectDailyCampaign } from "@/lib/campaigns/daily-campaign";

const root = process.cwd();

test("a fixed current snapshot produces one dossier-bound deterministic draft", async () => {
  const result = await selectDailyCampaign({
    now: new Date("2026-08-15T07:02:00Z"),
  });
  assert.equal(result.status, "selected");
  if (result.status !== "selected") return;

  const { draft } = result;
  assert.equal(draft.campaignKind, "market-plus-editorial");
  if (draft.campaignKind !== "market-plus-editorial") return;
  assert.match(draft.campaignId, /^2026-08-15-[a-z0-9-]+-price-/);
  assert.equal(draft.product.brand, "Advanced Clinicals");
  assert.notEqual(draft.product.brand, "DANG! Lifestyle");
  assert.ok(draft.selection.catalogueProductCount >= 150);
  assert.ok(draft.selection.freshPriceCandidateCount > 1);
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

test("the reminder email presents one complete responsive Daily Three packet", async () => {
  const result = await selectDailyCampaign({
    now: new Date("2026-08-15T07:02:00Z"),
  });
  assert.equal(result.status, "selected");
  if (result.status !== "selected") return;
  assert.equal(result.draft.campaignKind, "market-plus-editorial");
  if (result.draft.campaignKind !== "market-plus-editorial") return;

  const email = dailyCampaignEmail({
    mode: "test",
    draft: result.draft,
    archive: {
      mode: "test",
      runPath: "campaigns/tests/2026-08-13/run/v1",
      image: {
        role: "proof",
        path: "campaigns/tests/2026-08-13/run/v1/proof.png",
        url: "https://blob.example/proof.png",
        downloadUrl: "https://blob.example/proof.png?download=1",
        sha256: "a".repeat(64),
        width: 1080,
        height: 1920,
      },
      packetImages: [
        {
          role: "proof",
          path: "campaigns/tests/2026-08-13/run/v1/proof.png",
          url: "https://blob.example/proof.png",
          downloadUrl: "https://blob.example/proof.png?download=1",
          sha256: "a".repeat(64),
          width: 1080,
          height: 1920,
        },
        {
          role: "use",
          path: "campaigns/tests/2026-08-13/run/v1/use.png",
          url: "https://blob.example/use.png",
          downloadUrl: "https://blob.example/use.png?download=1",
          sha256: "b".repeat(64),
          width: 1080,
          height: 1920,
        },
        {
          role: "remember",
          path: "campaigns/tests/2026-08-13/run/v1/remember.png",
          url: "https://blob.example/remember.png",
          downloadUrl: "https://blob.example/remember.png?download=1",
          sha256: "c".repeat(64),
          width: 1080,
          height: 1920,
        },
      ],
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
  assert.equal(
    email.subject,
    "[TEST] Today’s JeloCare packet · Market, Useful, Relatable",
  );
  assert.match(email.html, /^<!doctype html>/);
  assert.match(email.html, /<html lang="en">/);
  assert.match(email.html, /name="viewport"/);
  assert.match(email.html, /name="color-scheme" content="light dark"/);
  assert.match(email.html, /@media \(prefers-color-scheme: dark\)/);
  assert.match(email.html, /@media only screen and \(max-width: 480px\)/);
  assert.match(email.html, /role="presentation"/);
  assert.match(email.html, /width="620"/);
  assert.equal(email.html.match(/01 \/ Market/g)?.length, 1);
  assert.equal(email.html.match(/02 \/ Useful/g)?.length, 1);
  assert.equal(email.html.match(/03 \/ Relatable/g)?.length, 1);
  assert.equal(email.html.match(/width="504" height="896"/g)?.length, 3);
  assert.equal(email.html.match(/object-fit:contain/g)?.length, 3);
  assert.equal(email.html.match(/>Download story</g)?.length, 3);
  assert.equal(email.html.match(/class="secondary-action"/g)?.length, 3);
  assert.match(
    email.html,
    /Three JeloCare drafts are ready to review\. Nothing has been published\./,
  );
  assert.match(email.html, /Draft packet · Review before posting\./);
  assert.match(email.text, /01 Market[\s\S]*02 Useful[\s\S]*03 Relatable/);
  assert.equal(email.text.match(/Download story:/g)?.length, 3);
  assert.equal(email.text.match(/https:\/\/www\.jelocare\.com/g) != null, true);
  assert.doesNotMatch(email.html, /tracking|pixel|email\.opened|utm_/i);
  assert.doesNotMatch(email.html, /@font-face|fonts\.googleapis/i);
  assert.ok(Buffer.byteLength(email.html, "utf8") < 80_000);
});

test("the Daily Three email escapes campaign copy and rejects unsafe URLs", async () => {
  const result = await selectDailyCampaign({
    now: new Date("2026-08-15T07:02:00Z"),
  });
  assert.equal(result.status, "selected");
  if (result.status !== "selected") return;
  assert.equal(result.draft.campaignKind, "market-plus-editorial");
  if (result.draft.campaignKind !== "market-plus-editorial") return;

  const archive = {
    mode: "test" as const,
    runPath: "campaigns/tests/2026-08-13/run/v1",
    image: {
      role: "proof" as const,
      path: "campaigns/tests/2026-08-13/run/v1/proof.png",
      url: "https://blob.example/proof.png",
      downloadUrl: "https://blob.example/proof.png?download=1",
      sha256: "a".repeat(64),
      width: 1080 as const,
      height: 1920 as const,
    },
    packetImages: [
      {
        role: "proof" as const,
        path: "campaigns/tests/2026-08-13/run/v1/proof.png",
        url: "https://blob.example/proof.png",
        downloadUrl: "https://blob.example/proof.png?download=1",
        sha256: "a".repeat(64),
        width: 1080 as const,
        height: 1920 as const,
      },
      {
        role: "use" as const,
        path: "campaigns/tests/2026-08-13/run/v1/use.png",
        url: "https://blob.example/use.png",
        downloadUrl: "https://blob.example/use.png?download=1",
        sha256: "b".repeat(64),
        width: 1080 as const,
        height: 1920 as const,
      },
      {
        role: "remember" as const,
        path: "campaigns/tests/2026-08-13/run/v1/remember.png",
        url: "https://blob.example/remember.png",
        downloadUrl: "https://blob.example/remember.png?download=1",
        sha256: "c".repeat(64),
        width: 1080 as const,
        height: 1920 as const,
      },
    ] as const,
    campaignRecordKey: "jelocare:campaigns:v1:test:run:v1:campaign",
    checksumKey: "jelocare:campaigns:v1:test:run:v1:checksum",
  };
  const recipient = {
    kind: "test" as const,
    email: "owner@example.com",
    displayName: "Jelo <Admin>",
    record: { kind: "test" as const, recipientKey: "d".repeat(64) },
  };
  const draft = {
    ...result.draft,
    creativePlan: {
      ...result.draft.creativePlan,
      packet: [
        {
          ...result.draft.creativePlan.packet[0],
          pillar: {
            ...result.draft.creativePlan.packet[0].pillar,
            headline: '<script>alert("headline")</script>',
            body: "PRODUCT & <unsafe>",
            caption: "Compare <now> & review.",
          },
        },
        result.draft.creativePlan.packet[1],
        result.draft.creativePlan.packet[2],
      ] as typeof result.draft.creativePlan.packet,
    },
  };
  const email = dailyCampaignEmail({
    mode: "test",
    draft,
    archive,
    recipient,
  });
  assert.doesNotMatch(email.html, /<script>|<unsafe>|<now>|<Admin>/);
  assert.match(email.html, /&lt;script&gt;alert\(&quot;headline&quot;\)/);
  assert.match(email.html, /PRODUCT &amp; &lt;unsafe&gt;/);
  assert.match(email.html, /Jelo &lt;Admin&gt;/);

  assert.throws(
    () =>
      dailyCampaignEmail({
        mode: "test",
        draft: { ...draft, actionUrl: "https://evil.example/share/product" },
        archive,
        recipient,
      }),
    /campaign_email_action_url_invalid/,
  );
  assert.throws(
    () =>
      dailyCampaignEmail({
        mode: "test",
        draft: result.draft,
        archive: {
          ...archive,
          packetImages: [
            archive.packetImages[0],
            { ...archive.packetImages[1], url: "http://blob.example/use.png" },
            archive.packetImages[2],
          ],
        },
        recipient,
      }),
    /campaign_email_image_url_invalid/,
  );
  assert.throws(
    () =>
      dailyCampaignEmail({
        mode: "test",
        draft: result.draft,
        archive: {
          ...archive,
          packetImages: [
            archive.packetImages[0],
            archive.packetImages[2],
            archive.packetImages[1],
          ] as unknown as typeof archive.packetImages,
        },
        recipient,
      }),
    /campaign_email_packet_roles_invalid/,
  );
  assert.throws(
    () =>
      dailyCampaignEmail({
        mode: "test",
        draft: result.draft,
        archive: {
          ...archive,
          packetImages: [
            archive.packetImages[0],
            {
              ...archive.packetImages[1],
              downloadUrl:
                "https://blob.example/use.png?download=1&utm_source=email",
            },
            archive.packetImages[2],
          ],
        },
        recipient,
      }),
    /campaign_email_download_url_invalid/,
  );
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
  assert.match(archive, /dailyDeskEligible !== false/);
  assert.match(archive, /allowOverwrite: false/);
  assert.match(archive, /delivery-intent/);
  assert.match(archive, /delivery-accepted/);
  assert.doesNotMatch(archive, /emailSha256|access: "private"/);
  assert.match(recipient, /from moderation_operators/);
  assert.match(recipient, /where active = true/);
  assert.match(recipient, /CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON/);
  assert.match(recipient, /parsed\.length !== 3/);
  assert.match(recipient, /email in \$\{sql\(\[\.\.\.normalizedEmails\]\)\}/);
  assert.doesNotMatch(
    `${route}\n${archive}\n${recipient}`,
    /halodyrane@gmail\.com|umehangelachioma@gmail\.com/,
  );
  assert.match(envTemplate, /^CAMPAIGN_DAILY_ENABLED=false$/m);
  assert.match(envTemplate, /^CAMPAIGN_TEST_EMAIL=$/m);
  assert.match(envTemplate, /^CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON=\[\]$/m);

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
