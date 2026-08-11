import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("share cards carry compact market and exact-store movement without steady noise", async () => {
  const root = process.cwd();
  const data = await readFile(
    path.join(root, "app/(site)/share/[slug]/share-data.ts"),
    "utf8",
  );
  const card = await readFile(
    path.join(root, "app/(site)/share/[slug]/share-card.tsx"),
    "utf8",
  );
  const repository = await readFile(
    path.join(root, "lib/inventory/price-trends.ts"),
    "utf8",
  );
  const priceModel = await readFile(
    path.join(root, "modules/commerce/price-trends.ts"),
    "utf8",
  );
  const worthSharing = await readFile(
    path.join(root, "lib/share/worth-sharing.ts"),
    "utf8",
  );
  const productTrends = await readFile(
    path.join(root, "lib/share/product-trends.ts"),
    "utf8",
  );
  const trendChart = await readFile(
    path.join(root, "components/product-trends/product-trends-chart.tsx"),
    "utf8",
  );
  const trendStory = await readFile(
    path.join(root, "app/(site)/share/[slug]/story/route.tsx"),
    "utf8",
  );

  assert.match(
    data,
    /getProductPriceTrends\(\s*product\.slug,\s*offers\.flatMap/,
  );
  assert.match(data, /priceTrendOfferSnapshot\(offer, (?:'NG'|"NG"), now\)/);
  assert.match(
    data,
    /preferredPriceMovement\(\s*priceTrends\.NG,\s*(?:movement|\(movement\)) =>/,
  );
  assert.match(data, /movement\.comparableRetailerCount \?\? 0/);
  assert.match(data, /(?:'Market price'|"Market price"),\s*2,/);
  assert.match(
    data,
    /selectRetailerPriceMovement\(priceTrends, (?:'NG'|"NG"), offer\.retailer\)/,
  );
  assert.match(data, /compactPriceMovementLabel\(movement\)/);
  assert.match(card, /aria-label=\{trend\.description\}/);
  assert.match(card, /<PriceTrend trend=\{view\.marketTrend\} market \/>/);
  assert.match(card, /<PriceTrend trend=\{offer\.trend\} \/>/);
  assert.match(repository, /selectCurrentPriceObservations\(rows, snapshot\)/);
  assert.match(repository, /o\.available/);
  assert.match(repository, /o\.inventory_status as "inventoryStatus"/);
  assert.match(
    repository,
    /o\.verification_expires_at::text as "verificationExpiresAt"/,
  );
  assert.match(repository, /export async function getProductsPriceTrends/);
  assert.match(repository, /p\.slug::text as "productSlug"/);
  assert.match(repository, /where p\.slug = any\(\$\{slugs\}::text\[\]\)/);
  assert.match(
    worthSharing,
    /getProductsPriceTrends\(products\.map\(product =>/,
  );
  assert.match(worthSharing, /priceTrendOfferSnapshot\(offer, 'NG', now\)/);
  assert.doesNotMatch(
    worthSharing,
    /Promise\.all\(products\.map\(async product/,
  );
  assert.match(priceModel, /priceMinor:\s*number/);
  assert.match(priceModel, /currencyCode:\s*["']NGN["'] \| ["']USD["']/);
  assert.match(priceModel, /observedTitle:\s*string/);
  assert.match(priceModel, /observedSize:\s*string/);
  assert.doesNotMatch(card, /Steady|Median|Average/);
  // The repository falls back to static price history when the DB has no
  // data, so that the /share page always shows price drops and increases.
  assert.match(repository, /computeStaticPriceTrends/);
  assert.match(repository, /computeStaticPriceHistory/);
  assert.match(repository, /return results;/);
  assert.match(repository, /referenceNow - 90 \* 86_400_000/);
  assert.match(repository, /h\.observed_at >= \$\{historyCutoff\}/);
  assert.match(
    productTrends,
    /return getProductPriceHistory\(slug, snapshot\)/,
  );
  // History must be queried across every shareable offer, not just the
  // representative three rendered on the chart. Restricting the query
  // itself (rather than just the rendered set) previously made the chart
  // go dark whenever the seeded history belonged to a retailer that had
  // since fallen out of the lowest/median/highest set.
  assert.match(
    productTrends,
    /fetchRawObservations\(\s*product\.slug,\s*fullSnapshots,?\s*\)/,
  );
  assert.match(productTrends, /retailersWithHistory/);
  assert.match(productTrends, /priceRepresentativeHasHistory/);
  assert.match(productTrends, /offersWithHistory/);
  assert.match(trendChart, /buildObservedTrendPath\(s\.points\)/);
  assert.match(trendChart, /selectTrendWindowMovement\(/);
  assert.doesNotMatch(
    trendChart,
    /buildCurvedPath|buildAreaPath|Catmull|marketTrendLabel|store\.trendLabel/,
  );
  // The chart must not use framer-motion pathLength animation, which renders
  // lines invisible on the server (stroke-dasharray="0 1") and fails to
  // animate on hydration when the element is already in the viewport.
  assert.doesNotMatch(trendChart, /whileInView|pathLength|motion\.path/);
  assert.match(trendStory, /buildObservedTrendPath\(points\)/);
  assert.doesNotMatch(
    trendStory,
    /buildMonotoneCampaignPath|story-area|\[60, 420, 780\]|draw the curve/,
  );
  assert.match(
    trendStory,
    /Two dated observations are needed for time movement\./,
  );
});
