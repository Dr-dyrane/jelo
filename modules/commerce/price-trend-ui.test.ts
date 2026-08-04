import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('price movement stays compact, per-store, accessible, and evidence gated', async () => {
  const root = process.cwd();
  const component = await readFile(
    path.join(root, 'components/commerce/retailer-list.tsx'),
    'utf8',
  );
  const styles = await readFile(path.join(root, 'app/product-experience.css'), 'utf8');
  const repository = await readFile(path.join(root, 'lib/inventory/price-trends.ts'), 'utf8');
  const productPage = await readFile(
    path.join(root, 'app/(site)/products/[slug]/page.tsx'),
    'utf8',
  );
  const productPanelModel = await readFile(
    path.join(root, 'lib/catalogue/product-panel-model.ts'),
    'utf8',
  );
  const priceModel = await readFile(
    path.join(root, 'modules/commerce/price-trends.ts'),
    'utf8',
  );

  assert.match(repository, /calculateOfferPriceTrends/);
  assert.match(repository, /h\.id::text as "historyId"/);
  assert.match(repository, /h\.created_at::text as "recordedAt"/);
  assert.match(repository, /h\.observed_at asc, h\.created_at asc, h\.id asc/);
  assert.match(productPage, /readProductPanelData\(product\)/);
  assert.match(productPanelModel, /if \(offer\.match === 'search'\) return \[\]/);
  assert.match(productPanelModel, /priceTrendOfferSnapshot\(offer, market\)/);
  assert.match(productPanelModel, /getProductPriceTrends\(product\.slug, trendSnapshot\)/);
  assert.match(component, /selectRetailerPriceMovement/);
  assert.match(component, /PriceTrend movement=\{movement\}/);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(component, /describePriceMovement/);
  assert.match(component, /movement\.direction === 'flat'\) return null/);
  assert.match(component, /const Icon = movement\.direction === 'down' \? ArrowDown : ArrowUp/);
  assert.match(priceModel, /movement\.comparableOfferCount/);
  assert.match(priceModel, /currentPrice !== expected\.priceMinor/);
  assert.match(priceModel, /currentObservedAt !== expected\.observedAt/);
  assert.match(priceModel, /latest\.observation\.priceMinor !== latest\.snapshot\.priceMinor/);
  assert.match(priceModel, /orderedPriceObservations/);
  assert.match(styles, /\.price-trend\s*\{[\s\S]*display:\s*inline-flex/);
  assert.doesNotMatch(styles, /@media \(max-width: 383px\)/);
  assert.doesNotMatch(component, /Steady|movement\.days\}d|lowestMovement/);
});
