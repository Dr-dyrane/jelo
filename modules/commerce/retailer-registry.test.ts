import assert from 'node:assert/strict';
import test from 'node:test';
import { nigeriaRetailers, retailerSearchUrl } from '@/data/retailers';

test('Nigeria retailer references are unique, secure and trust ordered', () => {
  assert.ok(nigeriaRetailers.length >= 12);
  assert.equal(new Set(nigeriaRetailers.map(store => store.name)).size, nigeriaRetailers.length);

  for (const [index, store] of nigeriaRetailers.entries()) {
    assert.equal(store.market, 'NG');
    assert.equal(new URL(store.homepage).protocol, 'https:');
    assert.ok(store.trust >= 0 && store.trust <= 100);
    if (index > 0) assert.ok(nigeriaRetailers[index - 1].trust >= store.trust);

    const search = retailerSearchUrl(store.name, 'PanOxyl 10%');
    assert.ok(search);
    assert.equal(new URL(search).protocol, 'https:');
  }
});

test('unknown retailers never receive a fabricated search route', () => {
  assert.equal(retailerSearchUrl('Unknown store', 'Cleanser'), undefined);
});
