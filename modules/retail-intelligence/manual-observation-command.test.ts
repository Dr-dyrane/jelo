import assert from 'node:assert/strict';
import test from 'node:test';
import { parseManualObservationCommand } from '@/lib/inventory/manual-observation-command';

const base = [
  '--product-slug', 'cerave-foaming-facial-cleanser',
  '--retailer', 'Beauty by Daz',
  '--stock', 'in_stock',
  '--observed-title', 'CeraVe Foaming Facial Cleanser 473 ml',
  '--observed-size', '473 ml',
  '--evidence-note', 'Visible in the retailer browser page.',
  '--rationale', 'Automation is blocked by the retailer.',
];

test('manual observations are dry-run by default and require scoped evidence', () => {
  assert.deepEqual(parseManualObservationCommand(base), {
    productSlug: 'cerave-foaming-facial-cleanser',
    retailer: 'Beauty by Daz',
    stock: 'in_stock',
    observedTitle: 'CeraVe Foaming Facial Cleanser 473 ml',
    observedSize: '473 ml',
    evidenceNote: 'Visible in the retailer browser page.',
    rationale: 'Automation is blocked by the retailer.',
    validForHours: 72,
    apply: false,
  });
  assert.equal(parseManualObservationCommand([...base, '--apply']).apply, true);
});

test('manual observations accept an optional exact URL and whole-naira price only', () => {
  const parsed = parseManualObservationCommand([
    ...base,
    '--url', 'https://beauty.example/products/cleanser',
    '--market-code', 'ng',
    '--price-naira', '23500',
    '--valid-for-hours', '24',
  ]);
  assert.equal(parsed.url, 'https://beauty.example/products/cleanser');
  assert.equal(parsed.marketCode, 'NG');
  assert.equal(parsed.priceNaira, 23_500);
  assert.equal(parsed.validForHours, 24);
  assert.throws(() => parseManualObservationCommand([...base, '--price-naira', '23500.50']), /whole-naira/);
  assert.throws(() => parseManualObservationCommand([...base, '--price-naira', '0']), /positive whole-naira/);
  assert.throws(() => parseManualObservationCommand([...base, '--url', 'http://beauty.example/product']), /https/);
  assert.throws(() => parseManualObservationCommand([...base, '--market-code', 'NG-1']), /Market code/);
});

test('manual observations fail closed on missing scope evidence, invalid stock, and unbounded expiry', () => {
  assert.throws(() => parseManualObservationCommand(base.filter(value => value !== '--observed-size' && value !== '473 ml')), /observed-size is required/);
  const invalidStock = base.map(value => value === 'in_stock' ? 'available' : value);
  assert.throws(() => parseManualObservationCommand(invalidStock), /Invalid option/);
  assert.throws(() => parseManualObservationCommand([...base, '--valid-for-hours', '169']), /between 1 and 168/);
  assert.throws(() => parseManualObservationCommand([...base, '--payload', 'raw']), /Unknown flag/);
});
