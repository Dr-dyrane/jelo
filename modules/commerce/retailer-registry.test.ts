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
    assert.ok(['directory-listed', 'provisional'].includes(store.reviewStatus));
    assert.equal(store.contentUse, 'link-only');
    if (store.identityEvidence) {
      assert.equal(new URL(store.identityEvidence.sourceUrl).protocol, 'https:');
      assert.ok(!Number.isNaN(Date.parse(store.identityEvidence.observedAt)));
    }
    if (index > 0) assert.ok(nigeriaRetailers[index - 1].trust >= store.trust);

    const search = retailerSearchUrl(store.name, 'PanOxyl 10%');
    assert.ok(search);
    assert.equal(new URL(search).protocol, 'https:');
  }
});

test('Slique is explicitly provisional without regulator evidence or content reuse permission', () => {
  const slique = nigeriaRetailers.find(store => store.name === 'Slique Beauty');
  assert.ok(slique);
  assert.equal(slique.reviewStatus, 'provisional');
  assert.equal(slique.contentUse, 'link-only');
  assert.equal(slique.identityEvidence?.scope, 'self-published');
  assert.equal(slique.regulatorMatchEvidence, undefined);
});

test('unknown retailers never receive a fabricated search route', () => {
  assert.equal(retailerSearchUrl('Unknown store', 'Cleanser'), undefined);
});
