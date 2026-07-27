import specifications from '../data/catalogue-packshot-generation-specifications.json';
import dossierManifest from '../data/catalogue-publication-dossiers.json';
import releaseManifest from '../data/catalogue-publication-releases.json';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { verifyCatalogueIdentityEvidenceArtifacts } from '../lib/catalogue/identity-evidence-artifact';
import { verifyCataloguePackshotGenerationSpecificationManifest } from '../lib/catalogue/packshot-generation-specification';

function candidateIds(
  value: unknown,
  key: 'dossiers' | 'releases',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${key} manifest is invalid.`);
  }
  const records = (value as Record<string, unknown>)[key];
  if (!Array.isArray(records)) throw new Error(`${key} manifest is invalid.`);
  return records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`${key}[${index}] is invalid.`);
    }
    const candidateId = (record as Record<string, unknown>).candidateId;
    if (typeof candidateId !== 'string' || !candidateId) {
      throw new Error(`${key}[${index}] candidate ID is invalid.`);
    }
    return candidateId;
  });
}

async function main() {
  await verifyCatalogueIdentityEvidenceArtifacts(catalogueIntakeCandidates);
  const report = verifyCataloguePackshotGenerationSpecificationManifest(
    specifications,
    catalogueIntakeCandidates,
    {
      dossierCandidateIds: candidateIds(dossierManifest, 'dossiers'),
      releaseCandidateIds: candidateIds(releaseManifest, 'releases'),
    },
  );

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `Verified ${report.specificationCount} exact-source private packshot generation plans.`,
  );
  console.log(
    'Plans bind inputs and review requirements only; none claims output, rights, art review or publication.',
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
