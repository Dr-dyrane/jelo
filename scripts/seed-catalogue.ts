import postgres from 'postgres';
import { products as catalogue } from '../data/catalogue';
import { isPublishedIntakeProduct } from '../data/published-intake-products';
import productAssets from '../data/product-assets.json';
import publicCatalogueSearchProjectionJson from '../data/public-catalogue-search.json';
import {
  ingredientSeeds,
  verifiedProductIngredients,
} from '../data/product-ingredients';
import {
  parsePublicCatalogueSearchArtifact,
  publicCatalogueSearchText,
  type PublicCatalogueSearchProduct,
} from '../lib/catalogue/public-catalogue-search';
import {
  catalogueSyncTimeouts,
  assertCatalogueRetirementSafety,
  parseCatalogueSeedScope,
  selectCatalogueSeedProducts,
  shouldRetireStaleCatalogueProducts,
} from '../lib/catalogue/seed-sync-scope';
import { catalogueBrandSlug } from '../lib/catalogue/slug';
import { priceAmountToStorageInteger } from '../lib/inventory/price-storage';

type ProductAssetRecord = {
  sourceUrl: string;
  blobUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  contentHash: string;
};

function publicSearchProjectionBySlug() {
  const projection = parsePublicCatalogueSearchArtifact(
    publicCatalogueSearchProjectionJson,
  );
  const catalogueBySlug = new Map(
    catalogue.map((product) => [product.slug, product]),
  );

  if (projection.products.length !== catalogueBySlug.size) {
    throw new Error(
      `Public catalogue search projection has ${projection.products.length} products; reviewed catalogue has ${catalogueBySlug.size}. Rebuild the projection before seeding.`,
    );
  }

  const projectionBySlug = new Map<string, PublicCatalogueSearchProduct>();
  for (const projectedProduct of projection.products) {
    const reviewedProduct = catalogueBySlug.get(projectedProduct.slug);
    if (!reviewedProduct) {
      throw new Error(
        `Public catalogue search projection includes unknown product ${projectedProduct.slug}.`,
      );
    }
    if (
      projectedProduct.brand !== reviewedProduct.brand ||
      projectedProduct.name !== reviewedProduct.name ||
      projectedProduct.size !== reviewedProduct.size
    ) {
      throw new Error(
        `Public catalogue search projection is stale for ${projectedProduct.slug}. Rebuild it before seeding.`,
      );
    }
    projectionBySlug.set(projectedProduct.slug, projectedProduct);
  }

  for (const slug of catalogueBySlug.keys()) {
    if (!projectionBySlug.has(slug)) {
      throw new Error(
        `Public catalogue search projection is missing reviewed product ${slug}.`,
      );
    }
  }

  return projectionBySlug;
}

async function main() {
  const searchProjectionBySlug = publicSearchProjectionBySlug();
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      'A Neon connection string is required to seed the catalogue.',
    );
  }

  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    connection: { application_name: 'jelocare-catalogue-sync' },
  });
  const slugify = catalogueBrandSlug;

  const sourceHost = (value: string) => {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };
  const observationDate = (value?: string) => {
    const normalized =
      value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
    const parsed = normalized ? new Date(normalized) : new Date();
    if (Number.isNaN(parsed.getTime()))
      throw new Error(`Invalid offer observation timestamp: ${value}`);
    return parsed;
  };
  const ingredientBySlug = new Map(
    ingredientSeeds.map((ingredient) => [ingredient.slug, ingredient]),
  );
  const assetBySlug = productAssets as Record<string, ProductAssetRecord>;
  const scope = parseCatalogueSeedScope(process.argv.slice(2));
  const selectedCatalogue = selectCatalogueSeedProducts(catalogue, scope);
  const timeouts = catalogueSyncTimeouts({
    CATALOGUE_SYNC_LOCK_TIMEOUT_MS: process.env.CATALOGUE_SYNC_LOCK_TIMEOUT_MS,
    CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS:
      process.env.CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS,
  });

  const configureSyncTransaction = async (tx: postgres.TransactionSql) => {
    await tx`select set_config('lock_timeout', ${`${timeouts.lockTimeoutMs}ms`}, true)`;
    await tx`select set_config('statement_timeout', ${`${timeouts.statementTimeoutMs}ms`}, true)`;
  };

  try {
    console.log(
      `Synchronizing ${selectedCatalogue.length} reviewed public product${selectedCatalogue.length === 1 ? '' : 's'}${scope.isScoped ? ' (scoped)' : ''}.`,
    );
    for (const [productIndex, product] of selectedCatalogue.entries()) {
      const startedAt = Date.now();
      const searchProjection = searchProjectionBySlug.get(product.slug);
      if (!searchProjection) {
        throw new Error(
          `Public catalogue search projection is missing selected product ${product.slug}.`,
        );
      }
      const searchText = publicCatalogueSearchText(searchProjection);
      console.log(
        `[${productIndex + 1}/${selectedCatalogue.length}] ${product.slug}`,
      );
      await sql.begin(async (tx) => {
        await configureSyncTransaction(tx);
        const brandSlug = slugify(product.brand);
        const [brand] = await tx<{ id: string }[]>`
        insert into brands (slug, name)
        values (${brandSlug}, ${product.brand})
        on conflict (slug) do update set
          name = excluded.name,
          updated_at = now()
        returning id
      `;

        const productAsset = assetBySlug[product.slug];
        const imageUrl = productAsset?.blobUrl ?? product.image;
        const imageSourceUrl =
          productAsset?.sourceUrl ??
          (product.image.includes('vercel-storage.com') ? null : product.image);
        const isPlaceholder =
          imageUrl.startsWith('/product-fallback') ||
          imageUrl.startsWith('/product-placeholder');

        const [savedProduct] = await tx<{ id: string }[]>`
        insert into products (
          brand_id, slug, name, size, category, routine_step, display_line,
          usage, evidence, sensitive_friendly, is_published, source_version,
          approved_gtin, search_text
        ) values (
          ${brand.id}, ${product.slug}, ${product.name}, ${product.size},
          ${product.category}, ${product.step}, ${product.displayLine}, ${product.usage},
          ${product.evidence}, ${product.sensitiveFriendly}, ${!isPlaceholder},
          ${isPublishedIntakeProduct(product.slug) ? 'published-intake-v1' : 'static-v1'},
          ${searchProjection.approvedGtin}, ${searchText}
        )
        on conflict (slug) do update set
          brand_id = excluded.brand_id,
          name = excluded.name,
          size = excluded.size,
          category = excluded.category,
          routine_step = excluded.routine_step,
          display_line = excluded.display_line,
          usage = excluded.usage,
          evidence = excluded.evidence,
          sensitive_friendly = excluded.sensitive_friendly,
          is_published = excluded.is_published,
          source_version = excluded.source_version,
          approved_gtin = excluded.approved_gtin,
          search_text = excluded.search_text,
          updated_at = now()
        returning id
      `;

        await tx`delete from product_skin_types where product_id = ${savedProduct.id}`;
        await tx`delete from product_best_for where product_id = ${savedProduct.id}`;
        await tx`delete from product_concerns where product_id = ${savedProduct.id}`;

        // Keep offer ids stable so historical prices remain attached. Curated
        // imports that disappear from the static set become hidden search routes;
        // retailer-page and API observations are left untouched.
        await tx`
        update offers
        set
          available = false,
          inventory_status = 'unknown',
          match_kind = 'search',
          verification_note = 'Not in the current curated offer set; retained for price history.',
          updated_at = now()
        where product_id = ${savedProduct.id}
          and verification_method = 'import'
      `;

        for (const skinType of product.skinTypes) {
          await tx`
          insert into product_skin_types (product_id, skin_type)
          values (${savedProduct.id}, ${skinType})
          on conflict do nothing
        `;
        }

        for (const [priority, label] of product.bestFor.entries()) {
          await tx`
          insert into product_best_for (product_id, label, priority)
          values (${savedProduct.id}, ${label}, ${priority})
          on conflict (product_id, label) do update set priority = excluded.priority
        `;
        }

        for (const [priority, concernName] of product.concerns.entries()) {
          const concernSlug = slugify(concernName);
          const [concern] = await tx<{ id: string }[]>`
          insert into concerns (slug, name)
          values (${concernSlug}, ${concernName})
          on conflict (slug) do update set name = excluded.name
          returning id
        `;

          await tx`
          insert into product_concerns (product_id, concern_id, priority)
          values (${savedProduct.id}, ${concern.id}, ${priority})
          on conflict (product_id, concern_id) do update set priority = excluded.priority
        `;
        }

        const imageStatus = isPlaceholder
          ? 'failed'
          : imageUrl.includes('vercel-storage.com')
            ? 'verified'
            : 'pending';

        await tx`
        insert into product_images (
          product_id, kind, blob_url, source_url, source_host, alt_text,
          mime_type, width, height, byte_size, has_alpha, content_hash,
          status, verified_at
        ) values (
          ${savedProduct.id}, 'packshot',
          ${imageUrl.includes('vercel-storage.com') ? imageUrl : null},
          ${imageSourceUrl},
          ${imageSourceUrl ? sourceHost(imageSourceUrl) : null},
          ${`${product.brand} ${product.name}`},
          ${productAsset?.contentType ?? null},
          ${productAsset?.width ?? null},
          ${productAsset?.height ?? null},
          ${productAsset?.byteSize ?? null},
          ${productAsset?.hasAlpha ?? null},
          ${productAsset?.contentHash ?? null},
          ${imageStatus},
          ${imageStatus === 'verified' ? new Date() : null}
        )
        on conflict (product_id, kind) do update set
          blob_url = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then product_images.blob_url
            else excluded.blob_url
          end,
          source_url = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then coalesce(excluded.source_url, product_images.source_url)
            else excluded.source_url
          end,
          source_host = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then coalesce(excluded.source_host, product_images.source_host)
            else excluded.source_host
          end,
          alt_text = excluded.alt_text,
          mime_type = coalesce(excluded.mime_type, product_images.mime_type),
          width = coalesce(excluded.width, product_images.width),
          height = coalesce(excluded.height, product_images.height),
          byte_size = coalesce(excluded.byte_size, product_images.byte_size),
          has_alpha = coalesce(excluded.has_alpha, product_images.has_alpha),
          content_hash = coalesce(excluded.content_hash, product_images.content_hash),
          status = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then product_images.status
            else excluded.status
          end,
          verified_at = case
            when excluded.content_hash is not null
              and product_images.content_hash is distinct from excluded.content_hash
              then now()
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then product_images.verified_at
            else excluded.verified_at
          end,
          updated_at = now()
      `;

        for (const productIngredient of verifiedProductIngredients[
          product.slug
        ] ?? []) {
          const ingredient = ingredientBySlug.get(
            productIngredient.ingredientSlug,
          );
          if (!ingredient)
            throw new Error(
              `Missing ingredient seed for ${productIngredient.ingredientSlug}.`,
            );

          const [savedIngredient] = await tx<{ id: string }[]>`
          insert into ingredients (
            slug, inci_name, display_name, common_name, summary, evidence_grade,
            sensitive_skin_status, pharmacist_reviewed
          ) values (
            ${ingredient.slug}, ${ingredient.inciName}, ${ingredient.commonName},
            ${ingredient.commonName}, ${ingredient.summary}, ${ingredient.evidenceGrade},
            ${ingredient.sensitiveSkinStatus}, false
          )
          on conflict (slug) do update set
            inci_name = case when ingredients.pharmacist_reviewed then ingredients.inci_name else excluded.inci_name end,
            display_name = case when ingredients.pharmacist_reviewed then ingredients.display_name else excluded.display_name end,
            common_name = case when ingredients.pharmacist_reviewed then ingredients.common_name else excluded.common_name end,
            summary = case when ingredients.pharmacist_reviewed then ingredients.summary else excluded.summary end,
            evidence_grade = case when ingredients.pharmacist_reviewed then ingredients.evidence_grade else excluded.evidence_grade end,
            sensitive_skin_status = case when ingredients.pharmacist_reviewed then ingredients.sensitive_skin_status else excluded.sensitive_skin_status end,
            updated_at = now()
          returning id
        `;

          await tx`
          insert into product_ingredients (
            product_id, ingredient_id, concentration_text, is_key, position,
            concentration_percent, is_active, source, source_url, verified_at
          ) values (
            ${savedProduct.id}, ${savedIngredient.id},
            ${productIngredient.concentrationPercent == null ? null : `${productIngredient.concentrationPercent}%`},
            true, ${productIngredient.position}, ${productIngredient.concentrationPercent ?? null},
            ${productIngredient.isActive}, 'official_brand', ${productIngredient.sourceUrl},
            ${new Date(`${productIngredient.verifiedAt}T12:00:00Z`)}
          )
          on conflict (product_id, ingredient_id) do update set
            concentration_text = excluded.concentration_text,
            is_key = excluded.is_key,
            position = excluded.position,
            concentration_percent = excluded.concentration_percent,
            is_active = excluded.is_active,
            source = excluded.source,
            source_url = excluded.source_url,
            verified_at = excluded.verified_at,
            updated_at = now()
        `;
        }

        for (const offer of product.offers) {
          const retailerSlug = slugify(offer.retailer);
          const [retailer] = await tx<{ id: string }[]>`
          insert into retailers (slug, name, trust_score)
          values (${retailerSlug}, ${offer.retailer}, ${offer.trust})
          on conflict (slug) do update set
            name = excluded.name,
            trust_score = excluded.trust_score
          returning id
        `;

          for (const market of offer.location) {
            const inventoryStatus = offer.available
              ? 'in_stock'
              : 'out_of_stock';
            const priceMinor =
              market === 'NG' && offer.priceNgn != null
                ? priceAmountToStorageInteger(offer.priceNgn, 'NGN')
                : market === 'US' && offer.priceUsd != null
                  ? priceAmountToStorageInteger(offer.priceUsd, 'USD')
                  : null;
            const currencyCode =
              market === 'NG' && offer.priceNgn != null
                ? 'NGN'
                : market === 'US' && offer.priceUsd != null
                  ? 'USD'
                  : null;
            const checkedAt = observationDate(offer.checkedAt);
            const lastVerifiedAt = observationDate(
              offer.listingEvidence?.observedAt ?? offer.checkedAt,
            );
            const verificationMethod =
              offer.listingEvidence?.basis === 'retailer-api'
                ? 'api'
                : offer.listingEvidence?.basis === 'retailer-page'
                  ? 'retailer_page'
                  : 'import';
            const verificationNote =
              verificationMethod === 'api'
                ? 'Seeded from a dated retailer API observation.'
                : verificationMethod === 'retailer_page'
                  ? 'Seeded from a dated retailer-page observation.'
                  : 'Seeded from the curated catalogue.';
            const [savedOffer] = await tx<{ id: string }[]>`
            insert into offers (
              product_id, retailer_id, url, market_code, available,
              price_minor, currency_code, checked_at, inventory_status,
              verification_method, verification_note, last_verified_at,
              verification_expires_at, match_kind, inventory_quantity,
              seller_name, seller_score, official_store, observed_title,
              observed_size, canonical_url
            ) values (
              ${savedProduct.id}, ${retailer.id}, ${offer.url}, ${market},
              ${offer.available}, ${priceMinor},
              ${currencyCode}, ${checkedAt},
              ${inventoryStatus}, ${verificationMethod}, ${verificationNote},
              ${lastVerifiedAt}, ${lastVerifiedAt}::timestamptz + interval '7 days', ${offer.match ?? 'exact'},
              ${offer.inventoryQuantity ?? null}, ${offer.sellerName ?? null},
              ${offer.sellerScore ?? null}, ${offer.officialStore ?? false},
              ${offer.priceObservation?.variant ?? null},
              ${offer.priceObservation?.size ?? null}, ${offer.url}
            )
            on conflict (product_id, retailer_id, market_code) do update set
              url = excluded.url,
              available = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.available else excluded.available end,
              price_minor = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.price_minor else excluded.price_minor end,
              currency_code = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.currency_code else excluded.currency_code end,
              checked_at = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.checked_at else excluded.checked_at end,
              inventory_status = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.inventory_status else excluded.inventory_status end,
              verification_method = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.verification_method else excluded.verification_method end,
              verification_note = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.verification_note else excluded.verification_note end,
              last_verified_at = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.last_verified_at else excluded.last_verified_at end,
              verification_expires_at = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.verification_expires_at else excluded.verification_expires_at end,
              match_kind = excluded.match_kind,
              inventory_quantity = excluded.inventory_quantity,
              seller_name = excluded.seller_name,
              seller_score = excluded.seller_score,
              official_store = excluded.official_store,
              observed_title = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.observed_title else excluded.observed_title end,
              observed_size = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.observed_size else excluded.observed_size end,
              canonical_url = case when offers.verification_method in ('retailer_page', 'api', 'manual') then offers.canonical_url else excluded.canonical_url end,
              updated_at = now()
            returning id
          `;

            if (priceMinor != null && currencyCode) {
              await tx`
              insert into offer_price_history (
                offer_id, price_minor, currency_code, observed_at, source
              ) values (
                ${savedOffer.id}, ${priceMinor}, ${currencyCode}, ${lastVerifiedAt}, ${verificationMethod}
              )
              on conflict do nothing
            `;
            }
          }
        }
      });
      console.log(
        `[${productIndex + 1}/${selectedCatalogue.length}] committed in ${Date.now() - startedAt}ms`,
      );
    }

    // Scoped repairs must never alter the visibility of another product. Full
    // synchronizations retire stale static rows only after every reviewed row
    // was committed successfully, so an interrupted run cannot unpublish a
    // healthy catalogue.
    if (shouldRetireStaleCatalogueProducts(scope)) {
      const publishedSlugs = catalogue.map((product) => product.slug);
      await sql.begin(async (tx) => {
        await configureSyncTransaction(tx);
        const [current] = await tx<{ count: number }[]>`
          select count(*)::int as count
          from products
          where is_published = true
            and source_version in ('static-v1', 'published-intake-v1')
        `;
        assertCatalogueRetirementSafety(publishedSlugs.length, current?.count ?? 0);
        await tx`
        update products
        set is_published = false,
            updated_at = now()
        where is_published = true
          and source_version in ('static-v1', 'published-intake-v1')
          and not (slug = any(${publishedSlugs}::text[]))
      `;
      });
      console.log(
        'Retired stale reviewed catalogue rows after the successful full sync.',
      );
    }

    console.log(
      `Synchronized ${selectedCatalogue.length} reviewed public product${selectedCatalogue.length === 1 ? '' : 's'} into Neon.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
