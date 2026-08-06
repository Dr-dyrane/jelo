import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { products } from '../data/catalogue';
import { catalogueIntakeCandidates } from '../data/catalogue-intake';
import { publishedIntakeProducts } from '../data/published-intake-products';
import { canonicalBrandName, canonicalBrandNameMap } from '../data/brand-canonical-names';
import {
  parsePublicCatalogueSearchArtifact,
  publicCatalogueSearchSchemaVersion,
  type PublicCatalogueSearchArtifact,
} from '../lib/catalogue/public-catalogue-search';

const artifactPath = path.join(process.cwd(), 'data', 'public-catalogue-search.json');

/**
 * Scrubs the catalogue for brand names that normalize to the same canonical
 * form but are not in the canonical brand map. This catches future duplicates
 * before they ship.
 */
function assertNoBrandDuplicates() {
  // Group raw brand strings by their normalized canonical key
  const byCanonicalKey = new Map<string, Set<string>>();
  for (const product of products) {
    const canonical = canonicalBrandName(product.brand);
    const key = canonical.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!byCanonicalKey.has(key)) byCanonicalKey.set(key, new Set());
    byCanonicalKey.get(key)!.add(product.brand);
  }
  // Flag any group where a raw brand is neither the canonical form nor in the map
  const unmapped: string[] = [];
  for (const [key, rawBrands] of byCanonicalKey) {
    if (rawBrands.size <= 1) continue;
    const unknown = [...rawBrands].filter(
      brand => brand !== canonicalBrandName(brand)
        && !Object.prototype.hasOwnProperty.call(canonicalBrandNameMap, brand),
    );
    if (unknown.length > 0) {
      unmapped.push(`${key}: ${unknown.map(b => `"${b}"`).join(', ')}`);
    }
  }
  if (unmapped.length > 0) {
    throw new Error(
      `Brand duplicate detected. Add these variants to data/brand-canonical-names.ts:\n  ${unmapped.join('\n  ')}`,
    );
  }
}

export function buildPublicCatalogueSearchArtifact(): PublicCatalogueSearchArtifact {
  assertNoBrandDuplicates();
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
        brand: canonicalBrandName(product.brand),
        name: product.name,
        size: product.size,
        category: product.category,
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
