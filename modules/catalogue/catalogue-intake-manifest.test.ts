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

const researchAsOf = Date.parse('2026-07-23T16:00:00Z');

test('checked-in canonical identity artifacts match every declared byte and hash', async () => {
  assert.equal(await verifyCatalogueIdentityEvidenceArtifacts(catalogueIntakeCandidates), 22);
});

test('the deliberate intake cohort exposes readiness without treating NAFDAC as a gate', () => {
  assert.equal(catalogueIntakeCandidates.length, 22);
  assert.equal(catalogueIntakeDecisions.length, 22);
  assert.equal(catalogueIntakeExposure.approvalDraftReadyCount, 22);
  assert.equal(catalogueIntakeExposure.excludedMarketObservationCount, 13);
  assert.equal(catalogueIntakeExposure.unresolvedRegulatorySearchCount, 1);
  assert.equal(catalogueIntakeExposure.publicProductCount, 0);
  assert.equal(catalogueIntakeExposure.policy, 'private-research-only');
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.approvalDraftReady).length, 22);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'identity').length, 0);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'care').length, 0);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'nigeria').length, 0);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'rights').length, 0);
  assert.equal(catalogueIntakeDecisions.filter(decision => decision.stage === 'approval-ready').length, 22);
});

test('a bot-protected Dove page advances through a hash-bound browser DOM review', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'dove-melanin-even-tone-body-wash-18-5oz');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '00011111040090');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '18.5 oz');
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 4);
  assert.equal(extraction.method, 'reviewed-browser-dom-identity-field-extraction');
  assert.equal(extraction.responseDigestScope, 'rendered-dom-outerhtml');
  assert.ok('browserCapture' in extraction);
  assert.equal(extraction.browserCapture.documentReadyState, 'complete');
  assert.equal(candidate.nigeria.exactOffers.length, 2);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'Teeka4']);
  assert.equal(candidate.nigeria.exactOffers[0].retailerSku, '011111040090');
  assert.equal(candidate.nigeria.exactOffers[1].retailerSku, 'TK-0411');
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.equal(candidate.nigeria.exactOffers[0].stock, 'low-stock');
  assert.equal(candidate.nigeria.exactOffers[1].stock, 'out-of-stock');
  assert.equal(candidate.nigeria.excludedObservations.length, 1);
  assert.equal(candidate.nigeria.excludedObservations[0].retailer, 'Slique Beauty');
  assert.ok(candidate.nigeria.excludedObservations[0].exclusionReasons.includes('manufacturer-identifier-mismatch'));
  assert.equal(candidate.asset.origin, 'owned-identity-verified-render');
  assert.equal(candidate.asset.publicImageSha256, '4e80e69d6c8ad7dff956343602416ef9ca9f27184ba6f74917e649b323784f4d');
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);

  const tampered = structuredClone(candidate);
  const tamperedExtraction = tampered.identity.officialEvidence!.canonicalExtraction;
  assert.ok('browserCapture' in tamperedExtraction);
  tamperedExtraction.browserCapture.documentReadyState = 'interactive' as never;
  tampered.identity.officialEvidence!.snapshotSha256 = catalogueIdentityExtractionSha256(tamperedExtraction);
  tampered.identity.officialEvidence!.snapshotByteSize = catalogueIdentityExtractionByteSize(tamperedExtraction);
  assert.equal(
    evaluateCatalogueIntakeCandidate(tampered, researchAsOf).blockers.includes('identity-official-evidence-invalid'),
    true,
  );
});

test('the KeraCare 32 oz identity keeps retailer SKUs local while exact Nigerian offers bind by variant and size', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'keracare-dry-itchy-scalp-conditioner-950ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '850068103058');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '32 oz');
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 4);
  assert.equal(extraction.method, 'reviewed-browser-dom-identity-field-extraction');
  assert.match(extraction.fields.gtin.sourceText, /gtin12: 850068103058/);
  assert.equal(candidate.care.careTier, 'targeted-care');
  assert.equal(
    candidate.care.independentClinicalGuidanceUrl,
    'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=5d501ba0-a6f9-4f0d-86d5-0e8d9302737f',
  );
  assert.equal(candidate.nigeria.exactOffers.length, 2);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'Ediths Essentials']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [38_485, 43_485]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedSize === '950 ml'), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.equal(candidate.nigeria.exactOffers[0].retailerSku, '796708350195');
  assert.equal(candidate.nigeria.exactOffers[1].retailerSku, 'BBE600');
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(candidate.nigeria.excludedObservations.length, 0);
  assert.equal(candidate.asset.publicImageSha256, 'd37d0d5abab7580e7e4c094f4b848ef3250665ece05296769347cdb2cdf89652');

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
});

test('the Balance toner keeps retailer SKUs local while exact Nigerian offers bind by variant and size', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'balance-salicylic-acid-zinc-clarifying-toner-200ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '5015833000351');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '200 ml');
  assert.equal(candidate.identity.officialEvidence?.canonicalExtraction.sourceResponseMimeType, 'text/javascript');
  assert.equal(candidate.nigeria.exactOffers.length, 2);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', '24Eleven']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [8_400, 9_200]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedSize === '200 ml'), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), ['5015833000351', '1023650']);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(candidate.nigeria.excludedObservations.length, 1);
  assert.equal(candidate.nigeria.excludedObservations.some(observation => (
    observation.retailer === 'Slique Beauty'
    && observation.evidence.fields.retailerIdentifier?.label === 'EAN'
    && observation.evidence.fields.retailerIdentifier.value === '2000000276601'
    && observation.exclusionReasons.includes('manufacturer-identifier-mismatch')
  )), true);
  assert.equal(candidate.asset.publicImageSha256, 'cec4c66e637ebf9cc9c4e2792f5ba3125fe3fd264ae7cbf6c47659088748744f');
  assert.equal(candidate.asset.generationRecord?.recordSha256, 'c89980ff8d1b672eed59b904ce1697d97e202bf22ab857b512d4caaf3cd2d4b3');

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);
});

test('the Balance niacinamide serum binds official identity, two exact Nigerian offers, and a clean generated packshot', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'balance-niacinamide-blemish-recovery-serum-30ml'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '5015833328165');
  assert.equal(candidate.identity.officialEvidence?.observedVariant, 'Skincare Niacinamide Blemish Recovery Serum');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '30 ml');
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 4);
  assert.equal(extraction.method, 'reviewed-browser-dom-identity-field-extraction');
  assert.equal(extraction.responseDigestScope, 'rendered-dom-outerhtml');
  assert.ok('browserCapture' in extraction);
  assert.equal(extraction.browserCapture.documentReadyState, 'complete');
  assert.equal(extraction.supplementalResponses?.[0].role, 'official-pack-image');
  assert.equal(candidate.care.independentClinicalGuidanceUrl, 'https://pubmed.ncbi.nlm.nih.gov/38722460/');
  assert.match(candidate.care.advisoryBoundary ?? '', /does not validate this exact 15% serum as acne treatment/i);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'CSi Grocery']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [8_400, 10_700]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedGtin === undefined
    && offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), ['5015833328165', undefined]);
  assert.equal(candidate.nigeria.excludedObservations.length, 1);
  assert.equal(candidate.nigeria.excludedObservations.some(observation => (
    observation.retailer === 'Slique Beauty'
    && observation.stock === 'low-stock'
    && observation.evidence.fields.retailerIdentifier?.label === 'SKU'
    && observation.exclusionReasons.includes('retailer-identifier-only')
    && observation.exclusionReasons.includes('retailer-provisional')
  )), true);
  assert.equal(candidate.asset.publicImageSha256, 'b6269078ce4e917ed02bf26104853c5a9103f53d41e788c1502f59fc60d0b467');
  assert.equal(candidate.asset.publicImageByteSize, 849_517);
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  assert.equal(candidate.asset.backgroundTreatment, 'identity-verified-render');
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(decision.blockers, []);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
});

test('the original NINELESS dropper stays bound to two independent EAN sources and exact package-version offers', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'nineless-a-control-10-azelaic-acid-serum-30ml'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '8809875270073');
  assert.equal(candidate.identity.packageVersion, 'Original green dropper bottle');
  assert.equal(candidate.identity.officialEvidence?.observedPackageVersion, candidate.identity.packageVersion);
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 5);
  if (extraction.schemaVersion !== 5) return;
  assert.equal(extraction.fields.manufacturerIdentifierStatus.value, 'not-published');
  assert.match(extraction.fields.manufacturerIdentifierStatus.sourceText, /"barcode":null/);
  assert.equal(extraction.identifierCorroborations.length, 2);
  assert.deepEqual(
    extraction.identifierCorroborations.map(item => item.fields.gtin.value),
    ['8809875270073', '8809875270073'],
  );
  assert.equal(
    new Set(extraction.identifierCorroborations.map(item => new URL(item.sourceUrl).hostname)).size,
    2,
  );
  assert.match(candidate.care.advisoryBoundary ?? '', /formula and pack were later changed/i);
  assert.match(candidate.care.advisoryBoundary ?? '', /must not be applied to this older stock/i);
  assert.deepEqual(
    candidate.nigeria.exactOffers.map(offer => offer.retailer),
    ['Beauty by Daz', 'BuyBetter'],
  );
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [12_500, 14_500]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedGtin === undefined
    && offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.observedPackageVersion === candidate.identity.packageVersion
    && offer.evidence?.fields.packageVersion?.value === candidate.identity.packageVersion
  )), true);
  assert.equal(candidate.nigeria.excludedObservations.length, 1);
  assert.equal(candidate.nigeria.excludedObservations.some(observation => (
    observation.retailer === 'Slique Beauty'
    && observation.evidence.fields.retailerIdentifier?.label === 'EAN'
    && observation.evidence.fields.retailerIdentifier.value === '2000000216256'
    && observation.exclusionReasons.includes('manufacturer-identifier-mismatch')
    && observation.exclusionReasons.includes('retailer-provisional')
  )), true);
  assert.equal(candidate.asset.publicImageSha256, 'd5141014189b67ba0d60045cfda6e7f29d21def48303bd4a2306b5d6be3db155');
  assert.equal(candidate.asset.publicImageByteSize, 806_089);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.nigeriaMarketRoute, 'tier-a');
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(decision.blockers, []);

  const mismatchedPackage = structuredClone(candidate);
  mismatchedPackage.nigeria.exactOffers[0].observedPackageVersion = 'Renewed opaque pump bottle';
  assert.equal(
    evaluateCatalogueIntakeCandidate(mismatchedPackage, researchAsOf).freshExactOffers.length,
    1,
  );
});

test('the original NINELESS Mela-Pro toner keeps renewed formula claims off older Nigerian stock', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'nineless-mela-pro-rice-txa-toner-200ml'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '8809875270172');
  assert.equal(candidate.identity.packageVersion, 'Original translucent bottle with orange cap');
  assert.equal(candidate.identity.officialEvidence?.observedPackageVersion, candidate.identity.packageVersion);
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 6);
  if (extraction.schemaVersion !== 6) return;
  assert.equal(extraction.responseDigestScope, 'rendered-accessibility-tree');
  assert.equal(extraction.identifierCorroborations.length, 2);
  assert.deepEqual(
    extraction.identifierCorroborations.map(item => item.fields.gtin.value),
    ['8809875270172', '8809875270172'],
  );
  assert.equal(
    new Set(extraction.identifierCorroborations.map(item => new URL(item.sourceUrl).hostname)).size,
    2,
  );
  assert.match(candidate.care.advisoryBoundary ?? '', /current 82% rice-bran claims.*must not be applied/i);
  assert.deepEqual(
    candidate.nigeria.exactOffers.map(offer => offer.retailer),
    ['BuyBetter', 'Muna Cosmetics'],
  );
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [15_500, 19_000]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), [
    '8809875270172',
    'MUNA-SC-N898393933',
  ]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedGtin === undefined
    && offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.observedPackageVersion === candidate.identity.packageVersion
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(candidate.asset.publicImageSha256, 'e0f7d446a0d85b5dde60d67a09c61ea35def172ca229ee811303f847abdcdcc4');
  assert.equal(candidate.asset.publicImageByteSize, 496_786);
  assert.equal(candidate.asset.width, 2_000);
  assert.equal(candidate.asset.height, 2_000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.nigeriaMarketRoute, 'tier-a');
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(decision.blockers, []);
});

test('the Face Facts oil-control cleanser binds two independent EAN sources, two Nigerian offers, and its reviewed render', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'facefacts-ceramide-oil-control-foaming-cleanser-400ml'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '5031413953923');
  assert.equal(candidate.identity.packageVersion, 'Current 400 ml white pump bottle with mint-green oil-control label');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '400 ml');

  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 6);
  if (extraction.schemaVersion !== 6) return;
  assert.equal(extraction.responseDigestScope, 'rendered-accessibility-tree');
  assert.deepEqual(
    extraction.identifierCorroborations.map(item => item.fields.gtin.value),
    ['5031413953923', '5031413953923'],
  );
  assert.equal(
    new Set(extraction.identifierCorroborations.map(item => new URL(item.sourceUrl).hostname)).size,
    2,
  );

  assert.deepEqual(
    candidate.nigeria.exactOffers.map(offer => offer.retailer),
    ['BuyBetter', '24Eleven'],
  );
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [6_880, 7_300]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), [
    '5031413953923',
    '1023827',
  ]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedGtin === undefined
    && offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.observedPackageVersion === candidate.identity.packageVersion
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(candidate.nigeria.exactOffers[1].evidence?.method, 'reviewed-browser-dom-exact-offer-field-extraction');
  assert.equal(candidate.nigeria.exactOffers[1].evidence?.browserCapture?.documentReadyState, 'complete');

  assert.equal(candidate.asset.publicImageSha256, '0446292645a1d412dc3a60d08ac7c4bef9391ba2892b77f315a30b7af689e05a');
  assert.equal(candidate.asset.publicImageByteSize, 886_252);
  assert.equal(candidate.asset.width, 2_000);
  assert.equal(candidate.asset.height, 2_000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.nigeriaMarketRoute, 'tier-a');
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(decision.blockers, []);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
});

test('the Face Facts hydrating cleanser binds two independent EAN sources, three Nigerian offers, and its reviewed render', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'facefacts-ceramide-hydrating-gentle-cleanser-400ml'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '5031413928662');
  assert.equal(
    candidate.identity.packageVersion,
    'Current 400 ml white pump bottle with green Ceramide Hydrating label',
  );
  assert.equal(candidate.identity.officialEvidence?.observedSize, '400 ml');

  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 6);
  if (extraction.schemaVersion !== 6) return;
  assert.equal(extraction.responseDigestScope, 'rendered-accessibility-tree');
  assert.deepEqual(
    extraction.identifierCorroborations.map(item => item.fields.gtin.value),
    ['5031413928662', '5031413928662'],
  );
  assert.deepEqual(
    extraction.identifierCorroborations.map(item => new URL(item.sourceUrl).hostname),
    ['lamifragrance.com', 'www.ebay.co.uk'],
  );

  assert.deepEqual(
    candidate.nigeria.exactOffers.map(offer => offer.retailer),
    ['Beauty by Daz', 'Teeka4', '24Eleven'],
  );
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [6_950, 7_200, 7_300]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), [
    '363-1-byd',
    'TK-0454',
    '102232',
  ]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedGtin === undefined
    && offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.observedPackageVersion === candidate.identity.packageVersion
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
    && offer.evidence.browserCapture?.documentReadyState === 'complete'
  )), true);

  assert.equal(candidate.asset.publicImageSha256, 'aa9674bb9e17155a2d89b6258b8d750b6599b8aa42d0f389b6be0ca1702eaa5d');
  assert.equal(candidate.asset.publicImageByteSize, 714_474);
  assert.equal(candidate.asset.width, 2_000);
  assert.equal(candidate.asset.height, 2_000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.nigeriaMarketRoute, 'tier-a');
  assert.equal(decision.freshExactOffers.length, 3);
  assert.deepEqual(decision.blockers, []);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
});

test('the Garnier day cream binds its official GTIN to exact Nigerian offers and a reviewed render', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'garnier-vitamin-c-brightening-day-cream-50ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '3600542453110');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '50 ml');
  assert.equal(candidate.nigeria.tierAIdentityEvidenceUrl, candidate.identity.officialProductUrl);
  assert.equal(candidate.nigeria.exactOffers.length, 2);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'Teeka4']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [12_728, 11_833]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), ['3600542453110', 'TK-0471']);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(candidate.nigeria.excludedObservations.length, 1);
  assert.equal(candidate.nigeria.excludedObservations.some(observation => (
    observation.retailer === 'Slique Beauty'
    && observation.exclusionReasons.includes('manufacturer-identifier-mismatch')
  )), true);
  assert.equal(candidate.asset.publicImageSha256, 'aa6bc47594a907d570015363924c7d5cb9db2065948e3ad0b41d4a67d036aae2');
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);
});

test('both exact Aqua Rich body-lotion variants are release-ready', () => {
  const ceramide = catalogueIntakeCandidates.find(item => (
    item.id === 'aqua-rich-ceramide-body-lotion-500ml'
  ));
  assert.ok(ceramide);
  assert.equal(ceramide.name, 'Hydrate + Protect Body Lotion');
  assert.equal(ceramide.identity.gtin, '4897073187549');
  assert.equal(ceramide.identity.officialEvidence?.observedVariant, 'Aqua Rich Ceramide Body Lotion');
  assert.equal(ceramide.identity.officialEvidence?.observedSize, '500 ml');
  assert.deepEqual(ceramide.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'CSi Grocery']);
  assert.deepEqual(ceramide.nigeria.exactOffers.map(offer => offer.priceNgn), [12_800, 13_000]);
  assert.equal(ceramide.nigeria.exactOffers.every(offer => (
    offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(ceramide.nigeria.excludedObservations.length, 1);
  assert.equal(ceramide.asset.publicImageSha256, '9435ff0eb88c9189179108e7cbcd5d486c0d6452e1f842bf2b95f24db3a2f324');
  const generation = ceramide.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const ceramideDecision = evaluateCatalogueIntakeCandidate(ceramide, researchAsOf);
  assert.equal(ceramideDecision.stage, 'approval-ready');
  assert.equal(ceramideDecision.approvalDraftReady, true);
  assert.equal(ceramideDecision.freshExactOffers.length, 2);
  assert.deepEqual(ceramideDecision.blockers, []);
  assert.equal(ceramide.nigeria.regulatoryStatus, 'pending');

  const turmeric = catalogueIntakeCandidates.find(item => (
    item.id === 'aqua-rich-turmeric-vitamin-c-body-lotion-500ml'
  ));
  assert.ok(turmeric);
  assert.equal(turmeric.identity.gtin, '4897073186542');
  assert.equal(turmeric.identity.officialEvidence?.observedSize, '500 ml');
  assert.deepEqual(turmeric.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'Kadimez Essentials']);
  assert.deepEqual(turmeric.nigeria.exactOffers.map(offer => offer.priceNgn), [10_750, 12_000]);
  assert.equal(turmeric.nigeria.exactOffers.every(offer => (
    offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(turmeric.nigeria.excludedObservations.length, 1);
  assert.equal(turmeric.asset.publicImageSha256, 'f2c087ec15a62033eaa0097317ffbb50d9144979dcb2578acf324faa26c89d6b');
  const turmericGeneration = turmeric.asset.generationRecord;
  assert.ok(turmericGeneration);
  const { recordSha256: turmericRecordSha256, ...turmericGenerationContent } = turmericGeneration;
  assert.equal(turmericRecordSha256, catalogueGenerationRecordSha256(turmericGenerationContent));
  const turmericDecision = evaluateCatalogueIntakeCandidate(turmeric, researchAsOf);
  assert.equal(turmericDecision.stage, 'approval-ready');
  assert.equal(turmericDecision.approvalDraftReady, true);
  assert.equal(turmericDecision.freshExactOffers.length, 2);
  assert.deepEqual(turmericDecision.blockers, []);
  assert.equal(turmeric.nigeria.regulatoryStatus, 'pending');
});

test('the acne wash binds its official identity, exact Nigerian offers and generated packshot', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-acne-foaming-cream-wash-10-150ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '3606000604520');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '150 ml');
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.supplementalResponses?.length, 1);
  assert.equal(extraction.supplementalResponses?.[0].role, 'official-pack-image');
  assert.equal(extraction.supplementalResponses?.[0].responseMimeType, 'image/jpeg');
  assert.equal(candidate.nigeria.exactOffers.length, 2);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['Beauty by Daz', 'Teeka4']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), ['CAFC', 'TK-1434']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [23_850, 24_500]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.evidence?.fields.gtin?.responseRole === 'official-identity-correlation'), true);
  assert.equal(candidate.asset.publicImageSha256, '3da215659684e6824c5c56a21789f05d5535c556427c6a23a8036f93dd961a6f');
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...generationContent } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(generationContent));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');

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

test('the Eucerin sunscreen binds two exact Nigerian listings without relabelling retailer SKUs as GTINs', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'eucerin-oil-control-sun-gel-cream-spf50-50ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '8850029013671');
  assert.match(candidate.identity.officialProductUrl ?? '', /eucerin-cewa\.com/);
  assert.equal(candidate.identity.officialEvidence?.observedGtin, '8850029013671');
  assert.match(candidate.identity.officialEvidence?.snapshotSha256 ?? '', /^[0-9a-f]{64}$/);

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(
    decision.freshExactOffers.map(offer => offer.retailer),
    ['Beauty by Daz', 'Nectar Beauty Hub'],
  );
  assert.equal(decision.nigeriaMarketRoute, 'tier-a');
  assert.equal(decision.blockers.includes('identity-gtin-missing-or-invalid'), false);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(decision.blockers.includes('asset-final-image-missing'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
  for (const offer of candidate.nigeria.exactOffers) {
    assert.equal(offer.observedGtin, undefined);
    assert.equal(offer.observedGtinBasis, 'exact-variant-and-size');
    const evidence = offer.evidence;
    assert.ok(evidence);
    assert.equal(evidence.method, 'reviewed-browser-dom-exact-offer-field-extraction');
    assert.equal(evidence.responseDigestScope, 'rendered-dom-outerhtml');
    assert.equal(evidence.fields.gtin.responseRole, 'official-identity-correlation');
    assert.equal(evidence.browserCapture?.documentReadyState, 'complete');
  }
});

test('official CeraVe snapshots advance identity and care without treating retailer SKUs as GTIN evidence', () => {
  for (const id of ['cerave-hydrating-cleanser-473ml', 'cerave-moisturising-cream-454g']) {
    const candidate = catalogueIntakeCandidates.find(item => item.id === id);
    assert.ok(candidate);
    const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
    assert.equal(['rights', 'approval-ready'].includes(decision.stage), true);
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
  assert.equal(cleanserDecision.stage, 'approval-ready');
  assert.equal(cleanserDecision.approvalDraftReady, true);
  assert.equal(cleanserDecision.unresolvedRegulatorySearches.length, 1);
  assert.equal(cleanserDecision.unresolvedRegulatorySearches[0].result.recordsFiltered, 0);
  assert.match(cleanserDecision.unresolvedRegulatorySearches[0].caveat, /not proof of non-registration/i);

  const tamperedSearch = structuredClone(cleanser);
  tamperedSearch.nigeria.regulatorySearches![0].responseSha256 = 'x'.repeat(64);
  assert.throws(
    () => auditCatalogueIntakeCandidates([tamperedSearch], researchAsOf),
    /invalid regulatory search observation/,
  );

  const cream = catalogueIntakeCandidates.find(item => item.id === 'cerave-moisturising-cream-454g');
  assert.ok(cream);
  const creamDecision = evaluateCatalogueIntakeCandidate(cream, researchAsOf);
  assert.equal(creamDecision.freshExactOffers.length, 1);
  assert.equal(creamDecision.freshExactOffers[0].retailer, 'Nectar Beauty Hub');
  assert.equal(creamDecision.nigeriaMarketRoute, 'brand-authorized');
  assert.equal(creamDecision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(cream.nigeria.regulatoryStatus, 'pending');
  assert.equal(creamDecision.stage, 'approval-ready');
  assert.equal(creamDecision.approvalDraftReady, true);
  assert.equal(creamDecision.blockers.includes('asset-final-image-missing'), false);
  assert.equal(cream?.variant, 'CeraVe Moisturising Cream Pot');
  assert.match(cream?.care.manufacturerEvidenceUrl ?? '', /africa\.cerave\.com/);
});

test('the hydrating cleanser has a hash-bound reviewed render ready for neutral publication', () => {
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
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.blockers.includes('asset-generation-record-missing'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);
  assert.equal(decision.blockers.includes('asset-final-image-too-small'), false);
  assert.equal(decision.blockers.includes('asset-identity-qa-missing'), false);
});

test('the Face Facts ceramide foaming cleanser binds the current pack and excludes older package observations', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'facefacts-ceramide-foaming-cleanser-400ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '5031413936636');
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  assert.ok(extraction);
  assert.equal(extraction.schemaVersion, 6);
  assert.ok('identifierCorroborations' in extraction);
  assert.equal(extraction.identifierCorroborations.length, 2);
  assert.equal(candidate.care.careTier, 'daily-care');
  assert.match(candidate.care.advisoryBoundary ?? '', /conflicting skin-type language/i);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', '24Eleven']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [6_450, 6_800]);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedPackageVersion === candidate.identity.packageVersion
  )), true);
  assert.deepEqual(
    candidate.nigeria.excludedObservations.map(observation => observation.retailer),
    ['Allure Beauty', 'Slique Beauty'],
  );
  assert.equal(candidate.nigeria.excludedObservations.every(observation => (
    observation.exclusionReasons.includes('package-variant-conflict')
  )), true);
  assert.equal(candidate.asset.origin, 'owned-identity-verified-render');
  assert.equal(candidate.asset.publicImageSha256, '81f78fac104816093e5a0c7243d6b1647316200205f64b0fbb56feb8c7704360');
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...content } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(content));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);
});

test('the UreaRepair dossier binds its generated packshot and exact Nigerian offers without trusting retailer SKUs as GTINs', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'eucerin-urearepair-plus-10-urea-body-lotion-250ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '6001051001606');
  assert.match(candidate.identity.officialEvidence?.snapshotSha256 ?? '', /^[0-9a-f]{64}$/);
  assert.equal(candidate.asset.sourceAssetWidth, 725);
  assert.equal(candidate.asset.sourceAssetHeight, 1200);
  assert.equal(candidate.asset.origin, 'owned-identity-verified-render');
  assert.equal(candidate.asset.publicImageSha256, 'e4e726394ef5bd5f36b5781828459ea9e5234c3e0a1b89c93931911701fbf6a6');
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  assert.equal(candidate.asset.packaging, 'intact');
  assert.equal(candidate.asset.labelVariantSizeUnchanged, true);
  assert.equal(candidate.asset.manualSourceOutputQa, true);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...content } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(content));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(decision.freshExactOffers.map(offer => offer.retailer), ['BuyBetter', 'Jumia']);
  assert.equal(decision.freshExactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(decision.freshExactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
  assert.equal(decision.blockers.includes('asset-final-image-invalid'), false);
});

test('the Calming Moisture body wash binds the exact Dove identity, current Nigerian prices and transparent render', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'dove-calming-moisture-body-wash-547ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '00011111049437');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '18.5 fl oz / 547 ml');
  assert.equal(candidate.identity.officialEvidence?.canonicalExtraction?.method, 'reviewed-browser-dom-identity-field-extraction');
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['BuyBetter', 'Teeka4']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [22_600, 17_800]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.stock), ['low-stock', 'out-of-stock']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), ['011111049437', 'TK-1689']);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.asset.origin, 'owned-identity-verified-render');
  assert.equal(candidate.asset.publicImageSha256, 'b6a102a269cec6f344bee5bb868c83f3204addf63f350e673e16f495d9133cf4');
  assert.equal(candidate.asset.publicImageByteSize, 822_500);
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...content } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(content));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.deepEqual(decision.blockers, []);
});

test('the SheaMoisture shampoo binds official identity, two Nigerian prices and its reviewed transparent render', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'sheamoisture-jamaican-black-castor-oil-shampoo-384ml'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '00764302215837');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '13 oz');
  assert.equal(
    candidate.identity.officialEvidence?.canonicalExtraction?.method,
    'reviewed-exact-identity-field-extraction',
  );
  assert.deepEqual(
    candidate.nigeria.exactOffers.map(offer => offer.retailer),
    ['BuyBetter', 'Perfect Trust Beauty'],
  );
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [12_685, 13_300]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.stock), ['in-stock', 'low-stock']);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.asset.origin, 'owned-identity-verified-render');
  assert.equal(
    candidate.asset.publicImageSha256,
    'a4b3e9dc07c29db0408fab3095e31826fd644075650587d201c0ddbc898b8be9',
  );
  assert.equal(candidate.asset.publicImageByteSize, 1_217_871);
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...content } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(content));

  const decision = evaluateCatalogueIntakeCandidate(candidate, Date.parse('2026-07-23T17:00:00Z'));
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.deepEqual(decision.freshExactOffers.map(offer => offer.retailer), [
    'BuyBetter',
    'Perfect Trust Beauty',
  ]);
  assert.deepEqual(decision.blockers, []);
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
  assert.equal(observations.length, 13);
  assert.equal(catalogueIntakeDecisions.reduce((count, decision) => (
    count + decision.freshExactOffers.length
  ), 0), 43);
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

test('the De La Cruz sulfur jar binds its official identity, two current Nigerian offers and final render', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'de-la-cruz-acne-treatment-10-sulfur-73-7g'
  ));
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '024286150426');
  assert.equal(candidate.identity.officialEvidence?.observedSize, '2.6 oz / 73.7 g');
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailer), ['Beauty by Daz', 'BuyBetter']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.priceNgn), [12_500, 17_738]);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.stock), ['in-stock', 'out-of-stock']);
  assert.deepEqual(candidate.nigeria.exactOffers.map(offer => offer.retailerSku), ['230-1-byd', '024286150426']);
  assert.equal(candidate.nigeria.exactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(candidate.nigeria.exactOffers.every(offer => (
    offer.observedGtinBasis === 'exact-variant-and-size'
    && offer.evidence?.fields.gtin.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(
    candidate.nigeria.exactOffers[0].evidence?.method,
    'reviewed-browser-accessibility-exact-offer-field-extraction',
  );
  assert.equal(candidate.asset.publicImageSha256, '07f60271a771ad7e84784b0677bf48bbc1e790360711708e986100fb6d8b7955');
  assert.equal(candidate.asset.publicImageByteSize, 3_844_784);
  assert.equal(candidate.asset.width, 2000);
  assert.equal(candidate.asset.height, 2000);
  const generation = candidate.asset.generationRecord;
  assert.ok(generation);
  const { recordSha256, ...content } = generation;
  assert.equal(recordSha256, catalogueGenerationRecordSha256(content));

  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.freshExactOffers.length, 2);
  assert.deepEqual(decision.blockers, []);
});

test('the UK/EU SA cleanser binds its 473 ml identity to two exact Nigerian offers', () => {
  const candidate = catalogueIntakeCandidates.find(item => item.id === 'cerave-sa-smoothing-cleanser-473ml');
  assert.ok(candidate);
  assert.equal(candidate.identity.gtin, '3337875795456');
  assert.equal(candidate.identity.basis, 'official-brand');
  assert.match(candidate.reason, /473 ml UK\/EU.*236 ml Africa.*8 fl oz US/);
  assert.equal(candidate.care.careTier, 'targeted-care');
  assert.equal(candidate.care.manufacturerEvidenceUrl, 'https://www.cerave.co.uk/skincare/cleansers/sa-smoothing-cleanser');
  assert.equal(candidate.care.independentClinicalGuidanceUrl, 'https://www.nhs.uk/conditions/keratosis-pilaris/');
  const decision = evaluateCatalogueIntakeCandidate(candidate, researchAsOf);
  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
  assert.equal(decision.nigeriaMarketRoute, 'tier-a');
  assert.deepEqual(decision.freshExactOffers.map(offer => offer.retailer), ['Teeka4', '24Eleven']);
  assert.deepEqual(decision.freshExactOffers.map(offer => offer.priceNgn), [20_900, 23_800]);
  assert.deepEqual(decision.freshExactOffers.map(offer => offer.retailerSku), ['TK-0199', '1023539']);
  assert.equal(decision.freshExactOffers.every(offer => offer.observedGtin === undefined), true);
  assert.equal(decision.freshExactOffers.every(offer => offer.observedGtinBasis === 'exact-variant-and-size'), true);
  assert.equal(decision.freshExactOffers.every(offer => (
    offer.evidence?.fields.gtin?.responseRole === 'official-identity-correlation'
  )), true);
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);
  assert.equal(decision.blockers.includes('care-review-missing'), false);
  assert.equal(decision.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(decision.blockers.includes('nigeria-market-route-insufficient'), false);
  assert.equal(candidate.nigeria.regulatoryStatus, 'pending');
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
