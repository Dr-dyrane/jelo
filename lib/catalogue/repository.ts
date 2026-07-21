import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import type { Product } from '@/data/products';

export type CatalogueRepository = {
  listPublished(): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | undefined>;
};

const staticRepository: CatalogueRepository = {
  async listPublished() {
    return staticProducts;
  },
  async findBySlug(slug) {
    return staticProducts.find(product => product.slug === slug);
  },
};

/**
 * The application reads catalogue data through this boundary so Neon can replace
 * the static TypeScript source without rewriting product pages and search UI.
 *
 * Until the database adapter and migration are enabled, production deliberately
 * uses the verified static catalogue as a safe fallback.
 */
export function getCatalogueRepository(): CatalogueRepository {
  return staticRepository;
}

export async function listCatalogueProducts() {
  return getCatalogueRepository().listPublished();
}

export async function findCatalogueProduct(slug: string) {
  return getCatalogueRepository().findBySlug(slug);
}
