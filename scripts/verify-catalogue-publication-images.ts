import manifest from '../data/catalogue-publication-dossiers.json';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { verifyCataloguePublicationDossierManifest } from '../lib/catalogue/publication-dossier';
import { verifyRemoteCataloguePublicationImage } from '../lib/catalogue/publication-image-verification';

async function main() {
  const structural = verifyCataloguePublicationDossierManifest(catalogueIntakeCandidates, manifest);
  const verified = [];
  const concurrency = 2;
  for (let offset = 0; offset < structural.dossiers.length; offset += concurrency) {
    const batch = structural.dossiers.slice(offset, offset + concurrency);
    verified.push(...await Promise.all(batch.map(dossier => verifyRemoteCataloguePublicationImage({
      candidateId: dossier.candidateId,
      ...dossier.finalImage,
    }))));
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(verified, null, 2));
    return;
  }
  console.log(`Verified ${verified.length} private publication images by trusted URL, bytes, hash, decode, alpha, edges and surfaces.`);
  console.log('Published 0 products. Remote image verification is evidence, not publication permission.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
