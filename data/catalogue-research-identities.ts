import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
import { catalogueGtinForIdentity } from '@/lib/catalogue/canonical-identity';
import type { KnownCatalogueIdentity } from '@/lib/catalogue/research-priority';

function compactUnique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

export const catalogueResearchKnownIdentities: KnownCatalogueIdentity[] = [
  ...coreProducts,
  ...expandedProducts,
].map(product => ({
  brand: product.brand,
  name: product.name,
  size: product.size,
}));

for (const candidate of catalogueIntakeCandidates) {
  catalogueResearchKnownIdentities.push({
    brand: candidate.brand,
    ...(candidate.brandAliases?.length ? { brandAliases: candidate.brandAliases } : {}),
    name: candidate.name,
    nameAliases: compactUnique([
      candidate.variant,
      ...candidate.nigeria.exactOffers.map(offer => offer.observedTitle),
    ]),
    size: candidate.size,
    sizeAliases: compactUnique(candidate.nigeria.exactOffers.map(offer => offer.observedSize)),
    gtin: catalogueGtinForIdentity(candidate.identity),
  });
}
