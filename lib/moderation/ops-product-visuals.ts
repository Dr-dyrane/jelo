import 'server-only';

import { listCatalogueProducts } from '@/lib/catalogue/repository';

const PRODUCT_PREFIX = 'product:';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function canonicalProductSlug(productRef: string | null) {
  if (!productRef) return null;
  const normalized = productRef.trim();
  const slug = normalized.startsWith(PRODUCT_PREFIX)
    ? normalized.slice(PRODUCT_PREFIX.length)
    : normalized;
  return SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * Resolves only explicit canonical product references against the public
 * catalogue. Raw labels, community-entered names, and remote image URLs never
 * enter this map.
 */
export async function resolveOpsProductImages(productRefs: readonly (string | null)[]) {
  const requested = new Map<string, string>();
  for (const productRef of productRefs) {
    const slug = canonicalProductSlug(productRef);
    if (productRef && slug) requested.set(productRef, slug);
  }
  if (requested.size === 0) return new Map<string, string>();

  const catalogue = await listCatalogueProducts();
  const imagesBySlug = new Map(
    catalogue
      .filter(product => Boolean(product.image))
      .map(product => [product.slug, product.image]),
  );

  return new Map(
    [...requested]
      .flatMap(([productRef, slug]) => {
        const image = imagesBySlug.get(slug);
        return image ? [[productRef, image] as const] : [];
      }),
  );
}
