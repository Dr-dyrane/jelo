import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('components/products/product-quick-panel.tsx', 'utf8');
const model = readFileSync('lib/catalogue/product-panel-model.ts', 'utf8');
const productPage = readFileSync('app/(site)/products/[slug]/page.tsx', 'utf8');
const panelStyles = readFileSync('app/product-panel.css', 'utf8');

test('the product panel exposes one controlled dialog with a stable accessible tab contract', () => {
  assert.equal(component.match(/<dialog\b/g)?.length, 1);
  assert.match(component, /export function ProductQuickPanelSheet/);
  assert.match(component, /open: boolean/);
  assert.match(component, /tab: ProductPanelTab/);
  assert.match(component, /onTabChange: \(tab: ProductPanelTab\) => void/);
  assert.match(component, /onClose: \(\) => void/);
  assert.match(component, /restoreFocusRef\?: RefObject<HTMLElement \| null>/);
  assert.match(component, /aria-controls={`\$\{dialogId\}-panel-\$\{item\.id\}`}/);
  assert.match(component, /aria-labelledby={`\$\{dialogId\}-tab-buy`}/);
  assert.match(component, /aria-labelledby={`\$\{dialogId\}-tab-stores`}/);
  assert.match(component, /aria-labelledby={`\$\{dialogId\}-tab-details`}/);
  assert.match(component, /onCancel=/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /restoreFocus\(\)/);
  assert.equal(component.match(/hidden=\{tab !== '(?:buy|stores|details)'\}/g)?.length, 3);
  assert.match(panelStyles, /\.product-panel-body \[hidden\] \{ display: none !important; \}/);
});

test('the public wrapper keeps its two familiar triggers and delegates to the controlled sheet', () => {
  assert.match(component, /export function ProductQuickPanel\(data: ProductPanelData\)/);
  assert.match(component, /> Find a store/);
  assert.match(component, /> Details/);
  assert.match(component, /<ProductQuickPanelSheet/);
  assert.match(component, /onClose=\{\(\) => setOpen\(false\)\}/);
});

test('one server read model owns evidence and the public page consumes it', () => {
  assert.match(model, /export type ProductPanelTab = 'buy' \| 'stores' \| 'details'/);
  assert.match(model, /export type ProductPanelData/);
  assert.match(model, /export async function readProductPanelData\(product: Product\)/);
  assert.match(model, /if \(offer\.match === 'search'\) return \[\]/);
  assert.match(model, /\(\['NG', 'US'\] as const\)/);
  assert.match(model, /getProductPriceTrends\(product\.slug, trendSnapshot\)/);
  assert.match(model, /listProductIngredientsSafe\(product\.slug\)/);
  assert.match(model, /getReviewedProductCare\(product\.slug\)/);
  assert.match(productPage, /readProductPanelData\(product\)/);
  assert.match(productPage, /<ProductQuickPanel \{\.\.\.panelData\} \/>/);
});
