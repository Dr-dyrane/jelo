import dossierManifest from './catalogue-publication-dossiers.json';
import releaseManifest from './catalogue-publication-releases.json';
import { catalogueIntakeCandidates } from './catalogue-intake';
import { verifyCataloguePublicationReleaseManifest } from '@/lib/catalogue/publication-release';

export const publishedIntakeReport = verifyCataloguePublicationReleaseManifest(
  catalogueIntakeCandidates,
  dossierManifest,
  releaseManifest,
);

export const publishedIntakeProducts = publishedIntakeReport.products;
const publishedIntakeSlugs = new Set(publishedIntakeProducts.map(product => product.slug));
const releasedIntakeCandidateIds = new Set(
  publishedIntakeReport.releases.map(release => release.candidateId),
);

export function isPublishedIntakeProduct(productSlug: string) {
  return publishedIntakeSlugs.has(productSlug);
}

export function isReleasedIntakeCandidate(candidateId: string) {
  return releasedIntakeCandidateIds.has(candidateId);
}
