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

export function isPublishedIntakeProduct(productSlug: string) {
  return publishedIntakeSlugs.has(productSlug);
}
