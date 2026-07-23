import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  cataloguePublicationApprovalScope,
  createCataloguePublicationDossier,
  verifyCataloguePublicationDossierManifest,
  type CataloguePublicationDossierManifest,
} from '@/lib/catalogue/publication-dossier';
import {
  cataloguePublicationReleaseApprovalScope,
  createCataloguePublicationRelease,
  verifyCataloguePublicationReleaseManifest,
  type CataloguePublicationPresentation,
  type CataloguePublicationReleaseManifest,
} from '@/lib/catalogue/publication-release';
import type {
  CatalogueIntakeCandidate,
  CatalogueIntakeManifest,
} from '@/lib/catalogue/intake-readiness';

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

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(filename, 'utf8')) as T;
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeAtomically(filename: string, value: unknown) {
  const temporary = `${filename}.tmp-${process.pid}`;
  await writeFile(temporary, json(value), 'utf8');
  await rename(temporary, filename);
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

  const intake = await readJson<CatalogueIntakeManifest>(intakePath);
  const dossierManifest = await readJson<CataloguePublicationDossierManifest>(dossierPath);
  const releaseManifest = await readJson<CataloguePublicationReleaseManifest>(releasePath);
  const candidate = intake.candidates.find(item => item.id === candidateId);
  if (!candidate) throw new Error(`Unknown catalogue candidate: ${candidateId}`);
  if (dossierManifest.dossiers.some(item => item.candidateId === candidateId)) {
    throw new Error(`${candidateId} already has a publication dossier.`);
  }
  if (releaseManifest.releases.some(item => item.candidateId === candidateId)) {
    throw new Error(`${candidateId} already has a publication release.`);
  }

  const dossier = createCataloguePublicationDossier(
    candidate as CatalogueIntakeCandidate,
    {
      scope: cataloguePublicationApprovalScope,
      reviewer: approvalReviewer,
      approvedAt,
    },
    asOf,
  );
  const release = createCataloguePublicationRelease(
    dossier,
    presentation,
    {
      scope: cataloguePublicationReleaseApprovalScope,
      reviewer: releaseReviewer,
      publishedAt,
    },
    asOf,
  );
  const nextDossiers: CataloguePublicationDossierManifest = {
    ...dossierManifest,
    dossiers: [...dossierManifest.dossiers, dossier],
  };
  const nextReleases: CataloguePublicationReleaseManifest = {
    ...releaseManifest,
    releases: [...releaseManifest.releases, release],
  };

  verifyCataloguePublicationDossierManifest(intake.candidates, nextDossiers, asOf);
  verifyCataloguePublicationReleaseManifest(intake.candidates, nextDossiers, nextReleases, asOf);

  if (write) {
    await writeAtomically(dossierPath, nextDossiers);
    await writeAtomically(releasePath, nextReleases);
  }

  console.log(`${write ? 'Released' : 'Validated'} ${candidateId}.`);
  console.log(`Dossier ${dossier.dossierFingerprint}`);
  console.log(`Release ${release.releaseFingerprint}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
