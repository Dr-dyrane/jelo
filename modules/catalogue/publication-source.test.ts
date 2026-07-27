import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import checkedInDossiers from '@/data/catalogue-publication-dossiers.json';
import checkedInReleases from '@/data/catalogue-publication-releases.json';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
import type { CataloguePublicationDossierManifest } from '@/lib/catalogue/publication-dossier';
import type { CataloguePublicationReleaseManifest } from '@/lib/catalogue/publication-release';
import {
  assertCataloguePublicationProjectionMatches,
  assertCataloguePublicationWriteBoundary,
  cataloguePublicationBytesSha256,
  cataloguePublicationSourceSnapshotSha256,
  compileCataloguePublicationSources,
  readCataloguePublicationSourceFiles,
  stableCataloguePublicationJson,
  writeCataloguePublicationProjectionsAtomically,
  writeCataloguePublicationSourceAtomically,
  type CataloguePublicationProjectionDiff,
  type CataloguePublicationSourceFile,
  type CataloguePublicationSourceRecord,
} from '@/lib/catalogue/publication-source';

const repositoryRoot = process.cwd();
const asOf = Date.parse('2026-07-27T16:00:00Z');
const dossierManifest = checkedInDossiers as CataloguePublicationDossierManifest;
const releaseManifest = checkedInReleases as CataloguePublicationReleaseManifest;

async function currentSources() {
  return readCataloguePublicationSourceFiles(repositoryRoot);
}

test('checked-in per-SKU publication sources compile deterministically to both projections', async () => {
  const files = await currentSources();
  const compilation = compileCataloguePublicationSources(
    catalogueIntakeCandidates,
    files,
    asOf,
  );
  assert.equal(compilation.sources.length, dossierManifest.dossiers.length);
  assert.equal(
    compilation.releaseManifest.releases.length,
    releaseManifest.releases.length,
  );
  assertCataloguePublicationProjectionMatches(
    dossierManifest,
    releaseManifest,
    compilation,
  );

  const reversed = compileCataloguePublicationSources(
    catalogueIntakeCandidates,
    [...files].reverse(),
    asOf,
  );
  assert.equal(
    stableCataloguePublicationJson(reversed.dossierManifest),
    stableCataloguePublicationJson(compilation.dossierManifest),
  );
  assert.equal(
    stableCataloguePublicationJson(reversed.releaseManifest),
    stableCataloguePublicationJson(compilation.releaseManifest),
  );
});

test('source filename, candidate and release bindings fail closed', async () => {
  const files = await currentSources();
  const first = files[0];
  assert.throws(
    () => compileCataloguePublicationSources(
      catalogueIntakeCandidates,
      [...files, structuredClone(first)],
      asOf,
    ),
    /Duplicate catalogue publication source candidate/,
  );
  assert.throws(
    () => compileCataloguePublicationSources(
      catalogueIntakeCandidates,
      [{ ...first, filename: `wrong-${first.filename}` }, ...files.slice(1)],
      asOf,
    ),
    /does not match candidate ID/,
  );

  const changed = structuredClone(first) as CataloguePublicationSourceFile;
  const value = changed.value as CataloguePublicationSourceRecord;
  assert.ok(value.release);
  value.release.dossierFingerprint = '0'.repeat(64);
  assert.throws(
    () => compileCataloguePublicationSources(
      catalogueIntakeCandidates,
      [changed, ...files.slice(1)],
      asOf,
    ),
    /release is not bound to its dossier/,
  );
});

test('projection drift is detected even when both projections remain individually valid', async () => {
  const compilation = compileCataloguePublicationSources(
    catalogueIntakeCandidates,
    await currentSources(),
    asOf,
  );
  const reorderedDossiers: CataloguePublicationDossierManifest = {
    ...dossierManifest,
    dossiers: [...dossierManifest.dossiers].reverse(),
  };
  assert.throws(
    () => assertCataloguePublicationProjectionMatches(
      reorderedDossiers,
      releaseManifest,
      compilation,
    ),
    /projections are stale/,
  );
  const reorderedReleases: CataloguePublicationReleaseManifest = {
    ...releaseManifest,
    releases: [...releaseManifest.releases].reverse(),
  };
  assert.throws(
    () => assertCataloguePublicationProjectionMatches(
      dossierManifest,
      reorderedReleases,
      compilation,
    ),
    /projections are stale/,
  );
});

test('the compiler write boundary refuses removals and oversized publication batches', () => {
  const empty: CataloguePublicationProjectionDiff = {
    newDossierIds: [],
    changedDossierIds: [],
    removedDossierIds: [],
    newReleaseIds: [],
    changedReleaseIds: [],
    removedReleaseIds: [],
    changedOrNewCount: 0,
  };
  assert.throws(
    () => assertCataloguePublicationWriteBoundary({
      ...empty,
      removedDossierIds: ['removed-product'],
    }),
    /cannot remove records/,
  );
  assert.throws(
    () => assertCataloguePublicationWriteBoundary({
      ...empty,
      changedOrNewCount: 13,
    }),
    /maximum is 12/,
  );
  assert.doesNotThrow(() => assertCataloguePublicationWriteBoundary({
    ...empty,
    changedOrNewCount: 12,
  }));
});

test('a per-SKU source write is immutable and an exact retry is idempotent', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'jelocare-publication-source-'));
  try {
    const files = await currentSources();
    const record = structuredClone(files[0].value) as CataloguePublicationSourceRecord;
    const first = await writeCataloguePublicationSourceAtomically(record, temporaryRoot);
    const retry = await writeCataloguePublicationSourceAtomically(record, temporaryRoot);
    assert.equal(first.created, true);
    assert.equal(retry.created, false);

    const changed = structuredClone(record);
    changed.dossier.approval.reviewer = 'Different reviewer';
    await assert.rejects(
      writeCataloguePublicationSourceAtomically(changed, temporaryRoot),
      /different immutable publication source/,
    );
    const sourceRoot = path.join(
      temporaryRoot,
      'data/catalogue-publication-sources',
    );
    assert.deepEqual(
      (await readdir(sourceRoot)).filter(name => name.startsWith('.')),
      [],
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

type ProjectionFixture = {
  temporaryRoot: string;
  dataRoot: string;
  dossierPath: string;
  releasePath: string;
  originalDossierBytes: string;
  originalReleaseBytes: string;
  sourceFiles: CataloguePublicationSourceFile[];
};

async function projectionFixture(): Promise<ProjectionFixture> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'jelocare-publication-cas-'));
  const dataRoot = path.join(temporaryRoot, 'data');
  const sourceRoot = path.join(dataRoot, 'catalogue-publication-sources');
  const dossierPath = path.join(dataRoot, 'catalogue-publication-dossiers.json');
  const releasePath = path.join(dataRoot, 'catalogue-publication-releases.json');
  const originalDossierBytes = '{"oldDossiers":true}\n';
  const originalReleaseBytes = '{"oldReleases":true}\n';
  await mkdir(sourceRoot, { recursive: true });
  await Promise.all([
    writeFile(dossierPath, originalDossierBytes),
    writeFile(releasePath, originalReleaseBytes),
    writeFile(path.join(sourceRoot, 'source.json'), '{"source":1}\n'),
  ]);
  return {
    temporaryRoot,
    dataRoot,
    dossierPath,
    releasePath,
    originalDossierBytes,
    originalReleaseBytes,
    sourceFiles: await readCataloguePublicationSourceFiles(temporaryRoot),
  };
}

function projectionWrite(fixture: ProjectionFixture) {
  return {
    repositoryRoot: fixture.temporaryRoot,
    dossierManifest: {
      schemaVersion: 8,
      exposure: 'private-only',
      dossiers: [],
    } as CataloguePublicationDossierManifest,
    releaseManifest: {
      schemaVersion: 2,
      exposure: 'public-catalogue',
      releases: [],
    } as CataloguePublicationReleaseManifest,
    expectedDossierProjectionSha256: cataloguePublicationBytesSha256(
      fixture.originalDossierBytes,
    ),
    expectedReleaseProjectionSha256: cataloguePublicationBytesSha256(
      fixture.originalReleaseBytes,
    ),
    expectedSourceSnapshotSha256: cataloguePublicationSourceSnapshotSha256(
      fixture.sourceFiles,
    ),
  };
}

test('the two-projection CAS writer rejects stale dossiers, releases and sources', async () => {
  const fixture = await projectionFixture();
  try {
    const write = projectionWrite(fixture);
    await assert.rejects(
      writeCataloguePublicationProjectionsAtomically({
        ...write,
        expectedDossierProjectionSha256: '0'.repeat(64),
      }),
      /dossier projection changed after compilation/,
    );
    await assert.rejects(
      writeCataloguePublicationProjectionsAtomically({
        ...write,
        expectedReleaseProjectionSha256: '0'.repeat(64),
      }),
      /release projection changed after compilation/,
    );
    await writeFile(
      path.join(fixture.dataRoot, 'catalogue-publication-sources/second.json'),
      '{"source":2}\n',
    );
    await assert.rejects(
      writeCataloguePublicationProjectionsAtomically(write),
      /sources changed after compilation/,
    );
    assert.equal(
      await readFile(fixture.dossierPath, 'utf8'),
      fixture.originalDossierBytes,
    );
    assert.equal(
      await readFile(fixture.releasePath, 'utf8'),
      fixture.originalReleaseBytes,
    );
  } finally {
    await rm(fixture.temporaryRoot, { recursive: true, force: true });
  }
});

test('concurrent projection writers have one winner and leave a coherent pair', async () => {
  const fixture = await projectionFixture();
  try {
    const write = projectionWrite(fixture);
    const results = await Promise.allSettled([
      writeCataloguePublicationProjectionsAtomically(write),
      writeCataloguePublicationProjectionsAtomically(write),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.deepEqual(
      JSON.parse(await readFile(fixture.dossierPath, 'utf8')) as unknown,
      write.dossierManifest,
    );
    assert.deepEqual(
      JSON.parse(await readFile(fixture.releasePath, 'utf8')) as unknown,
      write.releaseManifest,
    );
    assert.deepEqual(
      (await readdir(fixture.dataRoot)).filter(name => (
        name.includes('.tmp')
        || name.includes('.rollback')
        || name.includes('.lock')
      )),
      [],
    );
  } finally {
    await rm(fixture.temporaryRoot, { recursive: true, force: true });
  }
});
