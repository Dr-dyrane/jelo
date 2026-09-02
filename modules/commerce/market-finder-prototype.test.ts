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
  ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
  deriveMarketPrimaryAction,
  findMarketFixtureProduct,
  findMarketUnresolvedRequest,
  isMarketFixtureEnabled,
  listMarketFixtureProducts,
  listMarketFixtureLeads,
  resolveMarketFixtureProductPackshot,
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
    assert.match(source, /isMarketFixtureEnabled\(\)/);
    assert.match(source, /isMarketFinderPublicReadEnabled/);
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
      ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
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
    "Miracle anti-dandruff shampoo",
    "Lush relaxer",
  ]);
  for (const request of MARKET_UNRESOLVED_REQUESTS) {
    assert.match(request.reason, /unresolved/i);
    assert.match(request.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  assert.equal(
    findMarketUnresolvedRequest("miracle-natural-hair-anti-dandruff-shampoo")
      ?.slug,
    "miracle-anti-dandruff-shampoo",
  );
});

test("fixture media fails closed until an exact transparent packshot is reviewed", () => {
  const products = listMarketFixtureProducts();
  assert.equal(products.length, 1);
  for (const product of products) {
    assert.equal(resolveMarketFixtureProductPackshot(product), undefined);
  }
  const routeRehearsal = findMarketFixtureProduct(
    ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
  );
  assert.ok(routeRehearsal);
  assert.equal(routeRehearsal.listed, false);
  assert.match(routeRehearsal.identityNote, /fictional/i);
  assert.equal(resolveMarketFixtureProductPackshot(routeRehearsal), undefined);

  const fixtureSource = readFileSync("lib/markets/fixture.ts", "utf8");
  assert.doesNotMatch(fixtureSource, /productBySlug/);
  assert.match(
    fixtureSource,
    /never bypass the reviewed supplemental decision/i,
  );
  assert.doesNotMatch(fixtureSource, /cosrx\.com\/cdn\/shop\/files/);
  assert.doesNotMatch(fixtureSource, /packshot\.webp/);
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
  assert.equal(locationLead.actionEvidence.retailerLocationVerified, true);
  assert.equal(locationLead.actionEvidence.observationReviewed, false);
  assert.equal(locationLead.actionEvidence.usableAction, null);
  assert.match(locationLead.locationLabel, /Shop A43, Akwa-Ibom Plaza/);
  assert.match(locationLead.evidenceNote, /official site confirms Shop A43/i);
  assert.match(
    locationLead.evidenceNote,
    /does not establish A43 shelf stock/i,
  );
  assert.match(
    locationLead.evidenceNote,
    /not attributed as the unnamed seller/i,
  );
  const resultListSource = readFileSync(
    "components/markets/market-result-list.tsx",
    "utf8",
  );
  const detailSource = readFileSync(
    "components/markets/market-shop-detail.tsx",
    "utf8",
  );
  assert.match(
    resultListSource,
    /location-lead[\s\S]*retailerLocationVerified[\s\S]*CircleHelp/,
  );
  assert.match(
    resultListSource,
    /state === "ready" \|\|[\s\S]*retailerLocationVerified[\s\S]*"Checked"/,
  );
  assert.match(
    detailSource,
    /retailerLocationVerified[\s\S]*exact-pack branch stock still needs review/,
  );
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

test("fictional fixture states exercise an eligible route and fail-closed expiry", () => {
  const leads = listMarketFixtureLeads(
    "trade-fair",
    ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
  );
  const ready = leads.find(
    (lead) => lead.slug === "fixture-beauty-supply-route-rehearsal",
  );
  const stale = leads.find(
    (lead) => lead.slug === "fixture-hair-supply-stale-observation",
  );
  assert.ok(ready && stale);
  assert.equal(ready.state, "ready");
  assert.match(ready.locationLabel, /fictional/i);
  assert.match(ready.evidenceNote, /not Trade Fair evidence/i);
  assert.ok(ready.directions.length > 0);
  assert.deepEqual(deriveMarketPrimaryAction(ready), {
    kind: "directions",
    label: "View text directions",
    enabled: true,
  });

  assert.equal(stale.state, "stale");
  assert.equal(stale.expiresAt, "2026-08-30");
  assert.deepEqual(deriveMarketPrimaryAction(stale), {
    kind: "paused",
    label: "Evidence expired",
    enabled: false,
  });
  assert.equal(stale.directions.length, 0);
});

test("Market routes provide meaningful loading and recoverable error boundaries", () => {
  const loading = readFileSync("app/(site)/markets/loading.tsx", "utf8");
  const error = readFileSync("app/(site)/markets/error.tsx", "utf8");
  const missing = readFileSync("app/(site)/markets/not-found.tsx", "utf8");

  assert.match(loading, /aria-busy=["']true["']/);
  assert.match(loading, /aria-live=["']polite["']/);
  assert.match(error, /^["']use client["'];/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(error, /No shop or stock guidance[\s\S]*guessed/);
  assert.match(missing, /No reviewed result\./);
  assert.match(missing, /href=["']\/products["']/);
  assert.doesNotMatch(missing, /<footer|Nothing here/);
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
  assert.match(feedbackSource, /Report a change/);
  assert.match(feedbackSource, /Private/);
  assert.match(feedbackSource, /Reviewed first/);
  assert.match(feedbackSource, /marketReportContributionHref/);
  assert.match(detailSource, /marketSlug=\{market\.slug\}/);
  assert.match(detailSource, /productSlug=\{product\.slug\}/);
  assert.match(detailSource, /shopSlug=\{lead\.slug\}/);
  assert.doesNotMatch(feedbackSource, /useState|<button|fetch\(|\/api\//);
  assert.doesNotMatch(feedbackSource, /<textarea|type=["']file["']/);
  assert.doesNotMatch(reportHref, /\/(?:basket|checkout|order|api)(?:\/|\?|$)/);

  assert.match(contributePageSource, /params\.mode !== MARKET_REPORT_MODE/);
  assert.match(contributePageSource, /if \(isMarketFixtureEnabled\(\)\)/);
  assert.match(contributePageSource, /findMarketFixtureShop\(/);
  assert.match(
    contributePageSource,
    /if \(!market \|\| !product \|\| !shop\) notFound\(\)/,
  );
  assert.match(contributePageSource, /<ContributionExperience/);
  assert.match(reportPrototypeSource, /MARKET_REPORT_OUTCOMES\.map/);
  assert.match(reportPrototypeSource, /Nothing is saved or sent/);
  assert.match(
    reportPrototypeSource,
    /if \(!submissionContext\) \{[\s\S]*setReviewed\(true\);[\s\S]*return;/,
  );
  assert.match(
    contributePageSource,
    /submissionContext=\{\{ marketSlug, productSlug, shopSlug \}\}/,
  );
  assert.match(contributePageSource, /title:\s*["']Report a market update["']/);
  assert.doesNotMatch(reportPrototypeSource, /localStorage|sessionStorage/);
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
  assert.match(resultsSource, /<details/);
  assert.match(resultsSource, /<summary/);
  assert.match(resultsSource, /Other reports and warnings/);
  assert.match(resultsSource, /data-state=\{lead\.state\}/);
  assert.match(resultsSource, /\{lead\.stateLabel\}/);
  assert.match(resultsSource, /lead\.kind === "direction-alert"/);
  assert.match(resultsSource, /lead\.detailRecordAvailable === true/);
  assert.match(resultsSource, /<h3>\{lead\.name\}<\/h3>/);
  assert.match(
    resultsSource,
    /compact[\s\S]*styles\.recordNote[\s\S]*lead\.kind === "shop"[\s\S]*detailRecordAvailable === true[\s\S]*styles\.recordAction/,
  );
  assert.match(
    readFileSync("components/markets/exact-product-anchor.tsx", "utf8"),
    /changeHref = "\/markets#exact-products-title"/,
  );
  assert.match(detailSource, /<ol className=\{styles\.directionSteps\}>/);
  assert.match(feedbackSource, /<Link/);
  assert.match(feedbackSource, /aria-hidden=["']true["']/);

  for (const source of [resultsSource, detailSource, feedbackSource]) {
    assert.doesNotMatch(source, /href=["']\/(basket|checkout|order|api)/);
  }
});

test("the full Market Finder flow reuses native JeloCare composition", () => {
  const entrySource = readFileSync("app/(site)/markets/page.tsx", "utf8");
  const resultPageSource = readFileSync(
    "app/(site)/markets/[marketSlug]/page.tsx",
    "utf8",
  );
  const shopPageSource = readFileSync(
    "components/markets/market-shop-detail.tsx",
    "utf8",
  );
  const productPageSource = readFileSync(
    "app/(site)/products/[slug]/page.tsx",
    "utf8",
  );
  const stylesheet = readFileSync(
    "components/markets/market-finder.module.css",
    "utf8",
  );

  assert.match(entrySource, /DirectoryTypeahead/);
  assert.match(entrySource, /ProductCardGrid/);
  assert.match(entrySource, /title:\s*["']Market Finder["']/);
  assert.doesNotMatch(entrySource, /Market Finder · JeloCare/);
  assert.doesNotMatch(
    resultPageSource,
    /at \$\{view\.market\.name\} · JeloCare/,
  );
  assert.match(
    entrySource,
    /imageUnavailableLabel:\s*["']No reviewed image["']/,
  );
  assert.match(entrySource, /No reviewed images/);
  assert.doesNotMatch(entrySource, /product-placeholder\.svg/);
  assert.doesNotMatch(
    entrySource,
    /only places ready for a visit|reviewed routes|Reviewed market/,
  );
  assert.match(entrySource, /<details className=\{styles\.identityQueue\}>/);
  assert.match(
    entrySource,
    /emptyAction=\{\{[\s\S]*href: ["']\/me\/shelf\/add\?from=market-finder["'][\s\S]*label: ["']Share the exact pack["'][\s\S]*queryParameter: ["']request["']/,
  );
  const directoryTypeahead = readFileSync(
    "components/directory/directory-typeahead.tsx",
    "utf8",
  );
  assert.match(directoryTypeahead, /emptyActionAvailable/);
  assert.match(
    directoryTypeahead,
    /event\.key === ["']Enter["'][\s\S]*router\.push\(emptyActionHref\)/,
  );
  assert.match(
    directoryTypeahead,
    /href=\{emptyActionHref \?\? emptyAction\.href\}/,
  );
  assert.match(directoryTypeahead, /id=\{emptyActionId\}/);
  assert.match(directoryTypeahead, /role=["']option["']/);
  assert.match(
    entrySource,
    /MARKET_UNRESOLVED_REQUESTS\.map[\s\S]*productRequestEntryHref\(request\.query\)/,
  );
  assert.doesNotMatch(entrySource, /<Link href=["']\/contribute["']>/);
  assert.doesNotMatch(entrySource, /styles\.productOption/);
  assert.match(resultPageSource, /SmartBackLink/);
  assert.match(
    resultPageSource,
    /className=\{styles\.routeStatePrimary\}[\s\S]*href=\{productRequestEntryHref\(request\.query\)\}[\s\S]*Share the exact pack/,
  );
  assert.doesNotMatch(
    resultPageSource,
    /function UnresolvedFixtureProduct[\s\S]*href=["']\/contribute["']/,
  );
  assert.match(shopPageSource, /SmartBackLink/);
  assert.match(shopPageSource, /<ExactProductAnchor product=\{product\}/);
  assert.match(
    productPageSource,
    /marketFinderHref=\{marketFinderEntry\?\.href\}/,
  );
  assert.match(entrySource, /readMarketFinderDirectory/);
  assert.match(resultPageSource, /readMarketFinder/);
  assert.match(
    readFileSync(
      "app/(site)/markets/[marketSlug]/shops/[shopSlug]/page.tsx",
      "utf8",
    ),
    /readMarketFinder/,
  );
  assert.match(
    stylesheet,
    /@media \(max-width: 900px\)[\s\S]*?\.finderHero \.heroStage\s*\{\s*display:\s*none;/,
  );
  assert.match(
    stylesheet,
    /@media \(max-width: 900px\)[\s\S]*?\.productAnchor\s*\{[\s\S]*?grid-template-columns:\s*clamp\(/,
  );
  assert.match(
    stylesheet,
    /@media \(max-width: 640px\) \{[\s\S]*?\.changeProduct\s*\{\s*min-height:\s*2\.75rem;/,
  );
  assert.match(
    stylesheet,
    /@media \(max-width: 640px\) \{[\s\S]*?\.resultCard\s*\{\s*padding:\s*1rem;\s*grid-template-columns:\s*1fr;/,
  );
  assert.match(
    stylesheet,
    /@media \(max-width: 640px\) \{[\s\S]*?\.resultCardCompact\s*\{\s*grid-template-columns:\s*1fr;/,
  );
  assert.match(
    stylesheet,
    /\.routeStateActions \.routeStatePrimary\s*\{\s*background:\s*var\(--ink\);\s*color:\s*var\(--cream\);/,
  );
  assert.doesNotMatch(stylesheet, /marketResultsPage\s+\.productAnchor/);
  assert.doesNotMatch(stylesheet, /Product-to-place result flow/);
  assert.doesNotMatch(stylesheet, /mix-blend-mode/);
  const heroImageRule = stylesheet.match(/\.heroProducts img\s*\{([^}]*)\}/);
  assert.ok(heroImageRule);
  assert.doesNotMatch(heroImageRule[1], /border-radius|filter|transform/);
  const secondaryImageRule = stylesheet.match(
    /\.heroProductSecondary\s*\{([^}]*)\}/,
  );
  assert.ok(secondaryImageRule);
  assert.doesNotMatch(secondaryImageRule[1], /transform/);
  assert.match(
    readFileSync("components/markets/exact-product-anchor.tsx", "utf8"),
    /styles\.packshotStage\} product-visual/,
  );
  assert.doesNotMatch(
    readFileSync("components/markets/exact-product-anchor.tsx", "utf8"),
    /<span[^>]*className=\{styles\.packshotMissing\}/,
  );
  const productCardSource = readFileSync(
    "components/products/product-card.tsx",
    "utf8",
  );
  const safeProductImageSource = readFileSync(
    "components/products/safe-product-image.tsx",
    "utf8",
  );
  assert.match(safeProductImageSource, /fallback\?: React\.ReactNode/);
  assert.match(
    safeProductImageSource,
    /failed && fallbackContent !== undefined/,
  );
  assert.match(safeProductImageSource, /setFailed\(true\)/);
  assert.match(productCardSource, /product\.image \? \(/);
  assert.match(
    productCardSource,
    /data-image=\{product\.image \? (?:'ready'|"ready") : (?:'missing'|"missing")\}/,
  );
  assert.match(productCardSource, /className=\{styles\.missingVisual\}/);
  assert.match(
    productCardSource,
    /<div[\s\S]*className=\{styles\.missingVisual\}[\s\S]*role=["']img["']/,
  );
  assert.match(
    productCardSource,
    /fallback=\{[\s\S]*product\.imageUnavailableLabel !== undefined[\s\S]*missingVisual/,
  );
  assert.match(
    productCardSource,
    /aria-label=\{`\$\{product\.brand\} \$\{product\.name\}, \$\{product\.size\}`\}/,
  );
  assert.match(
    readFileSync("components/markets/exact-product-anchor.tsx", "utf8"),
    /fallback=\{unavailableImage\}/,
  );
  assert.match(entrySource, /fallback=\{[\s\S]*styles\.heroImageMissing/);
  assert.equal(stylesheet.match(/^\.productAnchor\s*\{/gm)?.length, 1);
  assert.equal(stylesheet.match(/^\.resultCard\s*\{/gm)?.length, 1);
  assert.match(
    stylesheet,
    /product-card\[data-image=["']missing["']\][\s\S]*?product-visual[\s\S]*?height:\s*10rem/,
  );

  const resultList = readFileSync(
    "components/markets/market-result-list.tsx",
    "utf8",
  );
  assert.doesNotMatch(resultList, /@\/lib\/markets\/fixture/);
  assert.ok(
    resultList.indexOf("className={styles.resultActions}") <
      resultList.indexOf("className={styles.resultEvidence}"),
  );
  const reportStyles = readFileSync(
    "components/contribute/market-report-prototype.module.css",
    "utf8",
  );
  const mobileReportRule = reportStyles.match(
    /@media \(max-width: 760px\) \{([\s\S]*?)\n\}/,
  );
  assert.ok(mobileReportRule);
  assert.doesNotMatch(mobileReportRule[1], /position:\s*sticky/);
});
