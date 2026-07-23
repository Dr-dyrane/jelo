import assert from 'node:assert/strict';
import test from 'node:test';
import { nigeriaRetailers, retailerSearchUrl } from '@/data/retailers';
import { reviewedBrandSellerEvidenceValid } from '@/lib/catalogue/brand-seller-evidence';

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

test('Ediths Essentials is a self-published direct retailer, not a brand-authorized seller claim', () => {
  const ediths = nigeriaRetailers.find(store => store.name === 'Ediths Essentials');
  assert.ok(ediths);
  assert.equal(ediths.reviewStatus, 'directory-listed');
  assert.equal(ediths.kind, 'retailer');
  assert.equal(ediths.identityEvidence?.basis, 'self-published-contact');
  assert.equal(ediths.identityEvidence?.scope, 'self-published');
  assert.equal(ediths.regulatorMatchEvidence, undefined);
});

test('24Eleven is a self-published direct retailer, not a brand-authorized seller claim', () => {
  const retailer = nigeriaRetailers.find(store => store.name === '24Eleven');
  assert.ok(retailer);
  assert.equal(retailer.reviewStatus, 'directory-listed');
  assert.equal(retailer.kind, 'retailer');
  assert.equal(retailer.identityEvidence?.basis, 'self-published-contact');
  assert.equal(retailer.identityEvidence?.scope, 'self-published');
  assert.equal(retailer.regulatorMatchEvidence, undefined);
});

test('Kadimez Essentials is a self-published direct retailer, not a brand-authorized seller claim', () => {
  const retailer = nigeriaRetailers.find(store => store.name === 'Kadimez Essentials');
  assert.ok(retailer);
  assert.equal(retailer.reviewStatus, 'directory-listed');
  assert.equal(retailer.kind, 'retailer');
  assert.equal(retailer.identityEvidence?.basis, 'self-published-contact');
  assert.equal(retailer.identityEvidence?.scope, 'self-published');
  assert.equal(retailer.regulatorMatchEvidence, undefined);
});

test('Muna Cosmetics is a self-published direct retailer, not a brand-authorized seller claim', () => {
  const retailer = nigeriaRetailers.find(store => store.name === 'Muna Cosmetics');
  assert.ok(retailer);
  assert.equal(retailer.reviewStatus, 'directory-listed');
  assert.equal(retailer.kind, 'retailer');
  assert.equal(retailer.identityEvidence?.sourceUrl, 'https://munacosmetics.com/about-muna-cosmetics');
  assert.equal(retailer.identityEvidence?.basis, 'self-published-contact');
  assert.equal(retailer.identityEvidence?.scope, 'self-published');
  assert.equal(retailer.regulatorMatchEvidence, undefined);
});

test('brand authorization binds seller, host, response representation and reviewer chronology', () => {
  const asOf = Date.parse('2026-07-22T23:00:00Z');
  const sourceUrl = 'https://africa.cerave.com/en/find-your-nearest-store';
  for (const name of ['Medplus', 'BuyBetter', 'Nectar Beauty Hub']) {
    const retailer = nigeriaRetailers.find(store => store.name === name);
    assert.ok(retailer);
    assert.equal(reviewedBrandSellerEvidenceValid(retailer, sourceUrl, asOf), true);
  }

  const medplus = nigeriaRetailers.find(store => store.name === 'Medplus');
  assert.ok(medplus?.identityEvidence?.basis === 'brand-source');
  const tamperedSeller = {
    ...medplus,
    identityEvidence: { ...medplus.identityEvidence, subjectSeller: 'Another Store' },
  };
  const tamperedExcerpt = {
    ...medplus,
    identityEvidence: { ...medplus.identityEvidence, sourceText: '<a href="https://medplusnig.com/">Other</a>' },
  };
  const redirectedResponse = {
    ...medplus,
    identityEvidence: { ...medplus.identityEvidence, responseUrl: 'https://attacker.example/redirected-body' },
  };
  const wrongDigestScope = {
    ...medplus,
    identityEvidence: { ...medplus.identityEvidence, responseDigestScope: 'compressed-wire-body' as never },
  };
  const missingReviewer = {
    ...medplus,
    identityEvidence: { ...medplus.identityEvidence, reviewer: undefined } as never,
  };
  const reviewBeforeRetrieval = {
    ...medplus,
    identityEvidence: { ...medplus.identityEvidence, reviewedAt: '2026-07-22T14:24:00Z' },
  };

  assert.equal(reviewedBrandSellerEvidenceValid(tamperedSeller, sourceUrl, asOf), false);
  assert.equal(reviewedBrandSellerEvidenceValid(tamperedExcerpt, sourceUrl, asOf), false);
  assert.equal(reviewedBrandSellerEvidenceValid(redirectedResponse, sourceUrl, asOf), false);
  assert.equal(reviewedBrandSellerEvidenceValid(wrongDigestScope, sourceUrl, asOf), false);
  assert.equal(reviewedBrandSellerEvidenceValid(missingReviewer, sourceUrl, asOf), false);
  assert.equal(reviewedBrandSellerEvidenceValid(reviewBeforeRetrieval, sourceUrl, asOf), false);
  assert.equal(reviewedBrandSellerEvidenceValid(medplus, sourceUrl, Date.parse('2027-02-01T00:00:00Z')), false);
});

test('shared brand-source response digests use one capture timestamp and representation', () => {
  const groups = new Map<string, Set<string>>();
  for (const retailer of nigeriaRetailers) {
    const evidence = retailer.identityEvidence;
    if (evidence?.basis !== 'brand-source') continue;
    const key = `${evidence.responseUrl}\n${evidence.responseSha256}`;
    const representations = groups.get(key) ?? new Set<string>();
    representations.add([
      evidence.retrievedAt,
      evidence.observedAt,
      evidence.responseDigestScope,
      evidence.responseMimeType,
      evidence.responseByteSize,
    ].join('|'));
    groups.set(key, representations);
  }

  for (const representations of groups.values()) assert.equal(representations.size, 1);
});

test('unknown retailers never receive a fabricated search route', () => {
  assert.equal(retailerSearchUrl('Unknown store', 'Cleanser'), undefined);
});
