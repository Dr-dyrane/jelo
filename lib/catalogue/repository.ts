import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import { getReviewedProductCare } from '@/data/product-care-review';
import { publishedIntakeProducts } from '@/data/published-intake-products';
import type { Offer, Product } from '@/data/products';
import {
  mergeDossierReleasedCatalogue,
  reconcilePublishedCatalogue,
} from '@/lib/catalogue/publication-boundary';
import { getPostgresClient, hasPostgresConfig } from '@/lib/db/postgres';
import {
  materializePersistedOfferEvidence,
  type PersistedOfferEvidence,
} from '@/modules/commerce/offer-evidence';

export type CatalogueRepository = {
  listPublished(): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | undefined>;
};

type PersistedProductOffer = Offer & PersistedOfferEvidence;

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
  ingredient_ids: string[] | null;
  offers: PersistedProductOffer[] | null;
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
    verifiedIngredientIds: row.ingredient_ids ?? [],
    offers: (row.offers ?? []).map(persistedOffer => {
      const {
        verificationMethod,
        lastVerifiedAt,
        inventoryStatus,
        observedTitle,
        observedSize,
        canonicalUrl,
        ...offer
      } = persistedOffer;
      return materializePersistedOfferEvidence(row, offer, {
        verificationMethod,
        lastVerifiedAt,
        inventoryStatus,
        observedTitle,
        observedSize,
        canonicalUrl,
      });
    }),
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
        select jsonb_agg(i.slug order by pi.position nulls last, i.slug)
        from product_ingredients pi
        join ingredients i on i.id = pi.ingredient_id
        where pi.product_id = p.id
          and pi.is_active = true
          and pi.verified_at is not null
      ), '[]'::jsonb) as ingredient_ids,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'retailer', r.name,
          'url', grouped.url,
          'trust', r.trust_score,
          'available', grouped.available,
          'priceNgn', case when grouped.market_code = 'NG' and grouped.currency_code = 'NGN' then grouped.price_minor end,
          'priceUsd', case when grouped.market_code = 'US' and grouped.currency_code = 'USD' then grouped.price_minor::numeric / 100 end,
          'checkedAt', grouped.checked_at,
          'expiresAt', grouped.verification_expires_at,
          'verificationMethod', grouped.verification_method,
          'lastVerifiedAt', grouped.last_verified_at,
          'inventoryStatus', grouped.inventory_status,
          'observedTitle', grouped.observed_title,
          'observedSize', grouped.observed_size,
          'canonicalUrl', grouped.canonical_url,
          'match', grouped.match_kind,
          'inventoryQuantity', grouped.inventory_quantity,
          'sellerName', grouped.seller_name,
          'sellerScore', grouped.seller_score,
          'officialStore', grouped.official_store,
          'location', jsonb_build_array(grouped.market_code)
        ) order by r.trust_score desc, grouped.market_code)
        from (
          select
            o.retailer_id,
            o.market_code,
            min(o.url) as url,
            bool_or(o.available) as available,
            min(o.price_minor) as price_minor,
            min(o.currency_code) as currency_code,
            max(o.inventory_quantity) as inventory_quantity,
            max(o.seller_name) as seller_name,
            max(o.seller_score) as seller_score,
            bool_or(o.official_store) as official_store,
            max(o.checked_at) as checked_at,
            max(o.verification_method::text) as verification_method,
            max(o.last_verified_at) as last_verified_at,
            max(o.inventory_status::text) as inventory_status,
            max(o.observed_title) as observed_title,
            max(o.observed_size) as observed_size,
            max(o.canonical_url) as canonical_url,
            min(o.verification_expires_at) as verification_expires_at,
            case when bool_and(o.match_kind = 'search') then 'search' else 'exact' end as match_kind
          from offers o
          where o.product_id = p.id
          group by o.retailer_id, o.market_code
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

  return mergeDossierReleasedCatalogue(
    reconcilePublishedCatalogue(rows.map(mapRow), staticProducts),
    publishedIntakeProducts,
    slug,
  );
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
  return process.env.CATALOGUE_SOURCE === 'neon' && hasPostgresConfig();
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

/**
 * The sole catalogue access point for clinical matching and recommendations.
 * External/community records live in a separate repository and can never enter
 * this return type without an explicit JeloCare review.
 */
export async function listRecommendationEligibleProducts() {
  const products = await listCatalogueProducts();
  return products.filter(product => getReviewedProductCare(product.slug)?.careState === 'supportive_eligible');
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
