import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseRetailerBasketOption,
  type RetailerBasketOption,
} from '@/lib/commerce/retailer-basket';

const option = (retailer: string) => ({ retailer }) as RetailerBasketOption;

test('retailer choice keeps a valid preference and otherwise uses ranked first', () => {
  const options = [option('First'), option('Preferred')];

  assert.equal(chooseRetailerBasketOption(options, 'Preferred'), options[1]);
  assert.equal(chooseRetailerBasketOption(options, 'Missing'), options[0]);
  assert.equal(chooseRetailerBasketOption([], 'Missing'), undefined);
});
