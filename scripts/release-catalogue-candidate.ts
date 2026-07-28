import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  cataloguePublicationApprovalScope,
  catalogueReferencePublicationApprovalScope,
  createVerifiedCataloguePublicationDossier,
  type CataloguePublicationDossierManifest,
} from '@/lib/catalogue/publication-dossier';
import {
  cataloguePublicationReleaseApprovalScope,
  createVerifiedCataloguePublicationRelease,
  type CataloguePublicationPresentation,
} from '@/lib/catalogue/publication-release';
import type {
  CatalogueIntakeCandidate,
  CatalogueIntakeManifest,
} from '@/lib/catalogue/intake-readiness';
import {
  assertCataloguePublicationWriteBoundary,
  cataloguePublicationBytesSha256,
  cataloguePublicationProjectionDiff,
  cataloguePublicationSourceRecord,
  cataloguePublicationSourceSnapshotSha256,
  compileCataloguePublicationSources,
  readCataloguePublicationSourceFiles,
  stableCataloguePublicationJson,
  writeCataloguePublicationProjectionsAtomically,
  writeCataloguePublicationSourceAtomically,
  type CataloguePublicationCompilation,
} from '@/lib/catalogue/publication-source';
import type { CataloguePublicationReleaseManifest } from '@/lib/catalogue/publication-release';

const root = process.cwd();
const intakePath = path.join(root, 'data/catalogue-intake.json');
const dossierPath = path.join(root, 'data/catalogue-publication-dossiers.json');
const releasePath = path.join(root, 'data/catalogue-publication-releases.json');

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name}.`);
  return value;
}

function optionalOption(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function parsedTimestamp(value: string, label: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO timestamp.`);
  return parsed;
}

function isRetryableCompilerRace(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('changed after compilation')
    || message.includes('compiler is already running')
  );
}

async function synchronizePublicationProjections(
  candidates: readonly CatalogueIntakeCandidate[],
  asOf: number,
): Promise<{ compilation: CataloguePublicationCompilation; wrote: boolean }> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [sourceFiles, dossierBytes, releaseBytes] = await Promise.all([
      readCataloguePublicationSourceFiles(root),
      readFile(dossierPath, 'utf8'),
      readFile(releasePath, 'utf8'),
    ]);
    const compilation = compileCataloguePublicationSources(candidates, sourceFiles, asOf);
    const currentDossiers = JSON.parse(dossierBytes) as CataloguePublicationDossierManifest;
    const currentReleases = JSON.parse(releaseBytes) as CataloguePublicationReleaseManifest;
    const diff = cataloguePublicationProjectionDiff(
      currentDossiers,
      currentReleases,
      compilation,
    );
    assertCataloguePublicationWriteBoundary(diff);
    const changed = (
      stableCataloguePublicationJson(currentDossiers)
        !== stableCataloguePublicationJson(compilation.dossierManifest)
      || stableCataloguePublicationJson(currentReleases)
        !== stableCataloguePublicationJson(compilation.releaseManifest)
    );
    if (!changed) return { compilation, wrote: false };

    try {
      await writeCataloguePublicationProjectionsAtomically({
        repositoryRoot: root,
        dossierManifest: compilation.dossierManifest,
        releaseManifest: compilation.releaseManifest,
        expectedDossierProjectionSha256: cataloguePublicationBytesSha256(dossierBytes),
        expectedReleaseProjectionSha256: cataloguePublicationBytesSha256(releaseBytes),
        expectedSourceSnapshotSha256: cataloguePublicationSourceSnapshotSha256(sourceFiles),
      });
      return { compilation, wrote: true };
    } catch (error) {
      if (!isRetryableCompilerRace(error) || attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  throw new Error('Catalogue publication projections could not be synchronized.');
}

async function main() {
  const candidateId = option('candidate');
  const approvedAt = option('approved-at');
  const reviewedAt = option('presentation-reviewed-at');
  const publishedAt = option('published-at');
  const presentation: CataloguePublicationPresentation = {
    category: option('category') as CataloguePublicationPresentation['category'],
    routineStep: option('routine-step'),
    displayLine: option('display-line'),
    usage: option('usage'),
    manufacturerDirectionsUrl: option('directions-url'),
    reviewer: optionalOption('presentation-reviewer') ?? 'JeloCare catalogue presentation reviewer',
    reviewedAt,
  };
  const approvalReviewer = optionalOption('approval-reviewer')
    ?? 'JeloCare catalogue publication reviewer';
  const releaseReviewer = optionalOption('release-reviewer')
    ?? 'JeloCare catalogue release reviewer';
  const referenceOnly = process.argv.includes('--reference-only');
  const write = process.argv.includes('--write');
  const asOf = Date.now();

  if (
    parsedTimestamp(approvedAt, 'Dossier approval')
    > parsedTimestamp(reviewedAt, 'Presentation review')
  ) throw new Error('Presentation review must not predate dossier approval.');
  if (
    parsedTimestamp(reviewedAt, 'Presentation review')
    > parsedTimestamp(publishedAt, 'Publication')
  ) throw new Error('Publication must not predate presentation review.');

  const intake = JSON.parse(await readFile(intakePath, 'utf8')) as CatalogueIntakeManifest;
  const sourceFiles = await readCataloguePublicationSourceFiles(root);
  const candidate = intake.candidates.find(item => item.id === candidateId);
  if (!candidate) throw new Error(`Unknown catalogue candidate: ${candidateId}`);

  const dossier = await createVerifiedCataloguePublicationDossier(
    candidate as CatalogueIntakeCandidate,
    {
      scope: referenceOnly
        ? catalogueReferencePublicationApprovalScope
        : cataloguePublicationApprovalScope,
      reviewer: approvalReviewer,
      approvedAt,
    },
    { repositoryRoot: root, asOf },
  );
  const release = await createVerifiedCataloguePublicationRelease(
    candidate as CatalogueIntakeCandidate,
    dossier,
    presentation,
    {
      scope: cataloguePublicationReleaseApprovalScope,
      reviewer: releaseReviewer,
      publishedAt,
    },
    { repositoryRoot: root, asOf },
  );
  const source = cataloguePublicationSourceRecord(dossier, release);
  const sourceFilename = `${candidateId}.json`;
  const existingSource = sourceFiles.find(file => file.filename === sourceFilename);
  if (
    existingSource
    && stableCataloguePublicationJson(existingSource.value)
      !== stableCataloguePublicationJson(source)
  ) {
    throw new Error(`${candidateId} already has a different immutable publication source.`);
  }
  compileCataloguePublicationSources(
    intake.candidates,
    existingSource
      ? sourceFiles
      : [...sourceFiles, { filename: sourceFilename, value: source }],
    asOf,
  );

  if (write) {
    const sourceWrite = await writeCataloguePublicationSourceAtomically(source, root);
    const synchronized = await synchronizePublicationProjections(
      intake.candidates,
      asOf,
    );
    if (!synchronized.compilation.sourceByCandidateId.has(candidateId)) {
      throw new Error(`${candidateId} was not retained by the publication compiler.`);
    }
    console.log(sourceWrite.created
      ? `Created immutable source data/catalogue-publication-sources/${candidateId}.json.`
      : `Reused matching immutable source data/catalogue-publication-sources/${candidateId}.json.`);
    console.log(synchronized.wrote
      ? 'Rebuilt both publication projections under the compiler lock.'
      : 'Publication projections already matched.');
  }

  console.log(`${write ? 'Released' : 'Validated'} ${candidateId}.`);
  console.log(`Dossier ${dossier.dossierFingerprint}`);
  console.log(`Release ${release.releaseFingerprint}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
