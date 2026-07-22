import manifest from '../data/catalogue-publication-dossiers.json';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { verifyCatalogueIdentityEvidenceArtifacts } from '../lib/catalogue/identity-evidence-artifact';
import { verifyCataloguePublicationDossierManifest } from '../lib/catalogue/publication-dossier';

async function main() {
  await verifyCatalogueIdentityEvidenceArtifacts(catalogueIntakeCandidates);
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
    console.log('Published 0 products. Publication remains a separate, unimplemented boundary.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
