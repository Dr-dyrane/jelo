import manifest from '../data/catalogue-publication-dossiers.json';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { verifyCatalogueIdentityEvidenceArtifacts } from '../lib/catalogue/identity-evidence-artifact';
import { verifyCataloguePublicationDossierManifest } from '../lib/catalogue/publication-dossier';
import type { CataloguePublicationDossierManifest } from '../lib/catalogue/publication-dossier';
import releaseManifest from '../data/catalogue-publication-releases.json';
import type { CataloguePublicationReleaseManifest } from '../lib/catalogue/publication-release';
import {
  assertCataloguePublicationProjectionMatches,
  compileCataloguePublicationSources,
  readCataloguePublicationSourceFiles,
} from '../lib/catalogue/publication-source';

async function main() {
  await verifyCatalogueIdentityEvidenceArtifacts(catalogueIntakeCandidates);
  const sourceFiles = await readCataloguePublicationSourceFiles();
  const compilation = compileCataloguePublicationSources(
    catalogueIntakeCandidates,
    sourceFiles,
  );
  assertCataloguePublicationProjectionMatches(
    manifest as CataloguePublicationDossierManifest,
    releaseManifest as CataloguePublicationReleaseManifest,
    compilation,
  );
  const report = verifyCataloguePublicationDossierManifest(catalogueIntakeCandidates, manifest);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      schemaVersion: report.schemaVersion,
      exposure: report.exposure,
      dossierCount: report.dossierCount,
      publicProductCount: report.publicProductCount,
      dossiers: report.dossiers.map(dossier => ({
        candidateId: dossier.candidateId,
        candidateFingerprint: dossier.candidateFingerprint,
        dossierFingerprint: dossier.dossierFingerprint,
        approvedAt: dossier.approval.approvedAt,
        reviewer: dossier.approval.reviewer,
      })),
    }, null, 2));
  } else {
    console.log(`Verified ${report.dossierCount} immutable private publication dossiers.`);
    console.log(
      `${compilation.sources.length} immutable per-SKU sources compile to both checked-in projections.`,
    );
    console.log('Dossiers remain private until an explicit verified release binds their presentation and publication approval.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
