import type { Sql } from 'postgres';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';
import type { ManualObservationCommand } from './manual-observation-command';

export type ManualOperator = {
  auth_subject: string;
  role: 'operator' | 'admin';
};

export type ManualObservationOffer = {
  id: string;
  url: string;
  market_code: string;
  product_slug: string;
  product_name: string;
  product_size: string;
  brand_name: string;
};

export async function resolveManualInventoryOperator(sql: Sql): Promise<ManualOperator> {
  const email = process.env.MODERATION_OPERATOR_EMAIL?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('MODERATION_OPERATOR_EMAIL must be a valid operator email.');
  }
  const rows = await sql<ManualOperator[]>`
    select auth_subject, role
    from moderation_operators
    where lower(email) = lower(${email})
      and active = true
      and role in ('operator', 'admin')
    limit 2
  `;
  if (rows.length !== 1) {
    throw new Error('MODERATION_OPERATOR_EMAIL must identify exactly one active operator or admin.');
  }
  return rows[0];
}

export async function resolveExactManualObservationOffer(
  sql: Sql,
  command: Pick<ManualObservationCommand, 'productSlug' | 'retailer' | 'url' | 'marketCode'>,
): Promise<ManualObservationOffer> {
  const rows = await sql<ManualObservationOffer[]>`
    select
      o.id,
      o.url,
      o.market_code,
      p.slug as product_slug,
      p.name as product_name,
      p.size as product_size,
      b.name as brand_name
    from offers o
    join products p on p.id = o.product_id
    join brands b on b.id = p.brand_id
    join retailers r on r.id = o.retailer_id
    where p.slug = ${command.productSlug}
      and p.is_published = true
      and lower(r.name) = lower(${command.retailer})
      and o.match_kind = 'exact'
      and (${command.url ?? null}::text is null or o.url = ${command.url ?? null})
      and (${command.marketCode ?? null}::text is null or o.market_code = ${command.marketCode ?? null})
    order by o.market_code
    limit 2
  `;
  if (rows.length !== 1) {
    throw new Error('Product slug, retailer, and optional URL or market code must resolve exactly one existing exact offer.');
  }
  return rows[0];
}

export function assertManualObservationScope(offer: ManualObservationOffer, command: ManualObservationCommand) {
  const url = new URL(offer.url);
  if (url.protocol !== 'https:') throw new Error('The existing offer URL must use https.');
  assertRetailerResponseScope({
    requestedUrl: offer.url,
    responseUrl: offer.url,
    expectedTitle: `${offer.brand_name} ${offer.product_name}`,
    expectedSize: offer.product_size,
    observedTitle: command.observedTitle,
    observedSize: command.observedSize,
    marketCode: offer.market_code,
    currencyCode: command.priceNaira == null ? undefined : 'NGN',
  });
}

export async function applyManualObservation(
  sql: Sql,
  offer: ManualObservationOffer,
  command: ManualObservationCommand,
  operator: ManualOperator,
) {
  const available = command.stock === 'in_stock' || command.stock === 'low_stock';
  const note = `Manual browser verification. Evidence: ${command.evidenceNote} Rationale: ${command.rationale}`;
  const evidence = JSON.stringify([{
    kind: 'manual_browser_verification',
    offerUrl: offer.url,
    observedTitle: command.observedTitle,
    observedSize: command.observedSize,
    inventoryStatus: command.stock,
    priceNaira: command.priceNaira ?? null,
    evidenceNote: command.evidenceNote,
    rationale: command.rationale,
  }]);

  return sql.begin(async transaction => {
    const updated = await transaction<{ id: string }[]>`
      update offers o
      set
        inventory_status = ${command.stock},
        available = ${available},
        price_minor = case when ${command.priceNaira ?? null}::bigint is null then o.price_minor else ${command.priceNaira ?? null}::bigint end,
        currency_code = case when ${command.priceNaira ?? null}::bigint is null then o.currency_code else 'NGN' end,
        verification_method = 'manual',
        verification_note = ${note},
        extraction_confidence = 100,
        extraction_evidence = coalesce(o.extraction_evidence, '[]'::jsonb) || ${evidence}::jsonb,
        extraction_adapter = 'manual_browser',
        observed_title = ${command.observedTitle},
        observed_size = ${command.observedSize},
        canonical_url = o.url,
        checked_at = now(),
        last_verified_at = now(),
        verification_expires_at = now() + (${command.validForHours} * interval '1 hour'),
        updated_at = now()
      where o.id = ${offer.id}
        and o.match_kind = 'exact'
        and o.url = ${offer.url}
        and o.market_code = ${offer.market_code}
        and exists (
          select 1
          from products p
          where p.id = o.product_id
            and p.is_published = true
        )
      returning o.id
    `;
    if (updated.length !== 1) {
      throw new Error('The exact offer changed before it could be recorded. Run a new dry run.');
    }

    if (command.priceNaira != null) {
      await transaction`
        insert into offer_price_history (offer_id, price_minor, currency_code, observed_at, source)
        values (${offer.id}, ${command.priceNaira}, 'NGN', now(), 'manual')
      `;
    }

    const settled = await transaction<{ id: string }[]>`
      update inventory_refresh_jobs
      set status = 'completed', last_error = null, completed_at = now(), updated_at = now()
      where offer_id = ${offer.id}
        and status in ('queued', 'processing')
      returning id
    `;
    await transaction`
      insert into moderation_audit_log (
        operator_subject, queue, action, target_ref, canonical_write, rationale, metadata
      ) values (
        ${operator.auth_subject}, 'commerce_signal', 'promote', ${offer.id}, true,
        ${command.rationale},
        ${JSON.stringify({
          kind: 'manual_inventory_observation',
          productSlug: offer.product_slug,
          marketCode: offer.market_code,
          recordedPrice: command.priceNaira != null,
          validForHours: command.validForHours,
          settledRefreshJobs: settled.length,
        })}::jsonb
      )
    `;
    return { settledRefreshJobs: settled.length };
  });
}
