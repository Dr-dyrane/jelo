export const publicCatalogueSearchSchemaVersion = 1 as const;

export type PublicCatalogueSearchSource = 'reviewed-catalogue' | 'dossier-release';

export type PublicCatalogueSearchProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  category: 'Face' | 'Hair' | 'Body';
  approvedGtin: string | null;
  source: PublicCatalogueSearchSource;
};

export type PublicCatalogueSearchArtifact = {
  schemaVersion: typeof publicCatalogueSearchSchemaVersion;
  exposure: 'public-catalogue-search';
  products: PublicCatalogueSearchProduct[];
};

const rootKeys = ['exposure', 'products', 'schemaVersion'] as const;
const productKeys = ['approvedGtin', 'brand', 'category', 'name', 'size', 'slug', 'source'] as const;
const validGtin = /^\d{8,14}$/;
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isProduct(value: unknown): value is PublicCatalogueSearchProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const product = value as Record<string, unknown>;
  return exactKeys(product, productKeys)
    && typeof product.slug === 'string'
    && validSlug.test(product.slug)
    && typeof product.brand === 'string'
    && product.brand.trim().length > 0
    && typeof product.name === 'string'
    && product.name.trim().length > 0
    && typeof product.size === 'string'
    && product.size.trim().length > 0
    && (product.category === 'Face' || product.category === 'Hair' || product.category === 'Body')
    && (product.approvedGtin === null || (typeof product.approvedGtin === 'string' && validGtin.test(product.approvedGtin)))
    && (product.source === 'reviewed-catalogue' || product.source === 'dossier-release');
}

export function parsePublicCatalogueSearchArtifact(value: unknown): PublicCatalogueSearchArtifact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Public catalogue search artifact must be an object.');
  }
  const artifact = value as Record<string, unknown>;
  if (!exactKeys(artifact, rootKeys)) {
    throw new Error('Public catalogue search artifact contains an unexpected field.');
  }
  if (
    artifact.schemaVersion !== publicCatalogueSearchSchemaVersion
    || artifact.exposure !== 'public-catalogue-search'
    || !Array.isArray(artifact.products)
    || !artifact.products.every(isProduct)
  ) {
    throw new Error('Public catalogue search artifact is invalid.');
  }

  const products = artifact.products as PublicCatalogueSearchProduct[];
  const slugs = products.map(product => product.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error('Public catalogue search artifact contains duplicate slugs.');
  }
  if (slugs.some((slug, index) => index > 0 && slug.localeCompare(slugs[index - 1]!) < 0)) {
    throw new Error('Public catalogue search artifact must be sorted by slug.');
  }
  const gtins = products.flatMap(product => product.approvedGtin ? [product.approvedGtin] : []);
  if (new Set(gtins).size !== gtins.length) {
    throw new Error('Public catalogue search artifact contains duplicate approved GTINs.');
  }

  return artifact as unknown as PublicCatalogueSearchArtifact;
}

export function publicCatalogueSearchText(product: PublicCatalogueSearchProduct) {
  return [
    product.brand,
    product.name,
    product.size,
    product.category,
    product.approvedGtin ?? '',
    product.slug,
  ]
    .join(' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
