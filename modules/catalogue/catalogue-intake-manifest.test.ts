import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogueIntakeCandidates,
  catalogueIntakeDecisions,
  catalogueIntakeExposure,
  catalogueIntakeQueue,
} from '@/data/catalogue-intake';
import { reviewedProductRecords } from '@/data/catalogue';
import { externalProducts } from '@/data/external-catalogue';
import { evaluateCatalogueIntakeCandidate } from '@/lib/catalogue/intake-readiness';

const researchAsOf = Date.parse('2026-07-22T15:42:00Z');

test('the first deliberate intake cohort stays private and approval-blocked', () => {
  assert.equal(catalogueIntakeCandidates.length, 6);
  assert.equal(catalogueIntakeDecisions.length, 6);
  assert.equal(catalogueIntakeExposure.approvalDraftReadyCount, 0);
  assert.equal(catalogueIntakeExposure.publicProductCount, 0);
  assert.equal(catalogueIntakeExposure.policy, 'private-research-only');
  assert.equal(catalogueIntakeDecisions.every(decision => !decision.approvalDraftReady), true);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'identity').length, 4);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'nigeria').length, 2);
});

test('independent care evidence advances an exact manufacturer identity without bypassing regulation', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'eucerin-oil-control-sun-gel-cream-spf50-50ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '8850029013671');
  assert.match(candidate.identity.officialProductUrl ?? '', /eucerin-cewa\.com/);
  assert.equal(candidate.identity.officialEvidence?.observedGtin, '8850029013671');
  assert.match(candidate.identity.officialEvidence?.snapshotSha256 ?? '', /^[0-9a-f]{64}$/);

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'nigeria');
  assert.equal(decision.blockers.includes('identity-gtin-missing-or-invalid'), false);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.ok(decision.blockers.includes('nigeria-regulatory-pending'));
});

test('GTIN-shaped retailer data cannot advance CeraVe while official snapshots hold identity', () => {
  for (const id of ['cerave-hydrating-cleanser-473ml', 'cerave-moisturising-cream-454g']) {
    const candidate = catalogueIntakeCandidates.find(item => item.id === id);
    assert.ok(candidate);
    const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
    assert.equal(decision.stage, 'identity');
    assert.equal(decision.freshExactOffers.length, 0);
    assert.ok(decision.blockers.includes('identity-official-evidence-invalid'));
    assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
  }
});

test('the UreaRepair dossier advances through identity and care without trusting a retailer SKU', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'eucerin-urearepair-plus-10-urea-body-lotion-250ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '6001051001606');
  assert.match(candidate.identity.officialEvidence?.snapshotSha256 ?? '', /^[0-9a-f]{64}$/);
  assert.equal(candidate.asset.sourceAssetWidth, 725);
  assert.equal(candidate.asset.sourceAssetHeight, 1200);

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'nigeria');
  assert.equal(decision.freshExactOffers.length, 0);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
});

test('every cohort item cites real Nigerian pages and an explicit next action', () => {
  for (const decision of catalogueIntakeQueue) {
    const candidate = decision.candidate;
    assert.ok(candidate.demandEvidenceUrls.length > 0, candidate.id);
    assert.ok(candidate.nigeria.exactOffers.length > 0, candidate.id);
    assert.equal(candidate.nigeria.exactOffers.every(offer => new URL(offer.listingUrl).protocol === 'https:'), true, candidate.id);
    assert.match(decision.nextAction, /\.$/);
  }
});

test('provisional Slique evidence is retained but cannot become independent Tier-A evidence', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-moisturising-cream-454g');
  assert.ok(candidate);
  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(candidate.nigeria.exactOffers.some(offer => offer.retailer === 'Slique Beauty' && offer.retailerStatus === 'provisional'), true);
  assert.equal(decision.freshExactOffers.length, 0);
  assert.equal(decision.freshExactOffers.filter(offer => offer.retailerStatus === 'provisional').length, 0);
  assert.equal(decision.freshExactOffers.filter(offer => offer.retailerStatus === 'directory-listed').length, 0);
  assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
});

test('the regional SA cleanser size mismatch remains visibly held at identity', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-sa-smoothing-cleanser-473ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.basis, undefined);
  assert.match(candidate.reason, /236 ml.*473 ml/);
});

test('no private intake candidate leaks into either public catalogue source', () => {
  const reviewedKeys = new Set(reviewedProductRecords.map(product => `${product.brand}|${product.name}|${product.size}`.toLowerCase()));
  const communityKeys = new Set(externalProducts.map(product => `${product.brand}|${product.name}|${product.quantity}`.toLowerCase()));

  for (const candidate of catalogueIntakeCandidates) {
    const key = `${candidate.brand}|${candidate.name}|${candidate.size}`.toLowerCase();
    assert.equal(reviewedKeys.has(key), false, candidate.id);
    assert.equal(communityKeys.has(key), false, candidate.id);
  }
});
