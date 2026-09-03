import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { MarketFinderDirectoryModel } from "../../lib/markets/domain";
import { resolveMarketFinderNavigationHref } from "../../lib/markets/navigation";

const activeEnvironment = {
  MARKET_FINDER_PUBLIC_READ_ENABLED: "true",
  MARKET_FINDER_PUBLIC_MARKET_SLUG: "trade-fair",
};

function currentDirectory(): MarketFinderDirectoryModel {
  return {
    state: "current",
    market: {
      id: "market-1",
      slug: "trade-fair",
      name: "Lagos Trade Fair",
      city: "Lagos",
      stateRegion: "Lagos",
      countryCode: "NG",
    },
    products: [
      {
        identityVersionId: "identity-1",
        productId: "product-1",
        slug: "exact-product-50ml",
        brand: "Exact Brand",
        variant: "Exact Product",
        size: "50 ml",
        packageVersion: "pack-v1",
        formulaVersion: "formula-v1",
      },
    ],
    evaluatedAt: "2026-09-02T00:00:00.000Z",
  };
}

test("Market Finder navigation is visible for the development fixture", async () => {
  const href = await resolveMarketFinderNavigationHref({
    nodeEnvironment: "development",
    readDirectory: async () => {
      throw new Error("the development fixture must not query production data");
    },
  });

  assert.equal(href, "/markets");
});

test("Market Finder navigation fails closed until production is ready", async () => {
  let reads = 0;
  const disabledHref = await resolveMarketFinderNavigationHref({
    nodeEnvironment: "production",
    environment: {},
    readDirectory: async () => {
      reads += 1;
      return currentDirectory();
    },
  });
  assert.equal(disabledHref, null);
  assert.equal(reads, 0);

  const emptyHref = await resolveMarketFinderNavigationHref({
    nodeEnvironment: "production",
    environment: activeEnvironment,
    readDirectory: async () => ({
      state: "empty",
      market: null,
      products: [],
      reason: "no-approved-observation",
      evaluatedAt: "2026-09-02T00:00:00.000Z",
    }),
  });
  assert.equal(emptyHref, null);

  const unavailableHref = await resolveMarketFinderNavigationHref({
    nodeEnvironment: "production",
    environment: activeEnvironment,
    readDirectory: async () => {
      throw new Error("repository unavailable");
    },
  });
  assert.equal(unavailableHref, null);
});

test("Market Finder navigation appears for a current production directory", async () => {
  const href = await resolveMarketFinderNavigationHref({
    nodeEnvironment: "production",
    environment: activeEnvironment,
    readDirectory: async (marketSlug) => {
      assert.equal(marketSlug, "trade-fair");
      return currentDirectory();
    },
  });

  assert.equal(href, "/markets");
});

test("the native footer and mobile utility menu share the gated entry", () => {
  const layout = readFileSync("app/(site)/layout.tsx", "utf8");
  const header = readFileSync("components/navigation/site-header.tsx", "utf8");

  assert.match(layout, /resolveMarketFinderNavigationHref\(\)/);
  assert.match(
    layout,
    /<SiteHeader marketFinderHref=\{marketFinderHref \?\? undefined\} \/>/,
  );
  assert.match(
    layout,
    /<Link href="\/retailers">Retailers<\/Link>[\s\S]*marketFinderHref[\s\S]*Market Finder/,
  );

  const desktopLinksStart = header.indexOf("<div className={styles.links}>");
  const desktopLinks = header.slice(
    desktopLinksStart,
    header.indexOf("</div>", desktopLinksStart),
  );
  assert.doesNotMatch(desktopLinks, /Market Finder|marketFinderHref/);
  assert.match(
    header,
    /className=\{styles\.mobileSecondary\}[\s\S]*Retailers[\s\S]*marketFinderHref[\s\S]*Market Finder/,
  );
});
