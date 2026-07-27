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

  assert.match(data, /getProductPriceTrends\(\s*product\.slug,\s*offers\.map/);
  assert.match(data, /preferredPriceMovement\(priceTrends\.NG\)/);
  assert.match(data, /movement\.comparableRetailerCount \?\? 0/);
  assert.match(data, /'Market price',\s*2,/);
  assert.match(data, /offers\.map\(offer => \(\{[\s\S]*market: 'NG',[\s\S]*retailer: offer\.retailer,[\s\S]*url: offer\.url,/);
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
  assert.doesNotMatch(card, /Steady|Median|Average/);
});
