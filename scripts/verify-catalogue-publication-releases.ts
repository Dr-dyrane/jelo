import dossierManifest from '../data/catalogue-publication-dossiers.json';
import releaseManifest from '../data/catalogue-publication-releases.json';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import type { CataloguePublicationDossierManifest } from '../lib/catalogue/publication-dossier';
import { verifyCataloguePublicationReleaseManifest } from '../lib/catalogue/publication-release';
import type { CataloguePublicationReleaseManifest } from '../lib/catalogue/publication-release';
import {
  assertCataloguePublicationProjectionMatches,
  compileCataloguePublicationSources,
  readCataloguePublicationSourceFiles,
} from '../lib/catalogue/publication-source';

async function main() {
  const sourceFiles = await readCataloguePublicationSourceFiles();
  const compilation = compileCataloguePublicationSources(
    catalogueIntakeCandidates,
    sourceFiles,
  );
  assertCataloguePublicationProjectionMatches(
    dossierManifest as CataloguePublicationDossierManifest,
    releaseManifest as CataloguePublicationReleaseManifest,
    compilation,
  );
  const report = verifyCataloguePublicationReleaseManifest(
    catalogueIntakeCandidates,
    dossierManifest,
    releaseManifest,
  );

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      schemaVersion: report.schemaVersion,
      exposure: report.exposure,
      releaseCount: report.releaseCount,
      releases: report.releases.map(release => ({
        candidateId: release.candidateId,
        dossierFingerprint: release.dossierFingerprint,
        releaseFingerprint: release.releaseFingerprint,
        publishedAt: release.publication.publishedAt,
        reviewer: release.publication.reviewer,
      })),
    }, null, 2));
    return;
  }

  console.log(`Verified ${report.releaseCount} explicit public catalogue releases.`);
  console.log(`Materialized ${report.products.length} dossier-bound public products.`);
  console.log(
    `${compilation.sources.length} immutable per-SKU sources compile to both checked-in projections.`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
