import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { ArchivedCampaign } from "@/lib/campaigns/campaign-archive";
import type {
  DailyCampaignDraft,
  DailyCampaignSelection,
} from "@/lib/campaigns/daily-campaign";
import {
  reconcileDailyDesk,
  type DailyDeskReconciliationDependencies,
} from "@/lib/campaigns/daily-desk-reconciliation";

const now = new Date("2026-09-04T13:42:00.000Z");

const marketDraft = {
  campaignId: "2026-09-04-exact-product-price-context",
  dataCheckedAt: now.toISOString(),
  dailyDeskEligible: true,
  selection: { rejectedCandidates: [] },
} as unknown as DailyCampaignDraft;

const marketSelection: DailyCampaignSelection = {
  status: "selected",
  draft: marketDraft,
};

const archive = {
  mode: "production",
  dailyDeskEligible: true,
  runPath: "campaigns/daily/2026-09-04/exact-product-price-context/v1",
  campaignRecordKey:
    "jelocare:campaigns:v1:production:exact-product-price-context:v1:campaign",
} as ArchivedCampaign;

function dependencies(
  overrides: Partial<DailyDeskReconciliationDependencies>,
): DailyDeskReconciliationDependencies {
  return {
    now: () => now,
    readAcceptedRecordKey: async () => null,
    select: async () => marketSelection,
    render: async () => undefined as never,
    archive: async () => archive,
    accept: async () => ({
      accepted: true,
      campaignRecordKey: archive.campaignRecordKey,
    }),
    ...overrides,
  } as DailyDeskReconciliationDependencies;
}

test("an email-only fallback cannot starve a later qualified Daily Desk", async () => {
  let selectedProductCooldownCount: number | null = null;
  let selectedBrandCooldownCount: number | null = null;
  let archived = false;
  const result = await reconcileDailyDesk(
    { requestOrigin: "https://www.jelocare.com" },
    dependencies({
      select: async (input) => {
        selectedProductCooldownCount = input.recentProductSlugs?.size ?? null;
        selectedBrandCooldownCount = input.recentBrands?.size ?? null;
        return marketSelection;
      },
      archive: async () => {
        archived = true;
        return archive;
      },
    }),
  );

  assert.deepEqual(result, {
    status: "accepted",
    date: "2026-09-04",
    campaignId: marketDraft.campaignId,
    campaignRecordKey: archive.campaignRecordKey,
    dataCheckedAt: now.toISOString(),
  });
  assert.equal(archived, true);
  assert.equal(selectedProductCooldownCount, 0);
  assert.equal(selectedBrandCooldownCount, 0);
});

test("an accepted Desk stays immutable and skips selection, rendering, and archive work", async () => {
  const result = await reconcileDailyDesk(
    { requestOrigin: "https://www.jelocare.com" },
    dependencies({
      readAcceptedRecordKey: async () => archive.campaignRecordKey,
      select: async () => {
        throw new Error("selection should not run");
      },
      render: async () => {
        throw new Error("render should not run");
      },
      archive: async () => {
        throw new Error("archive should not run");
      },
    }),
  );

  assert.deepEqual(result, {
    status: "already-accepted",
    date: "2026-09-04",
    campaignRecordKey: archive.campaignRecordKey,
  });
});

test("an editorial fallback cannot become a Daily Desk record", async () => {
  const fallbackSelection: DailyCampaignSelection = {
    status: "selected",
    draft: {
      campaignId: "2026-09-04-editorial-review-packet",
      dataCheckedAt: now.toISOString(),
      dailyDeskEligible: false,
      selection: {
        rejectedCandidates: [
          { slug: "exact-product", blocker: "no-fresh-shareable-ng-offer" },
        ],
      },
    } as unknown as DailyCampaignDraft,
  };
  const result = await reconcileDailyDesk(
    { requestOrigin: "https://www.jelocare.com" },
    dependencies({
      select: async () => fallbackSelection,
      render: async () => {
        throw new Error("editorial fallback must not render for the Desk");
      },
    }),
  );

  assert.deepEqual(result, {
    status: "no-candidate",
    date: "2026-09-04",
    checkedAt: now.toISOString(),
    rejectedCandidateCount: 1,
  });
});

test("the reconciliation path has no recipient, email, or delivery dependency", async () => {
  const [source, route, vercel] = await Promise.all([
    readFile(
      path.join(process.cwd(), "lib/campaigns/daily-desk-reconciliation.ts"),
      "utf8",
    ),
    readFile(
      path.join(process.cwd(), "app/api/cron/daily-desk-reconcile/route.ts"),
      "utf8",
    ),
    readFile(path.join(process.cwd(), "vercel.json"), "utf8"),
  ]);
  assert.doesNotMatch(
    `${source}\n${route}`,
    /resolveCampaignRecipients|sendAlertEmail|reserveCampaignDelivery|dailyCampaignEmail/,
  );
  assert.match(route, /isAuthorizedCronRequest/);
  assert.match(route, /dailyDeskReconciliationEnabled\(\)/);
  assert.match(route, /revalidatePath\("\/lagos"\)/);
  assert.deepEqual(
    (
      JSON.parse(vercel) as { crons: Array<{ path: string; schedule: string }> }
    ).crons.find((cron) => cron.path === "/api/cron/daily-desk-reconcile"),
    { path: "/api/cron/daily-desk-reconcile", schedule: "42 * * * *" },
  );
});
