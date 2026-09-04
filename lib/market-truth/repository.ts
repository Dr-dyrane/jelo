import "server-only";

import type { Sql } from "postgres";
import { nigeriaRetailers } from "@/data/retailers";
import { INVENTORY_DEFERRED_RECHECK_ERROR_CODE } from "@/lib/inventory/refresh-policy";
import { comparisonExcludedOfferIdentities } from "@/lib/market-truth/comparison-eligibility";
import type {
  InventoryMarketTruthFacts,
  PhysicalMarketTruthFacts,
  RetailerDiscoveryMarketTruthFacts,
  StaticRetailerMarketTruthFacts,
} from "@/lib/market-truth/types";

type InventoryRow = {
  observed_at: string;
  last_job_activity_at: string | null;
  recent_completed: number;
  recent_failed: number;
  recent_deferred: number;
  queued: number;
  due: number;
  processing: number;
  lease_expired: number;
  deferred: number;
  published_exact_offers: number;
  current_exact_offers: number;
  current_available_offers: number;
  stale_offers: number;
  priced_current_offers: number;
  priced_current_offers_with_history: number;
};

type RetailerDiscoveryRow = {
  observed_at: string;
  database_retailers: number;
  current_offer_retailers: number;
  published_products: number;
  products_with_known_exact_offer: number;
  products_with_current_exact_offer: number;
  products_without_known_exact_offer: number;
  products_without_current_exact_offer: number;
  pending_research_tasks: number;
  in_progress_research_tasks: number;
  oldest_open_research_at: string | null;
  submitted_retailer_applications: number;
  pending_market_reports: number;
};

type PhysicalMarketRow = {
  observed_at: string;
  published_markets: number;
  verified_locations: number;
  current_actionable_locations: number;
  locations_needing_recheck: number;
  disputed_locations: number;
  pending_location_evidence: number;
  pending_product_observations: number;
  stale_approved_product_observations: number;
  directory_product_contexts: number;
  current_product_contexts: number;
  pending_market_reports: number;
};

const comparisonExclusions = JSON.stringify(
  comparisonExcludedOfferIdentities(),
);

function requireRow<Row>(row: Row | undefined, source: string): Row {
  if (!row) throw new Error(`${source}_unavailable`);
  return row;
}

export function staticRetailerMarketTruthFacts(): StaticRetailerMarketTruthFacts {
  const identityEvidenceRecorded = nigeriaRetailers.filter(
    (retailer) => retailer.identityEvidence != null,
  ).length;
  return {
    registryRetailers: nigeriaRetailers.length,
    directoryListedRetailers: nigeriaRetailers.filter(
      (retailer) => retailer.reviewStatus === "directory-listed",
    ).length,
    provisionalRetailers: nigeriaRetailers.filter(
      (retailer) => retailer.reviewStatus === "provisional",
    ).length,
    identityEvidenceRecorded,
    identityEvidenceMissing: nigeriaRetailers.length - identityEvidenceRecorded,
    // The current static evidence contract records observation time but no
    // explicit review deadline. Keep currentness unknown instead of inventing it.
    identityEvidenceWithExpiry: 0,
    // Numeric trust and prose delivery/service notes have no reviewed-at and
    // expires-at pair in the canonical registry contract.
    trustEvidenceWithReviewWindow: 0,
    deliveryServiceEvidenceWithReviewWindow: 0,
  };
}

export async function readInventoryMarketTruthFacts(
  sql: Sql,
): Promise<InventoryMarketTruthFacts> {
  const deferredErrorPrefix = `${INVENTORY_DEFERRED_RECHECK_ERROR_CODE}:`;
  const [result] = await sql<InventoryRow[]>`
    with database_clock as (
      select now() as observed_at
    ),
    comparison_exclusions as (
      select exclusion.*
      from jsonb_to_recordset(${comparisonExclusions}::jsonb) as exclusion(
        product_slug text,
        retailer text,
        url text,
        normalized_url text
      )
    ),
    job_health as (
      select
        max(job.updated_at) as last_job_activity_at,
        count(*) filter (
          where job.status = 'completed'
            and job.completed_at >= database_clock.observed_at - interval '90 minutes'
        )::int as recent_completed,
        count(*) filter (
          where job.status = 'failed'
            and job.completed_at >= database_clock.observed_at - interval '90 minutes'
        )::int as recent_failed,
        count(*) filter (
          where job.status = 'queued'
            and left(job.last_error, char_length(${deferredErrorPrefix})) = ${deferredErrorPrefix}
            and job.next_attempt_at > database_clock.observed_at
            and job.updated_at >= database_clock.observed_at - interval '90 minutes'
        )::int as recent_deferred,
        count(*) filter (where job.status = 'queued')::int as queued,
        count(*) filter (
          where job.status = 'queued'
            and job.next_attempt_at <= database_clock.observed_at
        )::int as due,
        count(*) filter (where job.status = 'processing')::int as processing,
        count(*) filter (
          where job.status = 'processing'
            and (
              job.started_at is null
              or job.started_at <= database_clock.observed_at - interval '2 minutes'
            )
        )::int as lease_expired,
        count(*) filter (
          where job.status = 'queued'
            and left(job.last_error, char_length(${deferredErrorPrefix})) = ${deferredErrorPrefix}
            and job.next_attempt_at > database_clock.observed_at
        )::int as deferred
      from inventory_refresh_jobs job
      cross join database_clock
    ),
    exact_offers as (
      select
        offer.id,
        offer.available,
        offer.inventory_status,
        offer.price_minor,
        offer.currency_code,
        offer.verification_method,
        offer.last_verified_at,
        offer.observed_title,
        offer.observed_size,
        offer.verification_expires_at,
        (
          offer.verification_expires_at > database_clock.observed_at
          and offer.available = true
          and offer.inventory_status in ('in_stock', 'low_stock')
          and offer.price_minor > 0
          and offer.currency_code = 'NGN'
          and offer.verification_method in ('manual', 'retailer_page', 'api')
          and offer.last_verified_at is not null
          and offer.last_verified_at <= database_clock.observed_at
          and nullif(btrim(offer.observed_title), '') is not null
          and nullif(btrim(offer.observed_size), '') is not null
          and comparison_exclusion.product_slug is null
        ) as is_current
      from offers offer
      join products product on product.id = offer.product_id
      join retailers retailer on retailer.id = offer.retailer_id
      cross join database_clock
      left join comparison_exclusions comparison_exclusion
        on comparison_exclusion.product_slug = product.slug
        and comparison_exclusion.retailer = retailer.name
        and (
          comparison_exclusion.url = offer.url
          or comparison_exclusion.normalized_url = rtrim(split_part(offer.url, '#', 1), '/')
        )
      where product.is_published = true
        and offer.match_kind = 'exact'
        and offer.market_code = 'NG'
        and offer.url ~* '^https://'
    ),
    offer_health as (
      select
        count(*)::int as published_exact_offers,
        count(*) filter (
          where exact_offer.is_current
        )::int as current_exact_offers,
        count(*) filter (
          where exact_offer.is_current
        )::int as current_available_offers,
        count(*) filter (
          where (
            exact_offer.verification_expires_at is null
            or exact_offer.verification_expires_at <= database_clock.observed_at
          )
            and not exists (
              select 1
              from inventory_refresh_jobs pending_job
              where pending_job.offer_id = exact_offer.id
                and pending_job.status in ('queued', 'processing')
            )
        )::int as stale_offers,
        count(*) filter (
          where exact_offer.is_current
        )::int as priced_current_offers,
        count(*) filter (
          where exact_offer.is_current
            and exists (
              select 1
              from offer_price_history history
              where history.offer_id = exact_offer.id
                and history.currency_code = exact_offer.currency_code
                and history.price_minor = exact_offer.price_minor
                and history.observed_at = exact_offer.last_verified_at
                and history.source = exact_offer.verification_method
            )
        )::int as priced_current_offers_with_history
      from exact_offers exact_offer
      cross join database_clock
    )
    select
      database_clock.observed_at::text as observed_at,
      job_health.last_job_activity_at::text,
      job_health.recent_completed,
      job_health.recent_failed,
      job_health.recent_deferred,
      job_health.queued,
      job_health.due,
      job_health.processing,
      job_health.lease_expired,
      job_health.deferred,
      offer_health.published_exact_offers,
      offer_health.current_exact_offers,
      offer_health.current_available_offers,
      offer_health.stale_offers,
      offer_health.priced_current_offers,
      offer_health.priced_current_offers_with_history
    from database_clock
    cross join job_health
    cross join offer_health
  `;
  const row = requireRow(result, "inventory_market_truth");
  return {
    observedAt: row.observed_at,
    lastJobActivityAt: row.last_job_activity_at,
    recentCompleted: row.recent_completed,
    recentFailed: row.recent_failed,
    recentDeferred: row.recent_deferred,
    queued: row.queued,
    due: row.due,
    processing: row.processing,
    leaseExpired: row.lease_expired,
    deferred: row.deferred,
    publishedExactOffers: row.published_exact_offers,
    currentExactOffers: row.current_exact_offers,
    currentAvailableOffers: row.current_available_offers,
    staleOffers: row.stale_offers,
    pricedCurrentOffers: row.priced_current_offers,
    pricedCurrentOffersWithHistory: row.priced_current_offers_with_history,
  };
}

export async function readRetailerDiscoveryMarketTruthFacts(
  sql: Sql,
): Promise<RetailerDiscoveryMarketTruthFacts> {
  const [result] = await sql<RetailerDiscoveryRow[]>`
    with database_clock as (
      select now() as observed_at
    ),
    comparison_exclusions as (
      select exclusion.*
      from jsonb_to_recordset(${comparisonExclusions}::jsonb) as exclusion(
        product_slug text,
        retailer text,
        url text,
        normalized_url text
      )
    ),
    published_products as (
      select product.id, product.slug
      from products product
      where product.is_published = true
    ),
    current_exact_offers as (
      select offer.product_id, offer.retailer_id
      from offers offer
      join published_products product on product.id = offer.product_id
      join retailers retailer on retailer.id = offer.retailer_id
      cross join database_clock
      left join comparison_exclusions comparison_exclusion
        on comparison_exclusion.product_slug = product.slug
        and comparison_exclusion.retailer = retailer.name
        and (
          comparison_exclusion.url = offer.url
          or comparison_exclusion.normalized_url = rtrim(split_part(offer.url, '#', 1), '/')
        )
      where offer.match_kind = 'exact'
        and offer.market_code = 'NG'
        and offer.url ~* '^https://'
        and offer.verification_expires_at > database_clock.observed_at
        and offer.available = true
        and offer.inventory_status in ('in_stock', 'low_stock')
        and offer.price_minor > 0
        and offer.currency_code = 'NGN'
        and offer.verification_method in ('manual', 'retailer_page', 'api')
        and offer.last_verified_at is not null
        and offer.last_verified_at <= database_clock.observed_at
        and nullif(btrim(offer.observed_title), '') is not null
        and nullif(btrim(offer.observed_size), '') is not null
        and comparison_exclusion.product_slug is null
    ),
    product_offer_coverage as (
      select
        product.id,
        exists (
          select 1
          from offers offer
          where offer.product_id = product.id
            and offer.match_kind = 'exact'
            and offer.market_code = 'NG'
            and offer.url ~* '^https://'
        ) as has_known_exact_offer,
        exists (
          select 1
          from current_exact_offers current_offer
          where current_offer.product_id = product.id
        ) as has_current_exact_offer
      from published_products product
      cross join database_clock
    ),
    product_offer_summary as (
      select
        count(*) filter (where coverage.has_known_exact_offer)::int as products_with_known_exact_offer,
        count(*) filter (where coverage.has_current_exact_offer)::int as products_with_current_exact_offer,
        count(*) filter (where not coverage.has_known_exact_offer)::int as products_without_known_exact_offer,
        count(*) filter (where not coverage.has_current_exact_offer)::int as products_without_current_exact_offer
      from product_offer_coverage coverage
    )
    select
      database_clock.observed_at::text as observed_at,
      (select count(*)::int from retailers) as database_retailers,
      (
        select count(distinct current_offer.retailer_id)::int
        from current_exact_offers current_offer
      ) as current_offer_retailers,
      (select count(*)::int from published_products) as published_products,
      coverage.products_with_known_exact_offer,
      coverage.products_with_current_exact_offer,
      coverage.products_without_known_exact_offer,
      coverage.products_without_current_exact_offer,
      (
        select count(*)::int
        from community_research_tasks task
        where task.status = 'pending'
      ) as pending_research_tasks,
      (
        select count(*)::int
        from community_research_tasks task
        where task.status = 'in-progress'
      ) as in_progress_research_tasks,
      (
        select min(task.first_seen_at)::text
        from community_research_tasks task
        where task.status in ('pending', 'in-progress')
      ) as oldest_open_research_at,
      (
        select count(*)::int
        from retailer_partnership_applications application
        where application.status = 'submitted'
      ) as submitted_retailer_applications,
      (
        select count(*)::int
        from market_finder_reports report
        where report.moderation_status = 'pending'
      ) as pending_market_reports
    from database_clock
    cross join product_offer_summary coverage
  `;
  const row = requireRow(result, "retailer_discovery_market_truth");
  return {
    observedAt: row.observed_at,
    databaseRetailers: row.database_retailers,
    currentOfferRetailers: row.current_offer_retailers,
    publishedProducts: row.published_products,
    productsWithKnownExactOffer: row.products_with_known_exact_offer,
    productsWithCurrentExactOffer: row.products_with_current_exact_offer,
    productsWithoutKnownExactOffer: row.products_without_known_exact_offer,
    productsWithoutCurrentExactOffer: row.products_without_current_exact_offer,
    pendingResearchTasks: row.pending_research_tasks,
    inProgressResearchTasks: row.in_progress_research_tasks,
    oldestOpenResearchAt: row.oldest_open_research_at,
    submittedRetailerApplications: row.submitted_retailer_applications,
    pendingMarketReports: row.pending_market_reports,
  };
}

export async function readPhysicalMarketTruthFacts(
  sql: Sql,
): Promise<PhysicalMarketTruthFacts> {
  const [result] = await sql<PhysicalMarketRow[]>`
    with database_clock as (
      select now() as observed_at
    ),
    location_state as (
      select
        location.id,
        location.market_id,
        location.retailer_id,
        location.location_state,
        location.verification_expires_at,
        (
          location.primary_place_id is null
          or place.place_state = 'verified'
        ) as place_is_current,
        exists (
          select 1
          from retailer_location_evidence identity_evidence
          where identity_evidence.retailer_location_id = location.id
            and identity_evidence.evidence_scope = 'location_identity'
            and identity_evidence.channel_id is null
            and identity_evidence.decision = 'approved'
            and identity_evidence.source_method in (
              'field_visit',
              'retailer_confirmation',
              'branch_online_record',
              'partnership_application'
            )
            and identity_evidence.expires_at > database_clock.observed_at
        ) as has_current_identity,
        (
          exists (
            select 1
            from retailer_location_evidence directions_evidence
            where location.public_directions is not null
              and directions_evidence.retailer_location_id = location.id
              and directions_evidence.evidence_scope = 'public_directions'
              and directions_evidence.channel_id is null
              and directions_evidence.decision = 'approved'
              and directions_evidence.expires_at > database_clock.observed_at
              and public.market_finder_public_action_is_usable(
                'directions',
                location.public_directions
              )
          )
          or exists (
            select 1
            from retailer_location_channels channel
            join retailer_location_evidence channel_evidence
              on channel_evidence.channel_id = channel.id
              and channel_evidence.retailer_location_id = location.id
              and channel_evidence.evidence_scope = 'channel_ownership'
              and channel_evidence.decision = 'approved'
              and channel_evidence.expires_at > database_clock.observed_at
            where channel.retailer_location_id = location.id
              and channel.channel_state = 'verified'
              and channel.expires_at > database_clock.observed_at
              and public.market_finder_public_action_is_usable(
                channel.channel_kind::text,
                channel.public_destination
              )
          )
        ) as has_current_action
      from retailer_locations location
      cross join database_clock
      left join physical_market_places place
        on place.id = location.primary_place_id
        and place.market_id = location.market_id
    ),
    latest_approved_observations as (
      select observation.*
      from physical_product_observations observation
      where observation.moderation_status = 'approved'
        and not exists (
          select 1
          from physical_product_observations successor
          where successor.supersedes_observation_id = observation.id
            and successor.moderation_status = 'approved'
        )
    ),
    public_observation_contexts as (
      select
        market.id as market_id,
        identity.identity_version_id,
        observation.expires_at,
        observation.availability,
        location.location_state,
        location.verification_expires_at,
        location.place_is_current,
        location.has_current_identity,
        location.has_current_action,
        market.publication_state,
        product.is_published,
        identity.lifecycle_state
      from latest_approved_observations observation
      join location_state location on location.id = observation.retailer_location_id
      join physical_markets market on market.id = location.market_id
      join catalogue_product_identity_versions identity
        on identity.identity_version_id = observation.product_identity_version_id
      join products product on product.id = identity.product_id
    )
    select
      database_clock.observed_at::text as observed_at,
      (
        select count(*)::int
        from physical_markets market
        where market.publication_state = 'published'
      ) as published_markets,
      (
        select count(*)::int
        from location_state location
        where location.location_state = 'verified'
      ) as verified_locations,
      (
        select count(*)::int
        from location_state location
        where location.location_state = 'verified'
          and location.verification_expires_at > database_clock.observed_at
          and location.place_is_current
          and location.has_current_identity
          and location.has_current_action
      ) as current_actionable_locations,
      (
        select count(*)::int
        from location_state location
        where location.location_state = 'verified'
          and not (
            location.verification_expires_at > database_clock.observed_at
            and location.place_is_current
            and location.has_current_identity
            and location.has_current_action
          )
      ) as locations_needing_recheck,
      (
        select count(*)::int
        from location_state location
        where location.location_state = 'disputed'
      ) as disputed_locations,
      (
        select count(*)::int
        from retailer_location_evidence evidence
        where evidence.decision = 'pending'
      ) as pending_location_evidence,
      (
        select count(*)::int
        from physical_product_observations observation
        where observation.moderation_status = 'pending'
      ) as pending_product_observations,
      (
        select count(*)::int
        from latest_approved_observations observation
        where observation.expires_at <= database_clock.observed_at
      ) as stale_approved_product_observations,
      (
        select count(distinct (context.market_id, context.identity_version_id))::int
        from public_observation_contexts context
        where context.publication_state = 'published'
          and context.is_published = true
          and context.lifecycle_state = 'active'
      ) as directory_product_contexts,
      (
        select count(distinct (context.market_id, context.identity_version_id))::int
        from public_observation_contexts context
        where context.publication_state = 'published'
          and context.is_published = true
          and context.lifecycle_state = 'active'
          and context.location_state = 'verified'
          and context.verification_expires_at > database_clock.observed_at
          and context.place_is_current
          and context.has_current_identity
          and context.has_current_action
          and context.expires_at > database_clock.observed_at
          and context.availability in ('in_stock', 'low_stock')
      ) as current_product_contexts,
      (
        select count(*)::int
        from market_finder_reports report
        where report.moderation_status = 'pending'
      ) as pending_market_reports
    from database_clock
  `;
  const row = requireRow(result, "physical_market_truth");
  return {
    observedAt: row.observed_at,
    publishedMarkets: row.published_markets,
    verifiedLocations: row.verified_locations,
    currentActionableLocations: row.current_actionable_locations,
    locationsNeedingRecheck: row.locations_needing_recheck,
    disputedLocations: row.disputed_locations,
    pendingLocationEvidence: row.pending_location_evidence,
    pendingProductObservations: row.pending_product_observations,
    staleApprovedProductObservations: row.stale_approved_product_observations,
    directoryProductContexts: row.directory_product_contexts,
    currentProductContexts: row.current_product_contexts,
    pendingMarketReports: row.pending_market_reports,
  };
}
