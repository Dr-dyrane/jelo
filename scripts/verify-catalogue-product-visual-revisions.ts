import equivalenceManifestSource from '../data/catalogue-package-revision-equivalences.json';
import visualManifestSource from '../data/catalogue-product-visual-revisions.json';
import {
  verifyCataloguePackageRevisionEquivalenceManifest,
  verifyCatalogueProductVisualRevisionArtifacts,
  verifyCatalogueProductVisualRevisionManifest,
} from '../lib/catalogue/product-visual-revision';

async function main() {
  const visualManifest = verifyCatalogueProductVisualRevisionManifest(visualManifestSource);
  const equivalenceManifest = verifyCataloguePackageRevisionEquivalenceManifest(
    equivalenceManifestSource,
    visualManifest,
  );
  await verifyCatalogueProductVisualRevisionArtifacts(visualManifest, equivalenceManifest);
  console.log(
    `Verified ${visualManifest.revisions.length} immutable product visual revisions, `
    + `${visualManifest.rejectedCandidateAssets.length} rejected candidate asset, and `
    + `${equivalenceManifest.equivalences.length} exact-size official packaging equivalence.`,
  );
  console.log('Historical retailer matching remains text-bound, same-host, exact-size, and non-publication authority.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
