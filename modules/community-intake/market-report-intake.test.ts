import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  lockResolvedMarketReportContext,
  MarketReportContextUnavailableError,
  marketReportContextLockMatches,
} from "@/lib/community-intake/market-report-context";
import {
  createDraftRequestSchema,
  emptyContributionDraft,
  finalContributionSchema,
  marketReportContributionDraft,
  saveDraftRequestSchema,
} from "@/lib/community-intake/schema";
import {
  isMarketFinderReportIntakeEnabled,
  MarketFinderReportIntakeUnavailableError,
  requireMarketFinderReportIntakeEnabled,
} from "@/lib/markets/activation";

const ids = {
  market: "11111111-1111-4111-8111-111111111111",
  identity: "22222222-2222-4222-8222-222222222222",
  location: "33333333-3333-4333-8333-333333333333",
};

const hint = {
  marketSlug: "trade-fair",
  productSlug: "cosrx-aloe-soothing-sun-cream-50ml",
  shopSlug: "reviewed-shop-a43",
};

const resolved = {
  marketId: ids.market,
  marketSlug: hint.marketSlug,
  productIdentityVersionId: ids.identity,
  productSlug: hint.productSlug,
  retailerLocationId: ids.location,
  locationSlug: hint.shopSlug,
};

test("market report creation accepts only a strict slug context", () => {
  assert.equal(
    createDraftRequestSchema.safeParse({
      kind: "market_report",
      context: hint,
      website: "",
    }).success,
    true,
  );
  assert.equal(
    createDraftRequestSchema.safeParse({ kind: "market_report" }).success,
    false,
  );
  assert.equal(
    createDraftRequestSchema.safeParse({
      kind: "market_report",
      context: { ...hint, freeText: "beside the gate" },
    }).success,
    false,
  );
  assert.equal(
    createDraftRequestSchema.safeParse({
      kind: "market_report",
      context: { ...hint, shopSlug: "Shop A43" },
    }).success,
    false,
  );
});

test("market report intake is disabled unless the server-only release flag is exact", () => {
  assert.equal(isMarketFinderReportIntakeEnabled({}), false);
  assert.equal(
    isMarketFinderReportIntakeEnabled({
      MARKET_FINDER_REPORT_INTAKE_ENABLED: "false",
    }),
    false,
  );
  assert.equal(
    isMarketFinderReportIntakeEnabled({
      MARKET_FINDER_REPORT_INTAKE_ENABLED: "true",
    }),
    false,
  );
  assert.equal(
    isMarketFinderReportIntakeEnabled({
      MARKET_FINDER_PUBLIC_READ_ENABLED: "true",
      MARKET_FINDER_PUBLIC_MARKET_SLUG: "trade-fair",
      MARKET_FINDER_REPORT_INTAKE_ENABLED: "true",
    }),
    true,
  );
  assert.doesNotThrow(() =>
    requireMarketFinderReportIntakeEnabled("product", {}),
  );
  assert.throws(
    () => requireMarketFinderReportIntakeEnabled("market_report", {}),
    MarketFinderReportIntakeUnavailableError,
  );
});

test("context locking fails closed when the canonical target is absent or changed", () => {
  assert.throws(
    () => lockResolvedMarketReportContext(hint, null),
    MarketReportContextUnavailableError,
  );
  assert.throws(
    () =>
      lockResolvedMarketReportContext(hint, {
        ...resolved,
        locationSlug: "another-shop",
      }),
    MarketReportContextUnavailableError,
  );
});

test("the locked IDs and slugs cannot change while the fixed outcome can", () => {
  const locked = lockResolvedMarketReportContext(hint, resolved);
  assert.equal(
    marketReportContextLockMatches(locked, {
      ...locked,
      outcome: "found_bought",
    }),
    true,
  );
  assert.equal(
    marketReportContextLockMatches(locked, {
      ...locked,
      retailerLocationId: "44444444-4444-4444-8444-444444444444",
    }),
    false,
  );
  assert.equal(
    marketReportContextLockMatches(locked, {
      ...locked,
      shopSlug: "another-shop",
    }),
    false,
  );
});

test("market report finalization requires one controlled outcome and no general fields", () => {
  const locked = lockResolvedMarketReportContext(hint, resolved);
  const draft = marketReportContributionDraft(locked);
  assert.equal(finalContributionSchema.safeParse(draft).success, false);
  assert.equal(
    finalContributionSchema.safeParse({
      ...draft,
      marketReport: { ...locked, outcome: "shop_exists_no_stock" },
    }).success,
    true,
  );
  assert.equal(
    finalContributionSchema.safeParse({
      ...draft,
      purposes: [{ id: "purpose:other", label: "Other", source: "custom" }],
      marketReport: { ...locked, outcome: "shop_closed" },
    }).success,
    false,
  );
  assert.equal(
    saveDraftRequestSchema.safeParse({
      revision: 0,
      draft: {
        ...draft,
        marketReport: { ...locked, outcome: "location_wrong" },
      },
      events: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          type: "selection_changed",
          step: 1,
          inputMode: "tap",
          resultsCount: null,
        },
      ],
    }).success,
    false,
  );
});

test("standard product, routine and store draft shapes remain available", () => {
  for (const kind of ["product", "routine", "store"] as const) {
    const draft = emptyContributionDraft(kind);
    assert.equal(draft.kind, kind);
    assert.equal("marketReport" in draft, false);
  }
});

test("submission keeps parent, typed child and closure in one transaction without side emitters", async () => {
  const repository = await readFile(
    path.join(process.cwd(), "lib/community-intake/repository.ts"),
    "utf8",
  );
  const submission = repository.slice(
    repository.indexOf("export async function submitCommunityDraft"),
  );
  const parentInsert = repository.indexOf(
    "insert into community_contributions",
  );
  const marketBranch = repository.search(
    /if \(draft\.kind === ["']market_report["']\)/,
  );
  const childInsert = repository.indexOf("insert into market_finder_reports");
  const generalBranch = repository.indexOf("} else {", marketBranch);
  const draftClosure = repository.indexOf(
    "update community_intake_drafts",
    childInsert,
  );

  assert.ok(parentInsert > -1);
  assert.match(
    submission,
    /return sql\.begin\(\s*["']isolation level read committed["'],\s*async/,
  );
  assert.ok(marketBranch > parentInsert);
  assert.ok(childInsert > marketBranch);
  assert.ok(generalBranch > childInsert);
  assert.ok(draftClosure > generalBranch);
  assert.doesNotMatch(
    repository.slice(marketBranch, generalBranch),
    /communityObservations|communityKnowledgeEdges|unknownCommunityValues|communityResearchTasks/,
  );
  assert.match(
    repository,
    /select id from community_contributions where draft_id = \$\{input\.id\}[\s\S]*duplicate: true/,
  );
});

test("the existing draft API owns the contextual create, save and submit flow", async () => {
  const root = process.cwd();
  const createRoute = await readFile(
    path.join(root, "app/api/contribute/drafts/route.ts"),
    "utf8",
  );
  const saveRoute = await readFile(
    path.join(root, "app/api/contribute/drafts/[id]/route.ts"),
    "utf8",
  );
  const submitRoute = await readFile(
    path.join(root, "app/api/contribute/drafts/[id]/submit/route.ts"),
    "utf8",
  );
  const repository = await readFile(
    path.join(root, "lib/community-intake/repository.ts"),
    "utf8",
  );
  const component = await readFile(
    path.join(root, "components/contribute/market-report-prototype.tsx"),
    "utf8",
  );
  const developmentPage = await readFile(
    path.join(root, "app/(site)/contribute/page.tsx"),
    "utf8",
  );

  assert.match(createRoute, /createDraftRequestSchema/);
  assert.match(createRoute, /MarketReportContextUnavailableError/);
  assert.match(createRoute, /isMarketFinderReportIntakeEnabled/);
  assert.equal(
    repository.match(/requireMarketFinderReportIntakeEnabled\(/g)?.length,
    3,
  );
  assert.match(saveRoute, /Market report context cannot be changed/);
  assert.match(saveRoute, /MarketFinderReportIntakeUnavailableError/);
  assert.match(submitRoute, /MarketFinderReportIntakeUnavailableError/);
  assert.match(component, /kind: "market_report"/);
  assert.match(
    component,
    /\/api\/contribute\/drafts\/\$\{remote\.id\}\/submit/,
  );
  assert.match(
    developmentPage,
    /submissionContext=\{\{ marketSlug, productSlug, shopSlug \}\}/,
  );
  assert.match(developmentPage, /if \(isMarketFixtureEnabled\(\)\)/);
});
