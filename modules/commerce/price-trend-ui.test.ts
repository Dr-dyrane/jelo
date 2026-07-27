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
  const priceModel = await readFile(
    path.join(root, 'modules/commerce/price-trends.ts'),
    'utf8',
  );

  assert.match(repository, /calculateOfferPriceTrends/);
  assert.match(component, /selectRetailerPriceMovement/);
  assert.match(component, /PriceTrend movement=\{movement\}/);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(component, /movement\.days\}d/);
  assert.match(component, /describePriceMovement/);
  assert.match(priceModel, /movement\.comparableOfferCount/);
  assert.match(styles, /\.price-trend\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(
    styles,
    /@media \(max-width: 383px\)[\s\S]*\.market-price-line\s*\{[\s\S]*display:\s*grid/,
  );
  assert.doesNotMatch(component, /Price dropped|Price rose/);
});
