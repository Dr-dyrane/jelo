import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import type { Offer, Product } from '@/data/products';
import { getPostgresClient } from '@/lib/db/postgres';

export type CatalogueRepository = {
  listPublished(): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | undefined>;
};

type ProductRow = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  category: Product['category'];
  step: string;
  image: string | null;
  display_line: string;
  usage: string;
  evidence: Product['evidence'];
  sensitive_friendly: boolean;
  best_for: string[] | null;
  concerns: string[] | null;
  skin_types: string[] | null;
  offers: Array<{
    retailer: string;
    url: string;
    trust: number;
    available: boolean;
    priceNgn?: number;
    location: string[];
  }> | null;
};

const staticRepository: CatalogueRepository = {
  async listPublished() {
    return staticProducts;
  },
  async findBySlug(slug) {
    return staticProducts.find(product => product.slug === slug);
  },
};

function mapRow(row: ProductRow): Product {
  return {
    slug: row.slug,
    brand: row.brand,
    name: row.name,
    size: row.size,
    category: row.category,
    step: row.step,
    image: row.image ?? '/product-placeholder.svg',
    displayLine: row.display_line,
    bestFor: row.best_for ?? [],
    concerns: row.concerns ?? [],
    skinTypes: row.skin_types ?? [],
    sensitiveFriendly: row.sensitive_friendly,
    usage: row.usage,
    evidence: row.evidence,
    offers: (row.offers ?? []) as Offer[],
  };
}

async function queryProducts(slug?: string) {
  const sql = getPostgresClient();
  const rows = await sql<ProductRow[]>`
    select
      p.slug,
      b.name as brand,
      p.name,
      p.size,
      p.category,
      p.routine_step as step,
      coalesce(pi.blob_url, pi.source_url) as image,
      p.display_line,
      p.usage,
      p.evidence,
      p.sensitive_friendly,
      coalesce((
        select jsonb_agg(pbf.label order by pbf.priority)
        from product_best_for pbf
        where pbf.product_id = p.id
      ), '[]'::jsonb) as best_for,
      coalesce((
        select jsonb_agg(c.name order by pc.priority)
        from product_concerns pc
        join concerns c on c.id = pc.concern_id
        where pc.product_id = p.id
      ), '[]'::jsonb) as concerns,
      coalesce((
        select jsonb_agg(pst.skin_type order by pst.skin_type)
        from product_skin_types pst
        where pst.product_id = p.id
      ), '[]'::jsonb) as skin_types,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'retailer', r.name,
          'url', grouped.url,
          'trust', r.trust_score,
          'available', grouped.available,
          'priceNgn', grouped.price_minor,
          'location', grouped.locations
        ) order by r.trust_score desc)
        from (
          select
            o.retailer_id,
            min(o.url) as url,
            bool_or(o.available) as available,
            max(o.price_minor) as price_minor,
            jsonb_agg(o.market_code order by o.market_code) as locations
          from offers o
          where o.product_id = p.id
          group by o.retailer_id
        ) grouped
        join retailers r on r.id = grouped.retailer_id
      ), '[]'::jsonb) as offers
    from products p
    join brands b on b.id = p.brand_id
    left join product_images pi on pi.product_id = p.id and pi.kind = 'packshot'
    where p.is_published = true
      and (${slug ?? null}::text is null or p.slug = ${slug ?? null})
    order by b.name, p.name
  `;

  return rows.map(mapRow);
}

const neonRepository: CatalogueRepository = {
  async listPublished() {
    return queryProducts();
  },
  async findBySlug(slug) {
    const [product] = await queryProducts(slug);
    return product;
  },
};

function shouldUseNeon() {
  return process.env.CATALOGUE_SOURCE === 'neon';
}

export function getCatalogueRepository(): CatalogueRepository {
  return shouldUseNeon() ? neonRepository : staticRepository;
}

export async function listCatalogueProducts() {
  if (!shouldUseNeon()) return staticRepository.listPublished();

  try {
    return await neonRepository.listPublished();
  } catch (error) {
    console.error('Neon catalogue unavailable; using verified static fallback.', error);
    return staticRepository.listPublished();
  }
}

export async function findCatalogueProduct(slug: string) {
  if (!shouldUseNeon()) return staticRepository.findBySlug(slug);

  try {
    return await neonRepository.findBySlug(slug);
  } catch (error) {
    console.error('Neon product lookup unavailable; using verified static fallback.', error);
    return staticRepository.findBySlug(slug);
  }
}
