import postgres from 'postgres';
import { products as catalogue } from '../data/catalogue';

async function main() {
const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to seed the catalogue.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });
const slugify = (value: string) => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const sourceHost = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

try {
  await sql.begin(async tx => {
    for (const product of catalogue) {
      const brandSlug = slugify(product.brand);
      const [brand] = await tx<{ id: string }[]>`
        insert into brands (slug, name)
        values (${brandSlug}, ${product.brand})
        on conflict (slug) do update set
          name = excluded.name,
          updated_at = now()
        returning id
      `;

      const isPlaceholder = product.image.startsWith('/product-fallback')
        || product.image.startsWith('/product-placeholder');

      const [savedProduct] = await tx<{ id: string }[]>`
        insert into products (
          brand_id, slug, name, size, category, routine_step, display_line,
          usage, evidence, sensitive_friendly, is_published, source_version
        ) values (
          ${brand.id}, ${product.slug}, ${product.name}, ${product.size},
          ${product.category}, ${product.step}, ${product.displayLine}, ${product.usage},
          ${product.evidence}, ${product.sensitiveFriendly}, ${!isPlaceholder}, 'static-v1'
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
        : product.image.includes('vercel-storage.com')
          ? 'verified'
          : 'pending';

      await tx`
        insert into product_images (
          product_id, kind, blob_url, source_url, source_host, alt_text, status, verified_at
        ) values (
          ${savedProduct.id}, 'packshot',
          ${product.image.includes('vercel-storage.com') ? product.image : null},
          ${product.image.includes('vercel-storage.com') ? null : product.image},
          ${sourceHost(product.image)},
          ${`${product.brand} ${product.name}`},
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
              then product_images.source_url
            else excluded.source_url
          end,
          source_host = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then product_images.source_host
            else excluded.source_host
          end,
          alt_text = excluded.alt_text,
          status = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then product_images.status
            else excluded.status
          end,
          verified_at = case
            when product_images.status = 'verified'
              and product_images.blob_url like '%vercel-storage.com/%'
              then product_images.verified_at
            else excluded.verified_at
          end,
          updated_at = now()
      `;

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
          const inventoryStatus = offer.available ? 'in_stock' : 'out_of_stock';
          const priceMinor = market === 'NG' && offer.priceNgn != null
            ? offer.priceNgn
            : market === 'US' && offer.priceUsd != null
              ? Math.round(offer.priceUsd * 100)
              : null;
          const currencyCode = market === 'NG' && offer.priceNgn != null
            ? 'NGN'
            : market === 'US' && offer.priceUsd != null
              ? 'USD'
              : null;
          const checkedAt = offer.checkedAt ? new Date(`${offer.checkedAt}T12:00:00Z`) : new Date();
          const [savedOffer] = await tx<{ id: string }[]>`
            insert into offers (
              product_id, retailer_id, url, market_code, available,
              price_minor, currency_code, checked_at, inventory_status,
              verification_method, verification_note, last_verified_at,
              verification_expires_at, match_kind
            ) values (
              ${savedProduct.id}, ${retailer.id}, ${offer.url}, ${market},
              ${offer.available}, ${priceMinor},
              ${currencyCode}, ${checkedAt},
              ${inventoryStatus}, 'import', 'Seeded from the curated catalogue.',
              ${checkedAt}, ${checkedAt}::timestamptz + interval '7 days', ${offer.match ?? 'exact'}
            )
            on conflict (product_id, retailer_id, market_code) do update set
              url = excluded.url,
              available = excluded.available,
              price_minor = excluded.price_minor,
              currency_code = excluded.currency_code,
              checked_at = excluded.checked_at,
              inventory_status = excluded.inventory_status,
              verification_method = excluded.verification_method,
              verification_note = excluded.verification_note,
              last_verified_at = excluded.last_verified_at,
              verification_expires_at = excluded.verification_expires_at,
              match_kind = excluded.match_kind,
              updated_at = now()
            returning id
          `;

          if (priceMinor != null && currencyCode) {
            await tx`
              insert into offer_price_history (
                offer_id, price_minor, currency_code, observed_at, source
              ) values (
                ${savedOffer.id}, ${priceMinor}, ${currencyCode}, ${checkedAt}, 'import'
              )
              on conflict do nothing
            `;
          }
        }
      }
    }
  });

  console.log(`Seeded ${catalogue.length} products into Neon.`);
} finally {
  await sql.end();
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
