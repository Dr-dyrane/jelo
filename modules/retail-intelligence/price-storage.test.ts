import assert from 'node:assert/strict';
import test from 'node:test';
import { priceAmountToStorageInteger } from '@/lib/inventory/price-storage';

test('rounds fractional NGN observations to the whole-naira storage contract', () => {
  assert.equal(priceAmountToStorageInteger(32_698.94, 'NGN'), 32_699);
});

test('converts non-NGN observations to two-decimal minor units', () => {
  assert.equal(priceAmountToStorageInteger(15.03, 'USD'), 1_503);
});

test('rejects values that cannot be represented safely in bigint writes', () => {
  assert.throws(
    () => priceAmountToStorageInteger(Number.MAX_SAFE_INTEGER, 'USD'),
    /Cannot store unsafe USD price amount/,
  );
});
