import assert from 'node:assert/strict';
import test from 'node:test';
import specifications from '@/data/catalogue-packshot-generation-specifications.json';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
import {
  cataloguePackshotGenerationCandidateIds,
  verifyCataloguePackshotGenerationSpecificationManifest,
} from '@/lib/catalogue/packshot-generation-specification';
import {
  catalogueGenerationRecordSha256,
  evaluateCatalogueIntakeCandidate,
  type CatalogueGenerationRecord,
} from '@/lib/catalogue/intake-readiness';

const asOf = Date.parse('2026-08-08T02:36:00Z');
const completedCandidateIds = [
  'simple-kind-to-skin-refreshing-facial-gel-wash-150ml',
] as const;

test('the completed packshot cohort leaves no unresolved generation plans', () => {
  const report = verifyCataloguePackshotGenerationSpecificationManifest(
    specifications,
    catalogueIntakeCandidates,
    { asOf },
  );
  assert.equal(report.specificationCount, 0);
  assert.deepEqual(report.candidateIds, cataloguePackshotGenerationCandidateIds);
  assert.deepEqual(specifications.specifications, []);
});

test('completed candidates retain exact reviewed image evidence outside the plan', () => {
  for (const candidateId of completedCandidateIds) {
    const candidate = catalogueIntakeCandidates.find(item => item.id === candidateId);
    assert.ok(candidate, candidateId);
    const decision = evaluateCatalogueIntakeCandidate(candidate, asOf);
    assert.equal(decision.stage, 'approval-ready', candidateId);
    assert.equal(decision.approvalDraftReady, true, candidateId);
    assert.equal(candidate.asset.rightsStatus, 'documented', candidateId);
    assert.equal(candidate.asset.role, 'packshot', candidateId);
    assert.match(candidate.asset.publicImageUrl ?? '', /^https:\/\//);
    assert.match(candidate.asset.publicImageSha256 ?? '', /^[0-9a-f]{64}$/);
    assert.equal(candidate.asset.width, 2000);
    assert.equal(candidate.asset.height, 2000);
    assert.equal(candidate.asset.packaging, 'intact');
    assert.equal(candidate.asset.manualSourceOutputQa, true);
    assert.equal(candidate.asset.presentationQuality, 'magazine-ready');
  }
});

test('owned renders retain tamper-evident generation records', () => {
  for (const candidateId of [
    'simple-kind-to-skin-refreshing-facial-gel-wash-150ml',
    'dang-azelaic-acid-serum-30ml',
  ]) {
    const candidate = catalogueIntakeCandidates.find(item => item.id === candidateId);
    assert.ok(candidate, candidateId);
    const record = candidate.asset.generationRecord as CatalogueGenerationRecord | undefined;
    assert.ok(record, candidateId);
    assert.equal(record.outputSha256, candidate.asset.publicImageSha256);
    assert.equal(
      catalogueGenerationRecordSha256({
        schemaVersion: record.schemaVersion,
        provider: record.provider,
        model: record.model,
        prompt: record.prompt,
        inputs: record.inputs,
        outputSha256: record.outputSha256,
        generatedAt: record.generatedAt,
      }),
      record.recordSha256,
      candidateId,
    );
  }
});

test('the DANG record preserves the bottle-only rejected-carton safety rule', () => {
  const candidate = catalogueIntakeCandidates.find(item => (
    item.id === 'dang-azelaic-acid-serum-30ml'
  ));
  assert.ok(candidate);
  const prompt = candidate.asset.generationRecord?.prompt ?? '';
  assert.match(prompt, /single serum bottle/i);
  assert.match(prompt, /carton.*must not appear/i);
  assert.match(prompt, /previously rejected render.*must never be reused/i);
});

test('the empty plan still fails closed on schema or future-time drift', () => {
  assert.throws(
    () => verifyCataloguePackshotGenerationSpecificationManifest(
      { ...specifications, publicationEligible: true },
      catalogueIntakeCandidates,
      { asOf },
    ),
    /cannot publish products/,
  );
  assert.throws(
    () => verifyCataloguePackshotGenerationSpecificationManifest(
      { ...specifications, updatedAt: '2026-08-09T02:36:00Z' },
      catalogueIntakeCandidates,
      { asOf },
    ),
    /invalid or in the future/,
  );
  assert.throws(
    () => verifyCataloguePackshotGenerationSpecificationManifest(
      { ...specifications, specifications: [{}] },
      catalogueIntakeCandidates,
      { asOf },
    ),
    /fields must be exactly/,
  );
});
