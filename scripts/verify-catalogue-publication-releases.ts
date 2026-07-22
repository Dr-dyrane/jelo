import dossierManifest from '../data/catalogue-publication-dossiers.json';
import releaseManifest from '../data/catalogue-publication-releases.json';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { verifyCataloguePublicationReleaseManifest } from '../lib/catalogue/publication-release';

function main() {
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
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
