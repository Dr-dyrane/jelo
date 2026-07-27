import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { products } from '../data/catalogue';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { publishedIntakeProducts } from '../data/published-intake-products';
import {
  parsePublicCatalogueSearchArtifact,
  publicCatalogueSearchSchemaVersion,
  type PublicCatalogueSearchArtifact,
} from '../lib/catalogue/public-catalogue-search';

const artifactPath = path.join(process.cwd(), 'data', 'public-catalogue-search.json');

export function buildPublicCatalogueSearchArtifact(): PublicCatalogueSearchArtifact {
  const releasedSlugs = new Set(publishedIntakeProducts.map(product => product.slug));
  const approvedGtinBySlug = new Map(
    catalogueIntakeCandidates
      .filter(candidate => releasedSlugs.has(candidate.id))
      .flatMap(candidate => candidate.identity.gtin
        ? [[candidate.id, candidate.identity.gtin] as const]
        : []),
  );

  return parsePublicCatalogueSearchArtifact({
    schemaVersion: publicCatalogueSearchSchemaVersion,
    exposure: 'public-catalogue-search',
    products: products
      .map(product => ({
        slug: product.slug,
        brand: product.brand,
        name: product.name,
        size: product.size,
        approvedGtin: approvedGtinBySlug.get(product.slug) ?? null,
        source: releasedSlugs.has(product.slug)
          ? 'dossier-release' as const
          : 'reviewed-catalogue' as const,
      }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
  });
}

function serializedArtifact() {
  return `${JSON.stringify(buildPublicCatalogueSearchArtifact(), null, 2)}\n`;
}

async function main() {
  const serialized = serializedArtifact();
  if (process.argv.includes('--print')) {
    process.stdout.write(serialized);
    return;
  }
  if (process.argv.includes('--write')) {
    await writeFile(artifactPath, serialized, 'utf8');
    console.log(`Wrote ${buildPublicCatalogueSearchArtifact().products.length} public catalogue search records.`);
    return;
  }

  const current = await readFile(artifactPath, 'utf8').catch(() => '');
  if (current !== serialized) {
    throw new Error('Public catalogue search artifact drifted. Run npm run catalogue:search:build.');
  }
  console.log(`Verified ${buildPublicCatalogueSearchArtifact().products.length} public catalogue search records.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
