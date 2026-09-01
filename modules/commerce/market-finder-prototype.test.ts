import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MARKET_REPORT_OUTCOMES,
  marketReportContributionHref,
} from "../../lib/markets/feedback";
import {
  DEFAULT_MARKET_FIXTURE_PRODUCT,
  MARKET_FIXTURE_ACCESS,
  MARKET_UNRESOLVED_REQUESTS,
  deriveMarketPrimaryAction,
  findMarketFixtureProduct,
  isMarketFixtureEnabled,
  listMarketFixtureLeads,
  resolveMarketFixtureProductQuery,
} from "../../lib/markets/fixture";

test("the Market Finder fixture is development-only and fails closed elsewhere", () => {
  assert.deepEqual(MARKET_FIXTURE_ACCESS, {
    mode: "development-only",
    productionBehavior: "not-found",
  });
  assert.equal(isMarketFixtureEnabled("development"), true);
  assert.equal(isMarketFixtureEnabled("production"), false);
  assert.equal(isMarketFixtureEnabled("test"), false);

  for (const path of [
    "app/(site)/markets/page.tsx",
    "app/(site)/markets/[marketSlug]/page.tsx",
    "app/(site)/markets/[marketSlug]/shops/[shopSlug]/page.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /if \(!isMarketFixtureEnabled\(\)\) notFound\(\);/);
    assert.match(
      source,
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/,
    );
  }
});

test("unknown or unresolved product names never become market results", () => {
  const product = findMarketFixtureProduct(DEFAULT_MARKET_FIXTURE_PRODUCT);
  assert.ok(product);
  assert.equal(product.brand, "COSRX");
  assert.equal(product.name, "Aloe Soothing Sun Cream");
  assert.equal(product.size, "50 ml");
  assert.equal(findMarketFixtureProduct("cosrx-aloe-unknown-size"), undefined);
  assert.equal(resolveMarketFixtureProductQuery(undefined), undefined);
  assert.equal(resolveMarketFixtureProductQuery(""), undefined);
  assert.equal(
    resolveMarketFixtureProductQuery([
      DEFAULT_MARKET_FIXTURE_PRODUCT,
      "miracle-natural-hair-anti-dandruff-shampoo",
    ]),
    undefined,
  );
  assert.equal(
    resolveMarketFixtureProductQuery(DEFAULT_MARKET_FIXTURE_PRODUCT)?.slug,
    DEFAULT_MARKET_FIXTURE_PRODUCT,
  );

  const unresolvedQueries = MARKET_UNRESOLVED_REQUESTS.map(
    (request) => request.query,
  );
  assert.deepEqual(unresolvedQueries, [
    "Kuza black castor oil",
    "Moroccan argan oil",
    "Lush relaxer",
  ]);
  for (const request of MARKET_UNRESOLVED_REQUESTS) {
    assert.match(request.reason, /unresolved/i);
  }
});

test("shop action states preserve uncertainty instead of inventing routes", () => {
  const leads = listMarketFixtureLeads(
    "trade-fair",
    DEFAULT_MARKET_FIXTURE_PRODUCT,
  );
  const bySlug = new Map(leads.map((lead) => [lead.slug, lead]));

  const purchaseReport = bySlug.get("shop-beside-cyncel-lead");
  const locationLead = bySlug.get("cyncel-a43-lead");
  const unavailable = bySlug.get("kuddy-cosmetics-visit-record");
  const disputed = bySlug.get("disputed-plaza-reference");
  assert.ok(purchaseReport && locationLead && unavailable && disputed);

  assert.deepEqual(deriveMarketPrimaryAction(purchaseReport), {
    kind: "paused",
    label: "Research record only",
    enabled: false,
  });
  assert.deepEqual(deriveMarketPrimaryAction(locationLead), {
    kind: "paused",
    label: "Research record only",
    enabled: false,
  });
  assert.equal(deriveMarketPrimaryAction(unavailable).enabled, false);
  assert.deepEqual(deriveMarketPrimaryAction(disputed), {
    kind: "paused",
    label: "Directions paused",
    enabled: false,
  });
  assert.equal(disputed.directions.length, 0);
  assert.match(disputed.evidenceNote, /does not claim that the plaza exists/i);
  assert.equal(
    leads.some((lead) => deriveMarketPrimaryAction(lead).enabled),
    false,
  );
});

test("negative stock and report outcomes stay narrowly product-scoped", () => {
  const kuddy = listMarketFixtureLeads(
    "trade-fair",
    DEFAULT_MARKET_FIXTURE_PRODUCT,
  ).find((lead) => lead.slug === "kuddy-cosmetics-visit-record");
  assert.ok(kuddy);
  assert.equal(kuddy.productSlug, DEFAULT_MARKET_FIXTURE_PRODUCT);
  assert.match(
    kuddy.evidenceNote,
    /only to COSRX Aloe Soothing Sun Cream 50 ml/i,
  );
  assert.match(
    kuddy.evidenceNote,
    /nothing about Kuddy.s other products or branches/i,
  );

  assert.deepEqual(
    MARKET_REPORT_OUTCOMES.map((choice) => choice.id),
    ["found_bought", "shop_exists_no_stock", "location_wrong", "shop_closed"],
  );
});

test("shop reports hand exact fixture context to Contribute without writing", () => {
  const reportHref = marketReportContributionHref({
    marketSlug: "trade-fair",
    productSlug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    shopSlug: "kuddy-cosmetics-visit-record",
  });
  assert.equal(
    reportHref,
    "/contribute?mode=market-report&market=trade-fair&product=cosrx-aloe-soothing-sun-cream-50ml&shop=kuddy-cosmetics-visit-record#contribution-form",
  );
  assert.equal(
    marketReportContributionHref({
      marketSlug: "trade-fair",
      productSlug: "",
      shopSlug: "kuddy-cosmetics-visit-record",
    }),
    null,
  );
  assert.equal(
    marketReportContributionHref({
      marketSlug: "trade-fair?published=true",
      productSlug: DEFAULT_MARKET_FIXTURE_PRODUCT,
      shopSlug: "kuddy-cosmetics-visit-record",
    }),
    null,
  );

  const feedbackSource = readFileSync(
    "components/markets/market-feedback.tsx",
    "utf8",
  );
  const detailSource = readFileSync(
    "components/markets/market-shop-detail.tsx",
    "utf8",
  );
  const contributePageSource = readFileSync(
    "app/(site)/contribute/page.tsx",
    "utf8",
  );
  const reportPrototypeSource = readFileSync(
    "components/contribute/market-report-prototype.tsx",
    "utf8",
  );
  assert.match(feedbackSource, /Report an update/);
  assert.match(feedbackSource, /Continue to Contribute for review/);
  assert.match(
    feedbackSource,
    /does not[\s\S]*update stock or directions directly/,
  );
  assert.match(detailSource, /marketSlug=\{market\.slug\}/);
  assert.match(detailSource, /productSlug=\{product\.slug\}/);
  assert.match(detailSource, /shopSlug=\{lead\.slug\}/);
  assert.doesNotMatch(feedbackSource, /useState|<button|fetch\(|\/api\//);
  assert.doesNotMatch(feedbackSource, /<textarea|type=["']file["']/);
  assert.doesNotMatch(reportHref, /\/(?:basket|checkout|order|api)(?:\/|\?|$)/);

  assert.match(contributePageSource, /params\.mode !== MARKET_REPORT_MODE/);
  assert.match(contributePageSource, /!isMarketFixtureEnabled\(\)/);
  assert.match(contributePageSource, /findMarketFixtureShop\(/);
  assert.match(
    contributePageSource,
    /if \(!market \|\| !product \|\| !shop\) notFound\(\)/,
  );
  assert.match(contributePageSource, /<ContributionExperience/);
  assert.match(reportPrototypeSource, /MARKET_REPORT_OUTCOMES\.map/);
  assert.match(
    reportPrototypeSource,
    /Nothing selected here is saved[\s\S]*or sent/,
  );
  assert.match(
    reportPrototypeSource,
    /There is no submission API or durable write/,
  );
  assert.doesNotMatch(
    reportPrototypeSource,
    /fetch\(|\/api\/|localStorage|sessionStorage/,
  );
});

test("the prototype keeps text navigation and feedback semantically accessible", () => {
  const resultsSource = readFileSync(
    "components/markets/market-result-list.tsx",
    "utf8",
  );
  const detailSource = readFileSync(
    "components/markets/market-shop-detail.tsx",
    "utf8",
  );
  const feedbackSource = readFileSync(
    "components/markets/market-feedback.tsx",
    "utf8",
  );

  assert.match(resultsSource, /<ol/);
  assert.match(resultsSource, /<ul/);
  assert.match(resultsSource, /Not ranked · do not travel from these/);
  assert.match(resultsSource, /data-state=\{lead\.state\}/);
  assert.match(detailSource, /<ol className=\{styles\.directionSteps\}>/);
  assert.match(feedbackSource, /<Link/);
  assert.match(feedbackSource, /aria-hidden=["']true["']/);

  for (const source of [resultsSource, detailSource, feedbackSource]) {
    assert.doesNotMatch(source, /href=["']\/(basket|checkout|order|api)/);
  }
});
