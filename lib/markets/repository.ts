import "server-only";

import { unstable_cache } from "next/cache";
import {
  isMarketFinderPublicMarketAllowed,
  isMarketFinderPublicReadEnabled,
  type MarketFinderActivationEnvironment,
} from "@/lib/markets/activation";
import {
  enforceMarketFinderFreshness,
  isMarketFinderSlug,
  marketFinderDirectoryNonCurrent,
  marketFinderNonCurrent,
  normalizeMarketFinderPublicAction,
  type ActionablePhysicalObservationSource,
  type CurrentMarketFinderLocation,
  type MarketFinderActionKind,
  type MarketFinderContext,
  type MarketFinderDirectoryModel,
  type MarketFinderMarket,
  type MarketFinderProductIdentity,
  type MarketFinderReadModel,
  type MarketFinderResearchLocation,
  type MarketFinderResearchRecord,
  type MarketReportTargetResolution,
} from "@/lib/markets/domain";
import {
  marketFinderDirectoryCacheTags,
  marketFinderReadCacheTags,
} from "@/lib/markets/cache";
import {
  getPostgresClient,
  hasPostgresConfig,
  type PostgresClient,
} from "@/lib/db/postgres";

type DateValue = Date | string;

type MarketRow = {
  market_id: string;
  market_slug: string;
  market_name: string;
  city: string;
  state_region: string;
  country_code: string;
};

type ProductIdentityRow = {
  product_identity_version_id: string;
  product_id: string;
  product_slug: string;
  product_brand: string;
  product_variant: string;
  product_size: string;
  package_version: string;
  formula_version: string;
};

type MarketContextRow = MarketRow & ProductIdentityRow;

type CurrentLocationRow = {
  location_id: string;
  location_slug: string;
  location_name: string;
  retailer_name: string;
  place_name: string | null;
  shop_number: string | null;
  floor: string | null;
  location_expires_at: DateValue;
  identity_evidence_expires_at: DateValue;
  observation_id: string;
  availability: "in_stock" | "low_stock";
  price_ngn: string | number | null;
  observed_at: DateValue;
  observation_expires_at: DateValue;
  source_method: ActionablePhysicalObservationSource;
  observed_title: string;
  observed_size: string;
  action_kind: MarketFinderActionKind;
  action_destination: string;
  action_expires_at: DateValue;
};

type ResearchLocationRow = Omit<
  CurrentLocationRow,
  | "availability"
  | "price_ngn"
  | "action_kind"
  | "action_destination"
  | "action_expires_at"
> & {
  availability: MarketFinderResearchLocation["observation"]["availability"];
  observation_moderation_status:
    "pending" | "approved" | "rejected" | "superseded";
};

type DiagnosticRow = {
  approved_observation_count: number;
  has_disputed: boolean;
  has_location_needs_recheck: boolean;
  has_stale: boolean;
  has_stock_unavailable: boolean;
  has_no_usable_action: boolean;
};

type MarketReportTargetRow = {
  market_id: string;
  market_slug: string;
  market_name: string;
  retailer_location_id: string;
  location_slug: string;
  location_name: string;
  product_identity_version_id: string;
  product_id: string;
  product_slug: string;
  product_brand: string;
  product_variant: string;
  product_size: string;
  location_state: "lead" | "verified" | "disputed" | "retired";
  location_expires_at: DateValue;
  place_state: "lead" | "verified" | "disputed" | "retired" | null;
  identity_evidence_expires_at: DateValue;
  observation_moderation_status:
    "pending" | "approved" | "rejected" | "superseded";
  observation_availability: MarketFinderResearchLocation["observation"]["availability"];
  observation_expires_at: DateValue;
  action_kind: MarketFinderActionKind;
  action_destination: string;
  action_expires_at: DateValue;
};

export type MarketFinderRepositoryOptions = {
  client?: PostgresClient;
  environment?: MarketFinderActivationEnvironment;
  now?: Date;
};

function iso(value: DateValue): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Market Finder received an invalid database timestamp.");
  }
  return date.toISOString();
}

function normalizeNow(value: Date | undefined): Date {
  const now = value ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Market Finder requires a valid evaluation time.");
  }
  return now;
}

function mapMarket(row: MarketRow): MarketFinderMarket {
  return {
    id: row.market_id,
    slug: row.market_slug,
    name: row.market_name,
    city: row.city,
    stateRegion: row.state_region,
    countryCode: row.country_code,
  };
}

function mapProductIdentity(
  row: ProductIdentityRow,
): MarketFinderProductIdentity {
  return {
    identityVersionId: row.product_identity_version_id,
    productId: row.product_id,
    slug: row.product_slug,
    brand: row.product_brand,
    variant: row.product_variant,
    size: row.product_size,
    packageVersion: row.package_version,
    formulaVersion: row.formula_version,
  };
}

function mapContext(row: MarketContextRow): MarketFinderContext {
  return { market: mapMarket(row), product: mapProductIdentity(row) };
}

function mapCurrentLocation(
  row: CurrentLocationRow,
): CurrentMarketFinderLocation | null {
  const numericPrice = row.price_ngn === null ? null : Number(row.price_ngn);
  if (
    numericPrice !== null &&
    (!Number.isFinite(numericPrice) || numericPrice <= 0)
  ) {
    throw new Error("Market Finder received an invalid approved price.");
  }

  const action = normalizeMarketFinderPublicAction({
    kind: row.action_kind,
    destination: row.action_destination,
  });
  if (!action) return null;

  return {
    id: row.location_id,
    slug: row.location_slug,
    name: row.location_name,
    retailerName: row.retailer_name,
    placeName: row.place_name,
    shopNumber: row.shop_number,
    floor: row.floor,
    locationVerificationExpiresAt: iso(row.location_expires_at),
    locationIdentityEvidenceExpiresAt: iso(row.identity_evidence_expires_at),
    observation: {
      id: row.observation_id,
      availability: row.availability,
      priceNgn: numericPrice,
      observedAt: iso(row.observed_at),
      expiresAt: iso(row.observation_expires_at),
      sourceMethod: row.source_method,
      observedTitle: row.observed_title,
      observedSize: row.observed_size,
    },
    action: { ...action, expiresAt: iso(row.action_expires_at) },
  };
}

function mapResearchLocation(
  row: ResearchLocationRow,
  reason: MarketFinderResearchLocation["reason"],
): MarketFinderResearchLocation {
  return {
    kind: "location",
    id: row.location_id,
    reason,
    slug: row.location_slug,
    name: row.location_name,
    retailerName: row.retailer_name,
    placeName: row.place_name,
    shopNumber: row.shop_number,
    floor: row.floor,
    locationVerificationExpiresAt: iso(row.location_expires_at),
    locationIdentityEvidenceExpiresAt: iso(row.identity_evidence_expires_at),
    observation: {
      id: row.observation_id,
      availability: row.availability,
      observedAt: iso(row.observed_at),
      expiresAt: iso(row.observation_expires_at),
      sourceMethod: row.source_method,
      observedTitle: row.observed_title,
      observedSize: row.observed_size,
    },
  };
}

async function queryPublishedMarket(
  sql: PostgresClient,
  marketSlug: string,
): Promise<MarketRow | undefined> {
  const [row] = await sql<MarketRow[]>`
    select
      market.id as market_id,
      market.slug as market_slug,
      market.public_name as market_name,
      market.city,
      market.state_region,
      market.country_code
    from physical_markets market
    where market.slug = ${marketSlug}
      and market.publication_state = 'published'
    limit 1
  `;
  return row;
}

async function queryDirectoryProducts(
  sql: PostgresClient,
  marketId: string,
): Promise<ProductIdentityRow[]> {
  return sql<ProductIdentityRow[]>`
    select distinct
      identity_version.identity_version_id as product_identity_version_id,
      product.id as product_id,
      product.slug as product_slug,
      identity_version.brand_at_review as product_brand,
      identity_version.variant_at_review as product_variant,
      identity_version.size_at_review as product_size,
      identity_version.package_version_at_review as package_version,
      identity_version.formula_version_at_review as formula_version
    from physical_product_observations directory_observation
    join retailer_locations directory_location
      on directory_location.id = directory_observation.retailer_location_id
      and directory_location.market_id = ${marketId}
    join catalogue_product_identity_versions identity_version
      on identity_version.identity_version_id = directory_observation.product_identity_version_id
      and identity_version.lifecycle_state = 'active'
    join products product
      on product.id = identity_version.product_id
      and product.is_published = true
    where directory_observation.moderation_status = 'approved'
    order by
      identity_version.brand_at_review,
      identity_version.variant_at_review,
      identity_version.size_at_review,
      identity_version.identity_version_id
  `;
}

async function queryMarketFinderDirectory(input: {
  marketSlug: string;
  client: PostgresClient;
  now: Date;
}): Promise<MarketFinderDirectoryModel> {
  const marketRow = await queryPublishedMarket(input.client, input.marketSlug);
  if (!marketRow) {
    return marketFinderDirectoryNonCurrent({
      state: "empty",
      reason: "no-published-context",
      evaluatedAt: input.now,
    });
  }

  const market = mapMarket(marketRow);
  const productRows = await queryDirectoryProducts(
    input.client,
    marketRow.market_id,
  );
  if (productRows.length === 0) {
    return marketFinderDirectoryNonCurrent({
      state: "empty",
      reason: "no-approved-observation",
      market,
      evaluatedAt: input.now,
    });
  }

  return {
    state: "current",
    market,
    products: productRows.map(mapProductIdentity),
    evaluatedAt: input.now.toISOString(),
  };
}

async function queryPublishedContext(
  sql: PostgresClient,
  input: { marketSlug: string; productSlug: string },
): Promise<MarketContextRow | undefined> {
  const [row] = await sql<MarketContextRow[]>`
    select
      market.id as market_id,
      market.slug as market_slug,
      market.public_name as market_name,
      market.city,
      market.state_region,
      market.country_code,
      identity_version.identity_version_id as product_identity_version_id,
      product.id as product_id,
      product.slug as product_slug,
      identity_version.brand_at_review as product_brand,
      identity_version.variant_at_review as product_variant,
      identity_version.size_at_review as product_size,
      identity_version.package_version_at_review as package_version,
      identity_version.formula_version_at_review as formula_version
    from physical_markets market
    join products product
      on product.slug = ${input.productSlug}
      and product.is_published = true
    join catalogue_product_identity_versions identity_version
      on identity_version.product_id = product.id
      and identity_version.lifecycle_state = 'active'
    where market.slug = ${input.marketSlug}
      and market.publication_state = 'published'
      and exists (
        select 1
        from physical_product_observations supported_observation
        join retailer_locations supported_location
          on supported_location.id = supported_observation.retailer_location_id
          and supported_location.market_id = market.id
        where supported_observation.product_identity_version_id = identity_version.identity_version_id
          and supported_observation.moderation_status = 'approved'
      )
    limit 1
  `;
  return row;
}

async function queryCurrentLocations(
  sql: PostgresClient,
  context: MarketContextRow,
  now: Date,
): Promise<CurrentLocationRow[]> {
  return sql<CurrentLocationRow[]>`
    select
      location.id as location_id,
      location.slug as location_slug,
      location.public_name as location_name,
      retailer.name as retailer_name,
      place.public_name as place_name,
      location.shop_number,
      location.floor,
      location.verification_expires_at as location_expires_at,
      identity_evidence.expires_at as identity_evidence_expires_at,
      observation.id as observation_id,
      observation.availability,
      observation.price_ngn,
      observation.observed_at,
      observation.expires_at as observation_expires_at,
      observation.source_method,
      observation.observed_title,
      observation.observed_size,
      action.action_kind,
      action.action_destination,
      action.action_expires_at
    from retailer_locations location
    join retailers retailer on retailer.id = location.retailer_id
    left join physical_market_places place
      on place.id = location.primary_place_id
      and place.market_id = location.market_id
    join lateral (
      select max(identity_candidate.expires_at) as expires_at
      from retailer_location_evidence identity_candidate
      where identity_candidate.retailer_location_id = location.id
        and identity_candidate.evidence_scope = 'location_identity'
        and identity_candidate.channel_id is null
        and identity_candidate.decision = 'approved'
        and identity_candidate.source_method in (
          'field_visit',
          'retailer_confirmation',
          'branch_online_record',
          'partnership_application'
        )
    ) identity_evidence on identity_evidence.expires_at > ${now}
    join lateral (
      select candidate.*
      from (
        select
          'directions'::text as action_kind,
          location.public_directions as action_destination,
          least(
            location.verification_expires_at,
            directions_evidence.expires_at
          ) as action_expires_at,
          0 as preference
        from retailer_location_evidence directions_evidence
        where location.public_directions is not null
          and directions_evidence.retailer_location_id = location.id
          and directions_evidence.evidence_scope = 'public_directions'
          and directions_evidence.channel_id is null
          and directions_evidence.decision = 'approved'
        union all
        select
          case channel.channel_kind
            when 'physical_visit' then 'visit'
            else channel.channel_kind::text
          end as action_kind,
          channel.public_destination as action_destination,
          least(
            location.verification_expires_at,
            channel.expires_at,
            channel_evidence.expires_at
          ) as action_expires_at,
          case channel.channel_kind
            when 'whatsapp' then 1
            when 'phone' then 2
            when 'physical_visit' then 3
            when 'website' then 4
            else 5
          end as preference
        from retailer_location_channels channel
        join retailer_location_evidence channel_evidence
          on channel_evidence.channel_id = channel.id
          and channel_evidence.retailer_location_id = location.id
          and channel_evidence.evidence_scope = 'channel_ownership'
          and channel_evidence.decision = 'approved'
        where channel.retailer_location_id = location.id
          and channel.channel_state = 'verified'
      ) candidate
      where candidate.action_destination is not null
        and public.market_finder_public_action_is_usable(
          candidate.action_kind,
          candidate.action_destination
        )
        and candidate.action_expires_at > ${now}
    ) action on true
    join lateral (
      select approved_observation.*
      from physical_product_observations approved_observation
      where approved_observation.retailer_location_id = location.id
        and approved_observation.product_identity_version_id = ${context.product_identity_version_id}
        and approved_observation.moderation_status = 'approved'
        and not exists (
          select 1
          from physical_product_observations approved_successor
          where approved_successor.supersedes_observation_id = approved_observation.id
            and approved_successor.moderation_status = 'approved'
        )
      order by
        approved_observation.observed_at desc,
        approved_observation.created_at desc,
        approved_observation.id desc
      limit 1
    ) observation on true
    where location.market_id = ${context.market_id}
      and location.location_state = 'verified'
      and location.verification_expires_at > ${now}
      and (
        location.primary_place_id is null
        or place.place_state = 'verified'
      )
      and observation.expires_at > ${now}
      and observation.availability in ('in_stock', 'low_stock')
    order by
      observation.observed_at desc,
      location.public_name,
      location.id,
      action.preference,
      action.action_expires_at desc
  `;
}

async function queryResearchLocationCandidates(
  sql: PostgresClient,
  context: MarketContextRow,
  now: Date,
): Promise<ResearchLocationRow[]> {
  return sql<ResearchLocationRow[]>`
    select
      location.id as location_id,
      location.slug as location_slug,
      location.public_name as location_name,
      retailer.name as retailer_name,
      place.public_name as place_name,
      location.shop_number,
      location.floor,
      location.verification_expires_at as location_expires_at,
      identity_evidence.expires_at as identity_evidence_expires_at,
      observation.id as observation_id,
      observation.availability,
      observation.observed_at,
      observation.expires_at as observation_expires_at,
      observation.source_method,
      observation.observed_title,
      observation.observed_size,
      observation.moderation_status as observation_moderation_status
    from retailer_locations location
    join retailers retailer on retailer.id = location.retailer_id
    left join physical_market_places place
      on place.id = location.primary_place_id
      and place.market_id = location.market_id
    join lateral (
      select max(identity_candidate.expires_at) as expires_at
      from retailer_location_evidence identity_candidate
      where identity_candidate.retailer_location_id = location.id
        and identity_candidate.evidence_scope = 'location_identity'
        and identity_candidate.channel_id is null
        and identity_candidate.decision = 'approved'
        and identity_candidate.source_method in (
          'field_visit',
          'retailer_confirmation',
          'branch_online_record',
          'partnership_application'
        )
    ) identity_evidence on identity_evidence.expires_at > ${now}
    join lateral (
      select approved_observation.*
      from physical_product_observations approved_observation
      where approved_observation.retailer_location_id = location.id
        and approved_observation.product_identity_version_id = ${context.product_identity_version_id}
        and approved_observation.moderation_status = 'approved'
        and not exists (
          select 1
          from physical_product_observations approved_successor
          where approved_successor.supersedes_observation_id = approved_observation.id
            and approved_successor.moderation_status = 'approved'
        )
      order by
        approved_observation.observed_at desc,
        approved_observation.created_at desc,
        approved_observation.id desc
      limit 1
    ) observation on true
    where location.market_id = ${context.market_id}
      and location.location_state = 'verified'
      and location.verification_expires_at > ${now}
      and (
        location.primary_place_id is null
        or place.place_state = 'verified'
      )
    order by observation.observed_at desc, location.public_name, location.id
  `;
}

async function queryDiagnostics(
  sql: PostgresClient,
  context: MarketContextRow,
  now: Date,
): Promise<DiagnosticRow> {
  const [diagnostic] = await sql<DiagnosticRow[]>`
    select
      count(observation.id)::integer as approved_observation_count,
      coalesce(bool_or(
        location.location_state = 'disputed'
        or place.place_state = 'disputed'
      ), false) as has_disputed,
      coalesce(bool_or(
        location.location_state = 'verified'
        and (
          location.verification_expires_at <= ${now}
          or (
            location.primary_place_id is not null
            and place.place_state is distinct from 'verified'
          )
          or (
            not evidence_signal.has_current_identity_evidence
            and evidence_signal.has_expired_identity_evidence
          )
        )
      ), false) as has_location_needs_recheck,
      coalesce(bool_or(
        location.location_state = 'verified'
        and (
          location.verification_expires_at <= ${now}
          or observation.expires_at <= ${now}
          or (
            not evidence_signal.has_current_identity_evidence
            and evidence_signal.has_expired_identity_evidence
          )
          or (
            observation.expires_at > ${now}
            and observation.availability in ('in_stock', 'low_stock')
            and not evidence_signal.has_current_action
            and evidence_signal.has_expired_action
          )
        )
      ), false) as has_stale,
      coalesce(bool_or(
        observation.expires_at > ${now}
        and observation.availability not in ('in_stock', 'low_stock')
      ), false) as has_stock_unavailable,
      coalesce(bool_or(
        observation.expires_at > ${now}
        and observation.availability in ('in_stock', 'low_stock')
        and (
          location.location_state <> 'verified'
          or location.verification_expires_at <= ${now}
          or (location.primary_place_id is not null and place.place_state <> 'verified')
          or not evidence_signal.has_current_identity_evidence
          or not evidence_signal.has_current_action
        )
      ), false) as has_no_usable_action
    from retailer_locations location
    left join physical_market_places place
      on place.id = location.primary_place_id
      and place.market_id = location.market_id
    join lateral (
      select approved_observation.*
      from physical_product_observations approved_observation
      where approved_observation.retailer_location_id = location.id
        and approved_observation.product_identity_version_id = ${context.product_identity_version_id}
        and approved_observation.moderation_status = 'approved'
        and not exists (
          select 1
          from physical_product_observations approved_successor
          where approved_successor.supersedes_observation_id = approved_observation.id
            and approved_successor.moderation_status = 'approved'
        )
      order by
        approved_observation.observed_at desc,
        approved_observation.created_at desc,
        approved_observation.id desc
      limit 1
    ) observation on true
    cross join lateral (
      select
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
            and identity_evidence.expires_at > ${now}
        ) as has_current_identity_evidence,
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
            and identity_evidence.expires_at <= ${now}
        ) as has_expired_identity_evidence,
        (
          exists (
            select 1
            from retailer_location_evidence directions_evidence
            where location.public_directions is not null
              and public.market_finder_public_action_is_usable(
                'directions',
                location.public_directions
              )
              and directions_evidence.retailer_location_id = location.id
              and directions_evidence.evidence_scope = 'public_directions'
              and directions_evidence.channel_id is null
              and directions_evidence.decision = 'approved'
              and directions_evidence.expires_at > ${now}
          )
          or exists (
            select 1
            from retailer_location_channels channel
            join retailer_location_evidence channel_evidence
              on channel_evidence.channel_id = channel.id
              and channel_evidence.retailer_location_id = location.id
              and channel_evidence.evidence_scope = 'channel_ownership'
              and channel_evidence.decision = 'approved'
            where channel.retailer_location_id = location.id
              and channel.channel_state = 'verified'
              and public.market_finder_public_action_is_usable(
                channel.channel_kind::text,
                channel.public_destination
              )
              and channel.expires_at > ${now}
              and channel_evidence.expires_at > ${now}
          )
        ) as has_current_action,
        (
          exists (
            select 1
            from retailer_location_evidence directions_evidence
            where location.public_directions is not null
              and public.market_finder_public_action_is_usable(
                'directions',
                location.public_directions
              )
              and directions_evidence.retailer_location_id = location.id
              and directions_evidence.evidence_scope = 'public_directions'
              and directions_evidence.channel_id is null
              and directions_evidence.decision = 'approved'
              and directions_evidence.expires_at <= ${now}
          )
          or exists (
            select 1
            from retailer_location_channels channel
            join retailer_location_evidence channel_evidence
              on channel_evidence.channel_id = channel.id
              and channel_evidence.retailer_location_id = location.id
              and channel_evidence.evidence_scope = 'channel_ownership'
              and channel_evidence.decision = 'approved'
            where channel.retailer_location_id = location.id
              and channel.channel_state = 'verified'
              and public.market_finder_public_action_is_usable(
                channel.channel_kind::text,
                channel.public_destination
              )
              and least(channel.expires_at, channel_evidence.expires_at) <= ${now}
          )
        ) as has_expired_action
    ) evidence_signal
    where location.market_id = ${context.market_id}
  `;

  return (
    diagnostic ?? {
      approved_observation_count: 0,
      has_disputed: false,
      has_location_needs_recheck: false,
      has_stale: false,
      has_stock_unavailable: false,
      has_no_usable_action: false,
    }
  );
}

async function queryMarketFinderReadModel(input: {
  marketSlug: string;
  productSlug: string;
  client: PostgresClient;
  now: Date;
}): Promise<MarketFinderReadModel> {
  const contextRow = await queryPublishedContext(input.client, input);
  if (!contextRow) {
    return marketFinderNonCurrent({
      state: "empty",
      reason: "no-published-context",
      evaluatedAt: input.now,
    });
  }

  const context = mapContext(contextRow);
  const [rows, researchRows, diagnostic] = await Promise.all([
    queryCurrentLocations(input.client, contextRow, input.now),
    queryResearchLocationCandidates(input.client, contextRow, input.now),
    queryDiagnostics(input.client, contextRow, input.now),
  ]);
  const resolvedLocationIds = new Set<string>();
  const locations: CurrentMarketFinderLocation[] = [];
  for (const row of rows) {
    if (resolvedLocationIds.has(row.location_id)) continue;
    const location = mapCurrentLocation(row);
    if (!location) continue;
    resolvedLocationIds.add(row.location_id);
    locations.push(location);
  }

  const researchRecords: MarketFinderResearchRecord[] = [];
  const researchLocationIds = new Set<string>();
  for (const row of researchRows) {
    if (
      row.observation_moderation_status !== "approved" ||
      resolvedLocationIds.has(row.location_id) ||
      researchLocationIds.has(row.location_id)
    ) {
      continue;
    }

    const observationExpiresAt = new Date(row.observation_expires_at).getTime();
    const reason: MarketFinderResearchLocation["reason"] =
      !Number.isFinite(observationExpiresAt) ||
      observationExpiresAt <= input.now.getTime()
        ? "evidence-expired"
        : row.availability === "in_stock" || row.availability === "low_stock"
          ? "no-usable-action"
          : "stock-unavailable";
    researchRecords.push(mapResearchLocation(row, reason));
    researchLocationIds.add(row.location_id);
  }
  if (diagnostic.has_location_needs_recheck) {
    researchRecords.push({
      kind: "warning",
      id: "location-needs-recheck",
      reason: "location-needs-recheck",
    });
  }
  if (diagnostic.has_disputed) {
    researchRecords.push({
      kind: "warning",
      id: "location-disputed",
      reason: "location-disputed",
    });
  }

  if (locations.length > 0) {
    return {
      state: "current",
      context,
      locations,
      researchRecords,
      evaluatedAt: input.now.toISOString(),
    };
  }

  if (diagnostic.has_disputed) {
    return marketFinderNonCurrent({
      state: "disputed",
      reason: "location-disputed",
      context,
      researchRecords,
      evaluatedAt: input.now,
    });
  }
  if (
    researchRecords.some((record) => record.reason === "evidence-expired") ||
    diagnostic.has_stale
  ) {
    return marketFinderNonCurrent({
      state: "stale",
      reason: "evidence-expired",
      context,
      researchRecords,
      evaluatedAt: input.now,
    });
  }
  if (
    researchRecords.some((record) => record.reason === "stock-unavailable") ||
    diagnostic.has_stock_unavailable
  ) {
    return marketFinderNonCurrent({
      state: "unavailable",
      reason: "stock-unavailable",
      context,
      researchRecords,
      evaluatedAt: input.now,
    });
  }
  if (
    researchRecords.some((record) => record.reason === "no-usable-action") ||
    diagnostic.has_no_usable_action ||
    rows.length > 0
  ) {
    return marketFinderNonCurrent({
      state: "unavailable",
      reason: "no-usable-action",
      context,
      researchRecords,
      evaluatedAt: input.now,
    });
  }

  return marketFinderNonCurrent({
    state: "empty",
    reason: "no-approved-observation",
    context,
    evaluatedAt: input.now,
  });
}

async function readCachedMarketFinder(
  marketSlug: string,
  productSlug: string,
): Promise<MarketFinderReadModel> {
  const cached = unstable_cache(
    async () =>
      queryMarketFinderReadModel({
        marketSlug,
        productSlug,
        client: getPostgresClient(),
        now: new Date(),
      }),
    ["market-finder-read", marketSlug, productSlug],
    {
      revalidate: 60,
      tags: marketFinderReadCacheTags({ marketSlug, productSlug }),
    },
  );
  return cached();
}

async function readCachedMarketFinderDirectory(
  marketSlug: string,
): Promise<MarketFinderDirectoryModel> {
  const cached = unstable_cache(
    async () =>
      queryMarketFinderDirectory({
        marketSlug,
        client: getPostgresClient(),
        now: new Date(),
      }),
    ["market-finder-directory", marketSlug],
    {
      revalidate: 60,
      tags: marketFinderDirectoryCacheTags(marketSlug),
    },
  );
  return cached();
}

/**
 * Database-backed product discovery for the single activated pilot market.
 * Products enter this directory only through an approved observation attached
 * to their current published identity; fixture and catalogue-only products are
 * never fallbacks.
 */
export async function readMarketFinderDirectory(
  marketSlug: string,
  options: MarketFinderRepositoryOptions = {},
): Promise<MarketFinderDirectoryModel> {
  const now = normalizeNow(options.now);
  if (!isMarketFinderSlug(marketSlug)) {
    return marketFinderDirectoryNonCurrent({
      state: "empty",
      reason: "invalid-context",
      evaluatedAt: now,
    });
  }

  const environment = options.environment ?? process.env;
  if (!isMarketFinderPublicReadEnabled(environment)) {
    return marketFinderDirectoryNonCurrent({
      state: "empty",
      reason: "public-read-disabled",
      evaluatedAt: now,
    });
  }
  if (!isMarketFinderPublicMarketAllowed(marketSlug, environment)) {
    return marketFinderDirectoryNonCurrent({
      state: "empty",
      reason: "no-published-context",
      evaluatedAt: now,
    });
  }

  if (!options.client && !hasPostgresConfig()) {
    return marketFinderDirectoryNonCurrent({
      state: "unavailable",
      reason: "repository-unavailable",
      evaluatedAt: now,
    });
  }

  try {
    if (options.client) {
      return await queryMarketFinderDirectory({
        marketSlug,
        client: options.client,
        now,
      });
    }
    if (!options.environment && process.env.NEXT_RUNTIME) {
      return await readCachedMarketFinderDirectory(marketSlug);
    }
    return await queryMarketFinderDirectory({
      marketSlug,
      client: getPostgresClient(),
      now,
    });
  } catch (error) {
    console.error(
      "market_finder_directory_unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return marketFinderDirectoryNonCurrent({
      state: "unavailable",
      reason: "repository-unavailable",
      evaluatedAt: now,
    });
  }
}

/**
 * Public Market Finder read. There is intentionally no fixture, static-file,
 * offer, or community-report fallback: any missing production authority is a
 * non-current state with no location details.
 */
export async function readMarketFinder(
  input: {
    marketSlug: string;
    productSlug: string;
  },
  options: MarketFinderRepositoryOptions = {},
): Promise<MarketFinderReadModel> {
  const now = normalizeNow(options.now);
  if (
    !isMarketFinderSlug(input.marketSlug) ||
    !isMarketFinderSlug(input.productSlug)
  ) {
    return marketFinderNonCurrent({
      state: "empty",
      reason: "invalid-context",
      evaluatedAt: now,
    });
  }

  const environment = options.environment ?? process.env;
  if (!isMarketFinderPublicReadEnabled(environment)) {
    return marketFinderNonCurrent({
      state: "empty",
      reason: "public-read-disabled",
      evaluatedAt: now,
    });
  }
  if (!isMarketFinderPublicMarketAllowed(input.marketSlug, environment)) {
    return marketFinderNonCurrent({
      state: "empty",
      reason: "no-published-context",
      evaluatedAt: now,
    });
  }

  if (!options.client && !hasPostgresConfig()) {
    return marketFinderNonCurrent({
      state: "unavailable",
      reason: "repository-unavailable",
      evaluatedAt: now,
    });
  }

  try {
    const model = options.client
      ? await queryMarketFinderReadModel({
          ...input,
          client: options.client,
          now,
        })
      : !options.environment && process.env.NEXT_RUNTIME
        ? await readCachedMarketFinder(input.marketSlug, input.productSlug)
        : await queryMarketFinderReadModel({
            ...input,
            client: getPostgresClient(),
            now,
          });
    return enforceMarketFinderFreshness(model, now);
  } catch (error) {
    console.error(
      "market_finder_read_unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return marketFinderNonCurrent({
      state: "unavailable",
      reason: "repository-unavailable",
      evaluatedAt: now,
    });
  }
}

/**
 * Re-resolves URL hints before a Market report draft or immutable projection is
 * created. The external `shopSlug` parameter maps to `locationSlug` here.
 */
export async function resolveMarketReportTargetContext(
  input: {
    marketSlug: string;
    locationSlug: string;
    productSlug: string;
  },
  options: MarketFinderRepositoryOptions = {},
): Promise<MarketReportTargetResolution> {
  if (
    !isMarketFinderSlug(input.marketSlug) ||
    !isMarketFinderSlug(input.locationSlug) ||
    !isMarketFinderSlug(input.productSlug)
  ) {
    return { status: "unresolved", reason: "invalid-context" };
  }
  const environment = options.environment ?? process.env;
  if (
    !isMarketFinderPublicReadEnabled(environment) ||
    !isMarketFinderPublicMarketAllowed(input.marketSlug, environment)
  ) {
    return { status: "unresolved", reason: "unknown-context" };
  }
  if (!options.client && !hasPostgresConfig()) {
    return { status: "unresolved", reason: "repository-unavailable" };
  }

  const now = normalizeNow(options.now);
  try {
    const sql = options.client ?? getPostgresClient();
    const rows = await sql<MarketReportTargetRow[]>`
      select
        market.id as market_id,
        market.slug as market_slug,
        market.public_name as market_name,
        location.id as retailer_location_id,
        location.slug as location_slug,
        location.public_name as location_name,
        identity_version.identity_version_id as product_identity_version_id,
        product.id as product_id,
        product.slug as product_slug,
        identity_version.brand_at_review as product_brand,
        identity_version.variant_at_review as product_variant,
        identity_version.size_at_review as product_size,
        location.location_state,
        location.verification_expires_at as location_expires_at,
        place.place_state,
        identity_evidence.expires_at as identity_evidence_expires_at,
        observation.moderation_status as observation_moderation_status,
        observation.availability as observation_availability,
        observation.expires_at as observation_expires_at,
        action.action_kind,
        action.action_destination,
        action.action_expires_at
      from physical_markets market
      join retailer_locations location
        on location.market_id = market.id
        and location.slug = ${input.locationSlug}
        and location.location_state = 'verified'
        and location.verification_expires_at > ${now}
      left join physical_market_places place
        on place.id = location.primary_place_id
        and place.market_id = market.id
      join products product
        on product.slug = ${input.productSlug}
        and product.is_published = true
      join catalogue_product_identity_versions identity_version
        on identity_version.product_id = product.id
        and identity_version.lifecycle_state = 'active'
      join lateral (
        select max(identity_candidate.expires_at) as expires_at
        from retailer_location_evidence identity_candidate
        where identity_candidate.retailer_location_id = location.id
          and identity_candidate.evidence_scope = 'location_identity'
          and identity_candidate.channel_id is null
          and identity_candidate.decision = 'approved'
          and identity_candidate.source_method in (
            'field_visit',
            'retailer_confirmation',
            'branch_online_record',
            'partnership_application'
          )
      ) identity_evidence on identity_evidence.expires_at > ${now}
      join lateral (
        select approved_observation.*
        from physical_product_observations approved_observation
        where approved_observation.retailer_location_id = location.id
          and approved_observation.product_identity_version_id = identity_version.identity_version_id
          and approved_observation.moderation_status = 'approved'
          and not exists (
            select 1
            from physical_product_observations approved_successor
            where approved_successor.supersedes_observation_id = approved_observation.id
              and approved_successor.moderation_status = 'approved'
          )
        order by
          approved_observation.observed_at desc,
          approved_observation.created_at desc,
          approved_observation.id desc
        limit 1
      ) observation on true
      join lateral (
        select candidate.*
        from (
          select
            'directions'::text as action_kind,
            location.public_directions as action_destination,
            least(
              location.verification_expires_at,
              directions_evidence.expires_at
            ) as action_expires_at,
            0 as preference
          from retailer_location_evidence directions_evidence
          where location.public_directions is not null
            and directions_evidence.retailer_location_id = location.id
            and directions_evidence.evidence_scope = 'public_directions'
            and directions_evidence.channel_id is null
            and directions_evidence.decision = 'approved'
          union all
          select
            case channel.channel_kind
              when 'physical_visit' then 'visit'
              else channel.channel_kind::text
            end as action_kind,
            channel.public_destination as action_destination,
            least(
              location.verification_expires_at,
              channel.expires_at,
              channel_evidence.expires_at
            ) as action_expires_at,
            case channel.channel_kind
              when 'whatsapp' then 1
              when 'phone' then 2
              when 'physical_visit' then 3
              when 'website' then 4
              else 5
            end as preference
          from retailer_location_channels channel
          join retailer_location_evidence channel_evidence
            on channel_evidence.channel_id = channel.id
            and channel_evidence.retailer_location_id = location.id
            and channel_evidence.evidence_scope = 'channel_ownership'
            and channel_evidence.decision = 'approved'
          where channel.retailer_location_id = location.id
            and channel.channel_state = 'verified'
        ) candidate
        where candidate.action_destination is not null
          and public.market_finder_public_action_is_usable(
            candidate.action_kind,
            candidate.action_destination
          )
          and candidate.action_expires_at > ${now}
      ) action on true
      where market.slug = ${input.marketSlug}
        and market.publication_state = 'published'
        and (
          location.primary_place_id is null
          or place.place_state = 'verified'
        )
        and observation.expires_at > ${now}
        and observation.availability in ('in_stock', 'low_stock')
      order by action.preference, action.action_expires_at desc
    `;

    const nowMs = now.getTime();
    const isCurrent = (value: DateValue) => {
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) && timestamp > nowMs;
    };
    const row = rows.find(
      (candidate) =>
        candidate.location_state === "verified" &&
        isCurrent(candidate.location_expires_at) &&
        (candidate.place_state === null ||
          candidate.place_state === "verified") &&
        isCurrent(candidate.identity_evidence_expires_at) &&
        candidate.observation_moderation_status === "approved" &&
        isCurrent(candidate.observation_expires_at) &&
        (candidate.observation_availability === "in_stock" ||
          candidate.observation_availability === "low_stock") &&
        isCurrent(candidate.action_expires_at) &&
        Boolean(
          normalizeMarketFinderPublicAction({
            kind: candidate.action_kind,
            destination: candidate.action_destination,
          }),
        ),
    );
    if (!row) return { status: "unresolved", reason: "unknown-context" };
    return {
      status: "resolved",
      context: {
        marketId: row.market_id,
        marketSlug: row.market_slug,
        marketName: row.market_name,
        retailerLocationId: row.retailer_location_id,
        locationSlug: row.location_slug,
        locationName: row.location_name,
        productIdentityVersionId: row.product_identity_version_id,
        productId: row.product_id,
        productSlug: row.product_slug,
        productBrand: row.product_brand,
        productVariant: row.product_variant,
        productSize: row.product_size,
      },
    };
  } catch (error) {
    console.error(
      "market_report_context_unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return { status: "unresolved", reason: "repository-unavailable" };
  }
}
