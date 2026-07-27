import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertCatalogueIntakeWriteBoundary,
  catalogueIntakeBytesSha256,
  catalogueIntakeProjectionDiff,
  catalogueIntakeSourceSnapshotSha256,
  compileCatalogueIntakeSources,
  readCatalogueIntakeSourceFiles,
  stableCatalogueJson,
  validateCatalogueIntakeCompilation,
  writeCatalogueIntakeProjectionAtomically,
  type CatalogueIntakeCompilation,
  type CatalogueIntakeProjectionDiff,
  type CatalogueIntakeSourceFile,
  type CatalogueIntakeSourceRecord,
} from '@/lib/catalogue/intake-source';
import {
  evaluateCatalogueIntakeCandidate,
  type CatalogueIntakeManifest,
} from '@/lib/catalogue/intake-readiness';

const repositoryRoot = process.cwd();
// This fixed verification instant must remain later than every checked-in
// source, dossier and release timestamp represented by the fixture.
const asOf = Date.parse('2026-07-28T00:00:00Z');

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(repositoryRoot, relativePath), 'utf8')) as unknown;
}

async function currentFixture() {
  const [files, manifest, dossiers, releases] = await Promise.all([
    readCatalogueIntakeSourceFiles(repositoryRoot),
    readJson('data/catalogue-intake.json') as Promise<CatalogueIntakeManifest>,
    readJson('data/catalogue-publication-dossiers.json'),
    readJson('data/catalogue-publication-releases.json'),
  ]);
  return { files, manifest, dossiers, releases };
}

function sourceValue(file: CatalogueIntakeSourceFile) {
  return structuredClone(file.value) as Record<string, unknown>;
}

function replaceSource(
  files: readonly CatalogueIntakeSourceFile[],
  candidateId: string,
  mutate: (value: Record<string, unknown>) => void,
) {
  return files.map(file => {
    if (file.filename !== `${candidateId}.json`) return file;
    const value = sourceValue(file);
    mutate(value);
    return { ...file, value };
  });
}

test('checked-in per-SKU sources compile to the current runtime projection independent of file order', async () => {
  const { files, manifest } = await currentFixture();
  const forward = compileCatalogueIntakeSources(files, asOf).manifest;
  const reverse = compileCatalogueIntakeSources([...files].reverse(), asOf).manifest;
  assert.deepEqual(forward, manifest);
  assert.deepEqual(reverse, manifest);
  assert.equal(stableCatalogueJson(forward), stableCatalogueJson(reverse));
});

test('source envelopes reject filename drift and timestamps older than nested evidence', async () => {
  const { files } = await currentFixture();
  const first = files[0];
  assert.throws(
    () => compileCatalogueIntakeSources([
      ...files.slice(1),
      { filename: `wrong-${first.filename}`, value: first.value },
    ], asOf),
    /does not match candidate ID/,
  );

  const stale = replaceSource(
    files,
    'keracare-dry-itchy-scalp-conditioner-950ml',
    value => {
      value.updatedAt = '2026-07-20T00:00:00Z';
    },
  );
  assert.throws(
    () => compileCatalogueIntakeSources(stale, asOf),
    /timestamp predates evidence or review activity/,
  );
});

test('source envelopes reject unsupported fields and duplicate packet origins', async () => {
  const { files } = await currentFixture();
  const withUnknown = replaceSource(
    files,
    'keracare-dry-itchy-scalp-conditioner-950ml',
    value => {
      value.contributorId = 'must-never-enter-this-envelope';
    },
  );
  assert.throws(
    () => compileCatalogueIntakeSources(withUnknown, asOf),
    /unsupported fields: contributorId/,
  );

  const candidateIds = [
    'keracare-dry-itchy-scalp-conditioner-950ml',
    'c28f590dd2739ea73f1b5ea3',
  ];
  let duplicated = [...files];
  for (const candidateId of candidateIds) {
    duplicated = replaceSource(duplicated, candidateId, value => {
      delete value.order;
      value.origin = {
        kind: 'static-research-packet',
        packetId: '1920014afae80ba00e4169ca',
        discoveryId: '138dd87819a57f6a7a3f68ca',
        sourceSnapshotSha256: '81e19feb997ec3822660045302f48441533c1780ce3101a800ce12a947093e44',
      };
    });
  }
  assert.throws(
    () => compileCatalogueIntakeSources(duplicated, asOf),
    /Duplicate catalogue intake source origin/,
  );
});

test('the domain audit still rejects duplicate candidate and normalized product identities', async () => {
  const { files } = await currentFixture();
  assert.throws(
    () => compileCatalogueIntakeSources([...files, files[0]], asOf),
    /Duplicate catalogue intake source candidate/,
  );

  const firstValue = sourceValue(files[0]);
  const copiedCandidate = structuredClone(firstValue.candidate) as Record<string, unknown>;
  copiedCandidate.id = 'keracare-dry-itchy-scalp-conditioner-950ml-copy';
  const copied: CatalogueIntakeSourceFile = {
    filename: 'keracare-dry-itchy-scalp-conditioner-950ml-copy.json',
    value: {
      ...firstValue,
      order: files.length,
      origin: {
        kind: 'legacy-deliberate-intake',
        reference: copiedCandidate.id,
      },
      candidate: copiedCandidate,
    },
  };
  assert.throws(
    () => compileCatalogueIntakeSources([...files, copied], asOf),
    /Duplicate catalogue intake GTIN/,
  );

  const copiedWithoutGtin = structuredClone(copied);
  const candidateWithoutGtin = (
    copiedWithoutGtin.value as Record<string, unknown>
  ).candidate as Record<string, unknown>;
  delete (candidateWithoutGtin.identity as Record<string, unknown>).gtin;
  assert.throws(
    () => compileCatalogueIntakeSources([...files, copiedWithoutGtin], asOf),
    /Duplicate catalogue intake identity/,
  );
});

test('write boundaries allow 12 mutations but reject 13, removals and new legacy records', async () => {
  const { files } = await currentFixture();
  const compilation = compileCatalogueIntakeSources(files, asOf);
  const cleanDiff: CatalogueIntakeProjectionDiff = {
    newCandidateIds: [],
    changedCandidateIds: Array.from({ length: 12 }, (_, index) => `changed-${index}`),
    removedCandidateIds: [],
    changedOrNewCount: 12,
  };
  assert.doesNotThrow(() => assertCatalogueIntakeWriteBoundary(cleanDiff, compilation));
  assert.throws(
    () => assertCatalogueIntakeWriteBoundary({
      ...cleanDiff,
      changedCandidateIds: Array.from({ length: 13 }, (_, index) => `changed-${index}`),
      changedOrNewCount: 13,
    }, compilation),
    /maximum is 12/,
  );
  assert.throws(
    () => assertCatalogueIntakeWriteBoundary({
      newCandidateIds: [],
      changedCandidateIds: [],
      removedCandidateIds: ['removed-candidate'],
      changedOrNewCount: 0,
    }, compilation),
    /cannot remove candidates/,
  );

  const candidateId = 'new-legacy-candidate';
  const legacy = {
    ...compilation.sources[0],
    order: compilation.sources.length,
    origin: { kind: 'legacy-deliberate-intake', reference: candidateId },
    candidate: { ...compilation.sources[0].candidate, id: candidateId },
  } as CatalogueIntakeSourceRecord;
  const sourceByCandidateId = new Map(compilation.sourceByCandidateId);
  sourceByCandidateId.set(candidateId, legacy);
  assert.throws(
    () => assertCatalogueIntakeWriteBoundary({
      newCandidateIds: [candidateId],
      changedCandidateIds: [],
      removedCandidateIds: [],
      changedOrNewCount: 1,
    }, { ...compilation, sourceByCandidateId } as CatalogueIntakeCompilation),
    /require a packet-bound origin/,
  );

  const legacyCandidate = structuredClone(compilation.sources[0].candidate);
  legacyCandidate.id = candidateId;
  legacyCandidate.brand = 'New test brand';
  legacyCandidate.name = 'New test candidate';
  legacyCandidate.variant = 'New test candidate';
  legacyCandidate.identity = {};
  legacyCandidate.care = { status: 'pending', evidenceUrls: [] };
  legacyCandidate.nigeria = {
    regulatoryStatus: 'pending',
    exactOffers: [],
    excludedObservations: [],
  };
  legacyCandidate.asset = { rightsStatus: 'unresolved' };
  assert.throws(
    () => compileCatalogueIntakeSources([
      ...files,
      {
        filename: `${candidateId}.json`,
        value: {
          schemaVersion: 1,
          publicationStatus: 'private-research-only',
          updatedAt: compilation.manifest.updatedAt,
          order: 35,
          origin: { kind: 'legacy-deliberate-intake', reference: candidateId },
          candidate: legacyCandidate,
        },
      },
    ], asOf),
    /fixed 35-record legacy migration cohort/,
  );
});

test('the current compilation verifies identity artifacts, dossiers and releases without publishing intake', async () => {
  const { files, dossiers, releases } = await currentFixture();
  const compilation = compileCatalogueIntakeSources(files, asOf);
  const validation = await validateCatalogueIntakeCompilation(
    compilation,
    dossiers,
    releases,
    repositoryRoot,
    asOf,
  );
  const dossierCount = (
    dossiers as { dossiers: unknown[] }
  ).dossiers.length;
  const releaseCount = (
    releases as { releases: unknown[] }
  ).releases.length;
  assert.deepEqual(validation, {
    candidateCount: compilation.manifest.candidates.length,
    identityArtifactCount: compilation.manifest.candidates.filter(candidate => (
      candidate.identity.officialEvidence
    )).length,
    dossierCount,
    releaseCount,
  });
  const incomplete = compilation.manifest.candidates.find(candidate => (
    candidate.id === 'dang-niacinamide-n-acetyl-glucosamine-serum-30ml'
  ));
  assert.ok(incomplete);
  const decision = evaluateCatalogueIntakeCandidate(incomplete, asOf);
  assert.equal(decision.approvalDraftReady, false);
  assert.equal(decision.stage, 'identity');
});

test('released candidate edits fail against immutable dossier fingerprints', async () => {
  const { files, dossiers, releases } = await currentFixture();
  const changed = replaceSource(files, 'cerave-hydrating-cleanser-473ml', value => {
    const candidate = value.candidate as Record<string, unknown>;
    candidate.reason = `${candidate.reason as string} Changed after release.`;
  });
  const compilation = compileCatalogueIntakeSources(changed, asOf);
  await assert.rejects(
    validateCatalogueIntakeCompilation(
      compilation,
      dossiers,
      releases,
      repositoryRoot,
      asOf,
    ),
    /candidate fingerprint changed; approval is invalid/,
  );
});

test('identity artifact digest tampering fails before dossier and release validation', async () => {
  const { files, dossiers, releases } = await currentFixture();
  const tampered = replaceSource(files, 'cerave-hydrating-cleanser-473ml', value => {
    const candidate = value.candidate as Record<string, unknown>;
    const identity = candidate.identity as Record<string, unknown>;
    const evidence = identity.officialEvidence as Record<string, unknown>;
    evidence.snapshotSha256 = '0'.repeat(64);
  });
  const compilation = compileCatalogueIntakeSources(tampered, asOf);
  await assert.rejects(
    validateCatalogueIntakeCompilation(
      compilation,
      dossiers,
      releases,
      repositoryRoot,
      asOf,
    ),
    /identity evidence hash changed/,
  );
});

test('projection diff is semantic and treats an ID rename as removal plus addition', async () => {
  const { files, manifest } = await currentFixture();
  const compilation = compileCatalogueIntakeSources(files, asOf);
  assert.deepEqual(catalogueIntakeProjectionDiff(manifest, compilation.manifest), {
    newCandidateIds: [],
    changedCandidateIds: [],
    removedCandidateIds: [],
    changedOrNewCount: 0,
  });

  const renamed = structuredClone(compilation.manifest);
  renamed.candidates[0].id = `${renamed.candidates[0].id}-renamed`;
  const diff = catalogueIntakeProjectionDiff(manifest, renamed);
  assert.deepEqual(diff.newCandidateIds, ['keracare-dry-itchy-scalp-conditioner-950ml-renamed']);
  assert.deepEqual(diff.removedCandidateIds, ['keracare-dry-itchy-scalp-conditioner-950ml']);
});

test('the atomic writer refuses stale projection or source snapshots and cleans temporary state', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'jelocare-intake-cas-'));
  const dataRoot = path.join(temporaryRoot, 'data');
  const sourceRoot = path.join(dataRoot, 'catalogue-intake-candidates');
  const projectionPath = path.join(dataRoot, 'catalogue-intake.json');
  try {
    await mkdir(sourceRoot, { recursive: true });
    const originalProjection = '{"old":true}\n';
    await writeFile(projectionPath, originalProjection);
    await writeFile(path.join(sourceRoot, 'one.json'), '{}\n');
    const { manifest } = await currentFixture();
    const initialSources = await readCatalogueIntakeSourceFiles(temporaryRoot);

    await writeFile(path.join(dataRoot, '.catalogue-intake.compiler.lock'), 'other compiler\n');
    await assert.rejects(
      writeCatalogueIntakeProjectionAtomically({
        repositoryRoot: temporaryRoot,
        manifest,
        expectedProjectionSha256: catalogueIntakeBytesSha256(originalProjection),
        expectedSourceSnapshotSha256: catalogueIntakeSourceSnapshotSha256(initialSources),
      }),
      /lock already exists[\s\S]*remove data\/\.catalogue-intake\.compiler\.lock/,
    );
    await unlink(path.join(dataRoot, '.catalogue-intake.compiler.lock'));

    await assert.rejects(
      writeCatalogueIntakeProjectionAtomically({
        repositoryRoot: temporaryRoot,
        manifest,
        expectedProjectionSha256: '0'.repeat(64),
        expectedSourceSnapshotSha256: catalogueIntakeSourceSnapshotSha256(initialSources),
      }),
      /projection changed after compilation/,
    );
    assert.equal(await readFile(projectionPath, 'utf8'), originalProjection);

    await writeFile(path.join(sourceRoot, 'two.json'), '{}\n');
    await assert.rejects(
      writeCatalogueIntakeProjectionAtomically({
        repositoryRoot: temporaryRoot,
        manifest,
        expectedProjectionSha256: catalogueIntakeBytesSha256(originalProjection),
        expectedSourceSnapshotSha256: catalogueIntakeSourceSnapshotSha256(initialSources),
      }),
      /sources changed after compilation/,
    );
    assert.equal(await readFile(projectionPath, 'utf8'), originalProjection);

    const currentSources = await readCatalogueIntakeSourceFiles(temporaryRoot);
    await writeCatalogueIntakeProjectionAtomically({
      repositoryRoot: temporaryRoot,
      manifest,
      expectedProjectionSha256: catalogueIntakeBytesSha256(originalProjection),
      expectedSourceSnapshotSha256: catalogueIntakeSourceSnapshotSha256(currentSources),
    });
    assert.deepEqual(
      JSON.parse(await readFile(projectionPath, 'utf8')) as unknown,
      manifest,
    );
    assert.deepEqual(
      (await readdir(dataRoot)).filter(name => name.includes('.tmp') || name.includes('.lock')),
      [],
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
