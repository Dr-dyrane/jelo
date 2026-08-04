import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import equivalenceManifestSource from '@/data/catalogue-package-revision-equivalences.json';
import visualManifestSource from '@/data/catalogue-product-visual-revisions.json';
import {
  authorizeHistoricalPackageMatch,
  packagingDisclosureForExactIdentity,
  verifyCataloguePackageRevisionEquivalenceManifest,
  verifyCatalogueProductVisualRevisionArtifacts,
  verifyCatalogueProductVisualRevisionManifest,
  type HistoricalPackageMatchInput,
} from '@/lib/catalogue/product-visual-revision';

const visualManifest = verifyCatalogueProductVisualRevisionManifest(visualManifestSource);
const equivalenceManifest = verifyCataloguePackageRevisionEquivalenceManifest(
  equivalenceManifestSource,
  visualManifest,
);

const exactIdentity = {
  brand: "L'Occitane en Provence",
  canonicalName: 'Almond (Amande) Shower Oil',
  variant: 'Almond (Amande) Softening Shower Oil',
  size: '500 ml',
};

function exactMatch(overrides: Partial<HistoricalPackageMatchInput> = {}): HistoricalPackageMatchInput {
  return {
    candidateId: 'loccitane-almond-shower-oil-500ml',
    ...exactIdentity,
    currentPackageRevisionId: 'loccitane-almond-shower-oil-500ml-package-current-2026',
    historicalPackageRevisionId: 'loccitane-almond-shower-oil-500ml-package-before-2026',
    storeIdentity: exactIdentity,
    storeText: "L'Occitane en Provence Almond (Amande) Shower Oil — Almond (Amande) Softening Shower Oil — 500 ml",
    requestedUrl: 'https://store.example/products/loccitane-almond-shower-oil-500ml',
    finalUrl: 'https://store.example/products/loccitane-almond-shower-oil-500ml',
    ...overrides,
  };
}

test('visual revisions preserve current and historical packaging as immutable linked records', async () => {
  const historical = visualManifest.revisions.find(record => record.package.observedState === 'historical-at-capture');
  const current = visualManifest.revisions.find(record => record.package.observedState === 'current-at-capture');
  assert.ok(historical);
  assert.ok(current);
  assert.equal(current.package.supersedesRevisionId, historical.revisionId);
  assert.equal(historical.asset.publishable, false);
  assert.equal(current.asset.publishable, false);
  assert.notEqual(historical.asset.sha256, current.asset.sha256);
  await verifyCatalogueProductVisualRevisionArtifacts(visualManifest, equivalenceManifest);
});

test('a new current revision appends without rewriting prior immutable records', () => {
  const source = structuredClone(visualManifestSource);
  const priorCurrent = source.revisions.find(record => record.package.observedState === 'current-at-capture');
  assert.ok(priorCurrent);
  const appendedCurrent = structuredClone(priorCurrent);
  appendedCurrent.revisionId = 'loccitane-almond-shower-oil-500ml-package-current-next';
  appendedCurrent.package.supersedesRevisionId = priorCurrent.revisionId;
  source.revisions.push(appendedCurrent);
  const verified = verifyCatalogueProductVisualRevisionManifest(source);
  assert.equal(verified.revisions.length, 3);

  const disjointHead = structuredClone(appendedCurrent);
  disjointHead.revisionId = 'loccitane-almond-shower-oil-500ml-package-disjoint-current';
  disjointHead.package.supersedesRevisionId = null;
  source.revisions.push(disjointHead);
  assert.throws(() => verifyCatalogueProductVisualRevisionManifest(source), /exactly one derived current/);
});

test('private revision records cannot claim publication roles or rights', () => {
  const source = structuredClone(visualManifestSource);
  const current = source.revisions.find(record => record.package.observedState === 'current-at-capture');
  assert.ok(current);
  current.asset.role = 'published-packshot';
  current.provenance.reuseBasis = 'public-reuse';
  assert.throws(() => verifyCatalogueProductVisualRevisionManifest(source), /private official reference/);
});

test('official evidence requirements are code-bound to exact product, size, claim, image and response digests', () => {
  const source = structuredClone(equivalenceManifestSource);
  source.equivalences[0].officialEvidence.requiredRecordText = Array(5).fill('product');
  assert.throws(
    () => verifyCataloguePackageRevisionEquivalenceManifest(source, visualManifest),
    /not code-bound/,
  );
});

test('the suspect founder cutout remains preserved but rejected for shadow, stretch, halo, and provenance', () => {
  const [candidate] = visualManifest.rejectedCandidateAssets;
  assert.ok(candidate);
  assert.equal(candidate.review.state, 'rejected');
  assert.deepEqual(new Set(candidate.review.reasons), new Set([
    'oversized-baked-shadow',
    'horizontal-stretch-bands',
    'alpha-edge-colour-fringe',
    'publishable-provenance-unresolved',
  ]));
});

test('official exact-size evidence authorizes only a same-host exact textual 500 ml match', () => {
  assert.deepEqual(authorizeHistoricalPackageMatch(exactMatch(), equivalenceManifest), {
    authorized: true,
    equivalenceId: 'loccitane-almond-shower-oil-500ml-same-formula-new-look-2026',
    displayDisclosure: 'Packaging may vary',
  });
});

test('500 ml packaging history can never authorize the published 250 ml product', () => {
  const decision = authorizeHistoricalPackageMatch(exactMatch({
    candidateId: 'loccitane-almond-softening-shower-oil-250ml',
    size: '250 ml',
    storeIdentity: { ...exactIdentity, size: '250 ml' },
    storeText: "L'Occitane en Provence Almond (Amande) Shower Oil — Almond (Amande) Softening Shower Oil — 250 ml",
  }), equivalenceManifest);
  assert.equal(decision.authorized, false);
});

test('cross-size, lookalike identity, altered revision, redirect host, and incomplete store text fail closed', () => {
  const failures: HistoricalPackageMatchInput[] = [
    exactMatch({ size: '250 ml', storeIdentity: { ...exactIdentity, size: '250 ml' } }),
    exactMatch({ brand: "L'Occitane Pro", storeIdentity: { ...exactIdentity, brand: "L'Occitane Pro" } }),
    exactMatch({ variant: 'Almond Supple Skin Oil', storeIdentity: { ...exactIdentity, variant: 'Almond Supple Skin Oil' } }),
    exactMatch({ historicalPackageRevisionId: 'visually-similar-unreviewed-package' }),
    exactMatch({ finalUrl: 'https://lookalike.example/products/loccitane' }),
    exactMatch({ finalUrl: 'https://store.example:8443/products/loccitane' }),
    exactMatch({ storeText: "L'Occitane en Provence Almond (Amande) Shower Oil — Almond (Amande) Softening Shower Oil — 2500 ml" }),
    exactMatch({ storeText: "L'Occitane Almond Shower Oil" }),
  ];
  failures.forEach(input => assert.equal(authorizeHistoricalPackageMatch(input, equivalenceManifest).authorized, false));
});

test('artifact verification rejects a symlinked data ancestor', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'catalogue-visual-revision-'));
  try {
    await symlink(path.resolve(process.cwd(), 'data'), path.join(temporaryRoot, 'data'));
    await assert.rejects(
      verifyCatalogueProductVisualRevisionArtifacts(visualManifest, equivalenceManifest, temporaryRoot),
      /data directory must not be a symlink/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('image similarity alone has no authority', () => {
  const input = {
    ...exactMatch({
      size: '250 ml',
      storeIdentity: { ...exactIdentity, size: '250 ml' },
    }),
    imageSimilarity: 1,
  } as HistoricalPackageMatchInput & { imageSimilarity: number };
  assert.equal(authorizeHistoricalPackageMatch(input, equivalenceManifest).authorized, false);
});

test('Packaging may vary is exposed only for the exact reviewed 500 ml identity', () => {
  assert.equal(packagingDisclosureForExactIdentity({
    candidateId: 'loccitane-almond-shower-oil-500ml',
    ...exactIdentity,
  }, equivalenceManifest), 'Packaging may vary');
  assert.equal(packagingDisclosureForExactIdentity({
    candidateId: 'loccitane-almond-softening-shower-oil-250ml',
    ...exactIdentity,
    size: '250 ml',
  }, equivalenceManifest), null);
});
