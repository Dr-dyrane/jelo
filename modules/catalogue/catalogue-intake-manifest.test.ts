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
import { verifyCatalogueIdentityEvidenceArtifacts } from '@/lib/catalogue/identity-evidence-artifact';
import {
  catalogueGenerationRecordSha256,
  catalogueIdentityExtractionByteSize,
  catalogueIdentityExtractionSha256,
  auditCatalogueIntakeCandidates,
  evaluateCatalogueIntakeCandidate,
} from '@/lib/catalogue/intake-readiness';

const researchAsOf = Date.parse('2026-07-22T23:00:00Z');

test('checked-in canonical identity artifacts match every declared byte and hash', async () => {
  assert.equal(await verifyCatalogueIdentityEvidenceArtifacts(catalogueIntakeCandidates), 6);
});

test('the first deliberate intake cohort stays private and approval-blocked', () => {
  assert.equal(catalogueIntakeCandidates.length, 6);
  assert.equal(catalogueIntakeDecisions.length, 6);
  assert.equal(catalogueIntakeExposure.approvalDraftReadyCount, 0);
  assert.equal(catalogueIntakeExposure.excludedMarketObservationCount, 6);
  assert.equal(catalogueIntakeExposure.publicProductCount, 0);
  assert.equal(catalogueIntakeExposure.policy, 'private-research-only');
  assert.equal(catalogueIntakeDecisions.every(decision => !decision.approvalDraftReady), true);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'identity').length, 0);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'care').length, 0);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'nigeria').length, 6);
});

test('the acne wash identity binds the official page and revisioned exact-pack image', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-acne-foaming-cream-wash-10-150ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '3606000604520');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '150 ml');
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.supplementalResponses?.length, 1);
  assert.equal(extraction.supplementalResponses?.[0].role, 'official-pack-image');
  assert.equal(extraction.supplementalResponses?.[0].responseMimeType, 'image/jpeg');

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'nigeria');
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.ok(decision.blockers.includes('nigeria-regulatory-pending'));

  const tampered = structuredClone(candidate);
  const tamperedExtraction = tampered.identity.officialEvidence!.canonicalExtraction;
  tamperedExtraction.supplementalResponses![0].responseSha256 = 'x'.repeat(64);
  tampered.identity.officialEvidence!.snapshotSha256 = catalogueIdentityExtractionSha256(tamperedExtraction);
  tampered.identity.officialEvidence!.snapshotByteSize = catalogueIdentityExtractionByteSize(tamperedExtraction);
  assert.equal(
    evaluateCatalogueIntakeCandidate(tampered, researchAsOf).blockers.includes('identity-official-evidence-invalid'),
    true,
  );
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

test('official CeraVe snapshots advance identity and care without treating retailer SKUs as GTIN evidence', () => {
  for (const id of ['cerave-hydrating-cleanser-473ml', 'cerave-moisturising-cream-454g']) {
    const candidate = catalogueIntakeCandidates.find(item => item.id === id);
    assert.ok(candidate);
    const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
    assert.equal(decision.stage, 'nigeria');
    assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
    assert.equal(decision.blockers.includes('care-review-missing'), false);
    assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
    const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
    assert.ok(extraction);
    assert.equal(candidate.identity.officialEvidence?.snapshotSha256, catalogueIdentityExtractionSha256(extraction));
    assert.equal(candidate.identity.officialEvidence?.snapshotByteSize, catalogueIdentityExtractionByteSize(extraction));
  }
  const cleanser = catalogueIntakeCandidates.find(item => item.id === 'cerave-hydrating-cleanser-473ml');
  assert.ok(cleanser);
  const cleanserDecision = evaluateCatalogueIntakeCandidate(cleanser, researchAsOf);
  assert.equal(cleanserDecision.freshExactOffers.length, 1);
  assert.equal(cleanserDecision.freshExactOffers[0].retailer, 'BuyBetter');
  assert.equal(cleanserDecision.nigeriaMarketRoute, 'brand-authorized');
  assert.equal(cleanserDecision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.ok(cleanserDecision.blockers.includes('nigeria-regulatory-pending'));

  const cream = catalogueIntakeCandidates.find(item => item.id === 'cerave-moisturising-cream-454g');
  assert.ok(cream);
  const creamDecision = evaluateCatalogueIntakeCandidate(cream, researchAsOf);
  assert.equal(creamDecision.freshExactOffers.length, 1);
  assert.equal(creamDecision.freshExactOffers[0].retailer, 'Nectar Beauty Hub');
  assert.equal(creamDecision.nigeriaMarketRoute, 'brand-authorized');
  assert.equal(creamDecision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.ok(creamDecision.blockers.includes('nigeria-regulatory-pending'));
  assert.ok(creamDecision.blockers.includes('asset-final-image-missing'));
  assert.equal(cream?.variant, 'CeraVe Moisturising Cream Pot');
  assert.match(cream?.care.manufacturerEvidenceUrl ?? '', /africa\.cerave\.com/);
});

test('the hydrating cleanser keeps a hash-bound reviewed render private behind the Nigeria gate', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-hydrating-cleanser-473ml');
  assert.ok(candidate);
  assert.equal(candidate.asset.origin, 'owned-identity-verified-render');
  assert.equal(candidate.asset.publicImageSha256, '7928f54978129907360231dbfbbbb4f8b930b3c22271b66537a702386e2e1ac6');
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  assert.equal(candidate.asset.packaging, 'intact');
  assert.equal(candidate.asset.labelVariantSizeUnchanged, true);
  assert.equal(candidate.asset.manualSourceOutputQa, true);
  assert.equal(candidate.asset.presentationQuality, 'magazine-ready');

  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...content } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(content));
  assert.equal(generation.inputs.some(input => (
    input.url === candidate.asset.sourceUrl
    && input.sha256 === candidate.asset.sourceAssetSha256
  )), true);

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'nigeria');
  assert.equal(decision.blockers.includes('asset-generation-record-missing'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);
  assert.equal(decision.blockers.includes('asset-final-image-too-small'), false);
  assert.equal(decision.blockers.includes('asset-identity-qa-missing'), false);
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
    assert.ok(candidate.nigeria.exactOffers.length + candidate.nigeria.excludedObservations.length > 0, candidate.id);
    assert.equal(candidate.nigeria.exactOffers.every(offer => new URL(offer.listingUrl).protocol === 'https:'), true, candidate.id);
    assert.equal(candidate.nigeria.excludedObservations.every(observation => (
      observation.disposition === 'excluded-from-exact-comparison'
      && new URL(observation.listingUrl).protocol === 'https:'
    )), true, candidate.id);
    assert.match(decision.nextAction, /\.$/);
  }
});

test('provisional Slique evidence is retained but cannot become independent Tier-A evidence', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-moisturising-cream-454g');
  assert.ok(candidate);
  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(candidate.nigeria.excludedObservations.some(observation => (
    observation.retailer === 'Slique Beauty' && observation.retailerStatus === 'provisional'
  )), true);
  const slique = candidate.nigeria.excludedObservations.find(observation => observation.retailer === 'Slique Beauty');
  assert.equal(slique?.evidence.fields.retailerIdentifier?.label, 'EAN');
  assert.equal(slique?.evidence.fields.retailerIdentifier?.value, '2000000269764');
  assert.notEqual(slique?.evidence.fields.retailerIdentifier?.value, candidate.identity.gtin);
  assert.ok(slique?.exclusionReasons.includes('manufacturer-identifier-mismatch'));
  assert.equal(candidate.nigeria.exactOffers.some(offer => offer.retailer === 'Konga Health'), false);
  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.freshExactOffers.filter(offer => offer.retailerStatus === 'provisional').length, 0);
  assert.equal(decision.freshExactOffers.filter(offer => offer.retailerStatus === 'directory-listed').length, 1);
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
});

test('excluded market observations are durable evidence and never exact offers', () => {
  const observations = catalogueIntakeCandidates.flatMap(candidate => candidate.nigeria.excludedObservations);
  assert.equal(observations.length, 6);
  assert.equal(catalogueIntakeDecisions.reduce((count, decision) => (
    count + decision.freshExactOffers.length
  ), 0), 2);
  assert.equal(catalogueIntakeDecisions.reduce((count, decision) => (
    count + decision.excludedMarketObservations.length
  ), 0), observations.length);
  for (const observation of observations) {
    assert.match(observation.evidence.responseSha256, /^[0-9a-f]{64}$/);
    assert.equal(observation.evidence.responseDigestScope, 'decoded-response-body');
    assert.equal(observation.evidence.responseMimeType, 'text/html');
    assert.ok(observation.exclusionReasons.length > 0);
  }
});

test('a tampered excluded observation fails the private intake audit', () => {
  const candidates = structuredClone(catalogueIntakeCandidates);
  const candidate = candidates.find(item => item.nigeria.excludedObservations.length > 0);
  assert.ok(candidate);
  candidate.nigeria.excludedObservations[0].evidence.responseSha256 = 'not-a-hash';
  assert.throws(
    () => auditCatalogueIntakeCandidates(candidates, researchAsOf),
    /invalid excluded market observation/,
  );
});

test('the UK/EU SA cleanser keeps its 473 ml identity through a bounded care review', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-sa-smoothing-cleanser-473ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '3337875795456');
  assert.equal(candidate.identity.basis, 'official-brand');
  assert.match(candidate.reason, /473 ml UK\/EU.*236 ml Africa.*8 fl oz US/);
  assert.equal(candidate.care.careTier, 'targeted-care');
  assert.equal(candidate.care.manufacturerEvidenceUrl, 'https://www.cerave.co.uk/skincare/cleansers/sa-smoothing-cleanser');
  assert.equal(candidate.care.independentClinicalGuidanceUrl, 'https://www.nhs.uk/conditions/keratosis-pilaris/');
  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'nigeria');
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.ok(decision.blockers.includes('nigeria-regulatory-pending'));
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
