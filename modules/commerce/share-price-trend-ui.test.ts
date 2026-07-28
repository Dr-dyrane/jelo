import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('share cards carry compact market and exact-store movement without steady noise', async () => {
  const root = process.cwd();
  const data = await readFile(
    path.join(root, 'app/(site)/share/[slug]/share-data.ts'),
    'utf8',
  );
  const card = await readFile(
    path.join(root, 'app/(site)/share/[slug]/share-card.tsx'),
    'utf8',
  );
  const image = await readFile(
    path.join(root, 'app/(site)/share/[slug]/opengraph-image.tsx'),
    'utf8',
  );
  const repository = await readFile(
    path.join(root, 'lib/inventory/price-trends.ts'),
    'utf8',
  );
  const priceModel = await readFile(
    path.join(root, 'modules/commerce/price-trends.ts'),
    'utf8',
  );
  const worthSharing = await readFile(
    path.join(root, 'lib/share/worth-sharing.ts'),
    'utf8',
  );

  assert.match(data, /getProductPriceTrends\(\s*product\.slug,\s*offers\.flatMap/);
  assert.match(data, /priceTrendOfferSnapshot\(offer, 'NG', now\)/);
  assert.match(data, /preferredPriceMovement\(\s*priceTrends\.NG,\s*movement =>/);
  assert.match(data, /movement\.comparableRetailerCount \?\? 0/);
  assert.match(data, /'Market price',\s*2,/);
  assert.match(data, /selectRetailerPriceMovement\(priceTrends, 'NG', offer\.retailer\)/);
  assert.match(data, /compactPriceMovementLabel\(movement\)/);
  assert.match(card, /aria-label=\{trend\.description\}/);
  assert.match(card, /<PriceTrend trend=\{view\.marketTrend\} market \/>/);
  assert.match(card, /<PriceTrend trend=\{offer\.trend\} \/>/);
  assert.match(image, /Market \{view\.marketTrend\.label\}/);
  assert.match(repository, /selectCurrentPriceObservations\(rows, snapshot\)/);
  assert.match(repository, /o\.available/);
  assert.match(repository, /o\.inventory_status as "inventoryStatus"/);
  assert.match(repository, /o\.verification_expires_at::text as "verificationExpiresAt"/);
  assert.match(repository, /export async function getProductsPriceTrends/);
  assert.match(repository, /p\.slug::text as "productSlug"/);
  assert.match(repository, /where p\.slug = any\(\$\{slugs\}::text\[\]\)/);
  assert.match(worthSharing, /getProductsPriceTrends\(products\.map\(product =>/);
  assert.match(worthSharing, /priceTrendOfferSnapshot\(offer, 'NG', now\)/);
  assert.doesNotMatch(worthSharing, /Promise\.all\(products\.map\(async product/);
  assert.match(priceModel, /priceMinor:\s*number/);
  assert.match(priceModel, /currencyCode:\s*'NGN' \| 'USD'/);
  assert.match(priceModel, /observedTitle:\s*string/);
  assert.match(priceModel, /observedSize:\s*string/);
  assert.doesNotMatch(card, /Steady|Median|Average/);
});
