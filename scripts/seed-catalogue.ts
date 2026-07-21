import postgres from 'postgres';
import { products as coreProducts } from '../data/products';
import { expandedProducts } from '../data/expanded-products';

const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to seed the catalogue.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });
const catalogue = [...coreProducts, ...expandedProducts];

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
      await tx`delete from offers where product_id = ${savedProduct.id}`;

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
            when product_images.status = 'verified' and product_images.blob_url is not null
              then product_images.blob_url
            else excluded.blob_url
          end,
          source_url = case
            when product_images.status = 'verified' and product_images.blob_url is not null
              then product_images.source_url
            else excluded.source_url
          end,
          source_host = case
            when product_images.status = 'verified' and product_images.blob_url is not null
              then product_images.source_host
            else excluded.source_host
          end,
          alt_text = excluded.alt_text,
          status = case
            when product_images.status = 'verified' and product_images.blob_url is not null
              then product_images.status
            else excluded.status
          end,
          verified_at = case
            when product_images.status = 'verified' and product_images.blob_url is not null
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
          await tx`
            insert into offers (
              product_id, retailer_id, url, market_code, available,
              price_minor, currency_code, checked_at, inventory_status,
              verification_method, verification_note, last_verified_at,
              verification_expires_at
            ) values (
              ${savedProduct.id}, ${retailer.id}, ${offer.url}, ${market},
              ${offer.available}, ${offer.priceNgn ?? null},
              ${offer.priceNgn == null ? null : 'NGN'}, now(),
              ${inventoryStatus}, 'import', 'Seeded from the curated catalogue.',
              now(), now() + interval '7 days'
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
              updated_at = now()
          `;
        }
      }
    }
  });

  console.log(`Seeded ${catalogue.length} products into Neon.`);
} finally {
  await sql.end();
}
