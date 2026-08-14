import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseRetailerBasketOption,
  type RetailerBasketOption,
} from '@/lib/commerce/retailer-basket';

const option = (retailer: string, allInStock = true) => ({
  retailer,
  allInStock,
}) as RetailerBasketOption;

test('retailer choice keeps an available preference and requires an explicit switch when it becomes unavailable', () => {
  const options = [option('First'), option('Preferred')];

  assert.equal(chooseRetailerBasketOption(options, 'Preferred'), options[1]);
  assert.equal(chooseRetailerBasketOption(options, 'Missing'), undefined);
  assert.equal(
    chooseRetailerBasketOption([option('Recheck', false), ...options], 'Recheck'),
    undefined,
  );
  assert.equal(chooseRetailerBasketOption(options), options[0]);
  assert.equal(chooseRetailerBasketOption([], 'Missing'), undefined);
});
