begin;

-- ADR 0019: governed physical-market evidence. This rehearsal draft is
-- deliberately schema-only: canonical markets, places, shops, channels, and
-- observations require separate attributable Operations decisions.
alter type community_contribution_kind add value 'market_report';

create type market_publication_state as enum (
  'draft',
  'published',
  'suspended',
  'retired'
);

create type physical_market_place_kind as enum (
  'entrance',
  'zone',
  'plaza',
  'section',
  'floor',
  'landmark'
);

create type physical_market_place_state as enum (
  'lead',
  'verified',
  'disputed',
  'retired'
);

create type market_coordinate_precision as enum (
  'exact',
  'building',
  'entrance',
  'approximate'
);

create type retailer_location_state as enum (
  'lead',
  'verified',
  'disputed',
  'retired'
);

create type retailer_location_channel_kind as enum (
  'physical_visit',
  'phone',
  'whatsapp',
  'website',
  'social_business_profile'
);

create type retailer_location_channel_state as enum (
  'pending',
  'verified',
  'disputed',
  'retired'
);

create type physical_evidence_source_method as enum (
  'field_visit',
  'retailer_confirmation',
  'branch_online_record',
  'partnership_application',
  'community_report',
  'online_listing',
  'map_result',
  'social_profile',
  'search_result',
  'old_receipt'
);

create type retailer_location_evidence_scope as enum (
  'location_identity',
  'channel_ownership',
  'public_directions'
);

create type physical_evidence_decision as enum (
  'pending',
  'approved',
  'rejected',
  'superseded'
);

create type physical_product_availability as enum (
  'in_stock',
  'low_stock',
  'out_of_stock',
  'unknown',
  'not_carried'
);

create type physical_observation_moderation_status as enum (
  'pending',
  'approved',
  'rejected',
  'superseded'
);

create type market_report_outcome as enum (
  'found_bought',
  'shop_exists_no_stock',
  'location_wrong',
  'shop_closed'
);

create table physical_markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  public_name text not null
    check (char_length(trim(public_name)) between 1 and 160),
  city text not null
    check (char_length(trim(city)) between 1 and 120),
  state_region text not null
    check (char_length(trim(state_region)) between 1 and 120),
  country_code char(2) not null
    check (country_code ~ '^[A-Z]{2}$'),
  publication_state market_publication_state not null default 'draft',
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint physical_markets_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint physical_markets_publication_review_check check (
    publication_state = 'draft'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table physical_market_places (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references physical_markets(id) on delete restrict,
  parent_place_id uuid references physical_market_places(id) on delete restrict,
  slug text not null
    check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  place_kind physical_market_place_kind not null,
  public_name text not null
    check (char_length(trim(public_name)) between 1 and 160),
  reviewed_aliases text[] not null default '{}',
  place_state physical_market_place_state not null default 'lead',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  coordinate_precision market_coordinate_precision,
  coordinate_source_method physical_evidence_source_method,
  coordinate_source_reference text
    check (
      coordinate_source_reference is null
      or char_length(trim(coordinate_source_reference)) between 1 and 500
    ),
  coordinate_verified_at timestamptz,
  coordinate_expires_at timestamptz,
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_id, slug),
  constraint physical_market_places_not_self_parent_check check (
    parent_place_id is null or parent_place_id <> id
  ),
  constraint physical_market_places_aliases_check check (
    array_position(reviewed_aliases, null) is null
  ),
  constraint physical_market_places_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint physical_market_places_state_review_check check (
    place_state = 'lead'
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint physical_market_places_coordinate_check check (
    (
      latitude is null
      and longitude is null
      and coordinate_precision is null
      and coordinate_source_method is null
      and coordinate_source_reference is null
      and coordinate_verified_at is null
      and coordinate_expires_at is null
    )
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
      and coordinate_precision is not null
      and coordinate_source_method is not null
      and coordinate_source_reference is not null
      and coordinate_verified_at is not null
      and coordinate_expires_at > coordinate_verified_at
    )
  )
);

create table retailer_locations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references retailers(id) on delete restrict,
  market_id uuid references physical_markets(id) on delete restrict,
  primary_place_id uuid references physical_market_places(id) on delete restrict,
  slug text not null
    check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  public_name text not null
    check (char_length(trim(public_name)) between 1 and 160),
  shop_number text
    check (shop_number is null or char_length(trim(shop_number)) between 1 and 80),
  floor text
    check (floor is null or char_length(trim(floor)) between 1 and 80),
  public_directions text
    check (
      public_directions is null
      or char_length(trim(public_directions)) between 1 and 500
    ),
  location_state retailer_location_state not null default 'lead',
  verified_at timestamptz,
  verification_expires_at timestamptz,
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_locations_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint retailer_locations_state_review_check check (
    location_state = 'lead'
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint retailer_locations_verification_window_check check (
    (
      verified_at is null
      and verification_expires_at is null
    )
    or (
      verified_at is not null
      and verification_expires_at is not null
      and verification_expires_at > verified_at
    )
  ),
  constraint retailer_locations_verified_shape_check check (
    location_state <> 'verified'
    or (
      market_id is not null
      and verified_at is not null
      and verification_expires_at is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  )
);

create table retailer_location_channels (
  id uuid primary key default gen_random_uuid(),
  retailer_location_id uuid not null
    references retailer_locations(id) on delete restrict,
  channel_kind retailer_location_channel_kind not null,
  public_destination text not null
    check (char_length(trim(public_destination)) between 1 and 500),
  channel_state retailer_location_channel_state not null default 'pending',
  source_method physical_evidence_source_method not null,
  source_reference text not null
    check (char_length(trim(source_reference)) between 1 and 500),
  verified_at timestamptz,
  expires_at timestamptz,
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_location_id, channel_kind, public_destination),
  constraint retailer_location_channels_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint retailer_location_channels_state_review_check check (
    channel_state = 'pending'
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint retailer_location_channels_verification_window_check check (
    (verified_at is null and expires_at is null)
    or (
      verified_at is not null
      and expires_at is not null
      and expires_at > verified_at
    )
  ),
  constraint retailer_location_channels_verified_shape_check check (
    channel_state <> 'verified'
    or (
      verified_at is not null
      and expires_at is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  )
);

create table retailer_location_evidence (
  id uuid primary key default gen_random_uuid(),
  retailer_location_id uuid not null
    references retailer_locations(id) on delete restrict,
  channel_id uuid references retailer_location_channels(id) on delete restrict,
  evidence_scope retailer_location_evidence_scope not null,
  source_method physical_evidence_source_method not null,
  source_reference text not null
    check (char_length(trim(source_reference)) between 1 and 500),
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  decision physical_evidence_decision not null default 'pending',
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  supersedes_evidence_id uuid
    references retailer_location_evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint retailer_location_evidence_channel_scope_check check (
    (evidence_scope = 'channel_ownership' and channel_id is not null)
    or (evidence_scope <> 'channel_ownership' and channel_id is null)
  ),
  constraint retailer_location_evidence_not_self_superseding_check check (
    supersedes_evidence_id is null or supersedes_evidence_id <> id
  ),
  constraint retailer_location_evidence_expiry_check check (
    expires_at > observed_at
  ),
  constraint retailer_location_evidence_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint retailer_location_evidence_decision_review_check check (
    decision = 'pending'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table physical_product_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_location_id uuid not null
    references retailer_locations(id) on delete restrict,
  product_identity_version_id uuid not null
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  availability physical_product_availability not null,
  price_ngn numeric(12, 2)
    check (price_ngn is null or price_ngn > 0),
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  source_method physical_evidence_source_method not null,
  source_reference text not null
    check (char_length(trim(source_reference)) between 1 and 500),
  observed_title text not null
    check (char_length(trim(observed_title)) between 1 and 240),
  observed_size text not null
    check (char_length(trim(observed_size)) between 1 and 80),
  moderation_status physical_observation_moderation_status not null default 'pending',
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  supersedes_observation_id uuid
    references physical_product_observations(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (
    retailer_location_id,
    product_identity_version_id,
    source_method,
    source_reference
  ),
  constraint physical_product_observations_not_self_superseding_check check (
    supersedes_observation_id is null or supersedes_observation_id <> id
  ),
  constraint physical_product_observations_expiry_check check (
    expires_at > observed_at
  ),
  constraint physical_product_observations_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint physical_product_observations_status_review_check check (
    moderation_status = 'pending'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table market_finder_reports (
  contribution_id uuid primary key
    references community_contributions(id) on delete cascade,
  market_id uuid not null references physical_markets(id) on delete restrict,
  retailer_location_id uuid not null
    references retailer_locations(id) on delete restrict,
  product_identity_version_id uuid not null
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  outcome market_report_outcome not null,
  moderation_status community_moderation_status not null default 'pending',
  reviewed_by text
    check (reviewed_by is null or char_length(reviewed_by) between 1 and 320),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint market_finder_reports_review_pair_check check (
    (reviewed_by is null) = (reviewed_at is null)
  ),
  constraint market_finder_reports_decision_review_check check (
    moderation_status in ('pending', 'rejected')
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index physical_markets_publication_idx
  on physical_markets (publication_state, slug);

create index physical_market_places_market_state_idx
  on physical_market_places (market_id, place_state, parent_place_id, public_name);

create unique index retailer_locations_market_slug_idx
  on retailer_locations (market_id, slug)
  where market_id is not null;

create index retailer_locations_market_state_idx
  on retailer_locations (
    market_id,
    location_state,
    verification_expires_at,
    public_name
  );

create index retailer_location_channels_current_idx
  on retailer_location_channels (
    retailer_location_id,
    channel_state,
    expires_at,
    channel_kind
  );

create unique index retailer_location_evidence_source_idx
  on retailer_location_evidence (
    retailer_location_id,
    evidence_scope,
    coalesce(channel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_method,
    source_reference
  );

create index retailer_location_evidence_current_idx
  on retailer_location_evidence (
    retailer_location_id,
    evidence_scope,
    decision,
    expires_at desc,
    observed_at desc
  );

create index physical_product_observations_current_identity_idx
  on physical_product_observations (
    product_identity_version_id,
    retailer_location_id,
    observed_at desc,
    created_at desc
  )
  where moderation_status = 'approved';

create index physical_product_observations_freshness_idx
  on physical_product_observations (
    product_identity_version_id,
    moderation_status,
    expires_at,
    observed_at desc
  );

create index market_finder_reports_queue_idx
  on market_finder_reports (moderation_status, created_at, contribution_id);

create index market_finder_reports_location_idx
  on market_finder_reports (retailer_location_id, created_at desc);

create function market_finder_validate_market_review_time()
returns trigger
language plpgsql
as $$
begin
  if new.publication_state = 'published'
    and new.reviewed_at > statement_timestamp()
  then
    raise exception 'A published physical market cannot be future-dated.';
  end if;
  return new;
end;
$$;

create trigger physical_markets_review_time_trigger
before insert or update of publication_state, reviewed_at on physical_markets
for each row execute function market_finder_validate_market_review_time();

create function market_finder_validate_place_review_time()
returns trigger
language plpgsql
as $$
begin
  if new.place_state = 'verified'
    and new.reviewed_at > statement_timestamp()
  then
    raise exception 'A verified physical market place cannot be future-dated.';
  end if;
  return new;
end;
$$;

create trigger physical_market_places_review_time_trigger
before insert or update of place_state, reviewed_at on physical_market_places
for each row execute function market_finder_validate_place_review_time();

create function market_finder_enforce_market_history()
returns trigger
language plpgsql
as $$
begin
  if row(old.id, old.slug, old.created_at) is distinct from row(new.id, new.slug, new.created_at) then
    raise exception 'Physical market identity fields are immutable.';
  end if;

  if old.publication_state = 'published'
    and new.publication_state = 'published'
    and row(
      old.public_name,
      old.city,
      old.state_region,
      old.country_code
    ) is distinct from row(
      new.public_name,
      new.city,
      new.state_region,
      new.country_code
    )
  then
    raise exception 'Suspend a published physical market before correcting its facts.';
  end if;

  if old.publication_state = new.publication_state then
    return new;
  end if;

  if not (
    (
      old.publication_state = 'draft'
      and new.publication_state in ('published', 'retired')
    )
    or (
      old.publication_state = 'published'
      and new.publication_state in ('suspended', 'retired')
    )
    or (
      old.publication_state = 'suspended'
      and new.publication_state in ('published', 'retired')
    )
  ) then
    raise exception 'Invalid physical market publication transition.';
  end if;

  return new;
end;
$$;

create trigger physical_markets_history_trigger
before update on physical_markets
for each row execute function market_finder_enforce_market_history();

create function market_finder_enforce_place_history()
returns trigger
language plpgsql
as $$
begin
  if row(old.id, old.market_id, old.slug, old.created_at) is distinct from row(
    new.id,
    new.market_id,
    new.slug,
    new.created_at
  ) then
    raise exception 'Physical market place identity fields are immutable.';
  end if;

  if old.place_state is distinct from new.place_state and not (
    (
      old.place_state = 'lead'
      and new.place_state in ('verified', 'disputed', 'retired')
    )
    or (
      old.place_state = 'verified'
      and new.place_state in ('disputed', 'retired')
    )
    or (
      old.place_state = 'disputed'
      and new.place_state in ('verified', 'retired')
    )
  ) then
    raise exception 'Invalid physical market place state transition.';
  end if;

  if (old.place_state = 'verified' or new.place_state = 'verified')
    and row(
      old.parent_place_id,
      old.place_kind,
      old.public_name,
      old.reviewed_aliases,
      old.latitude,
      old.longitude,
      old.coordinate_precision,
      old.coordinate_source_method,
      old.coordinate_source_reference,
      old.coordinate_verified_at,
      old.coordinate_expires_at
    ) is distinct from row(
      new.parent_place_id,
      new.place_kind,
      new.public_name,
      new.reviewed_aliases,
      new.latitude,
      new.longitude,
      new.coordinate_precision,
      new.coordinate_source_method,
      new.coordinate_source_reference,
      new.coordinate_verified_at,
      new.coordinate_expires_at
    )
  then
    raise exception 'Move a verified market place to disputed before correcting its facts.';
  end if;

  return new;
end;
$$;

create trigger physical_market_places_history_trigger
before update on physical_market_places
for each row execute function market_finder_enforce_place_history();

create function market_finder_enforce_location_history()
returns trigger
language plpgsql
as $$
begin
  if row(old.id, old.retailer_id, old.slug, old.created_at) is distinct from row(
    new.id,
    new.retailer_id,
    new.slug,
    new.created_at
  ) then
    raise exception 'Retailer location identity fields are immutable.';
  end if;

  if old.location_state is distinct from new.location_state and not (
    (
      old.location_state = 'lead'
      and new.location_state in ('verified', 'disputed', 'retired')
    )
    or (
      old.location_state = 'verified'
      and new.location_state in ('disputed', 'retired')
    )
    or (
      old.location_state = 'disputed'
      and new.location_state in ('verified', 'retired')
    )
  ) then
    raise exception 'Invalid retailer location state transition.';
  end if;

  if old.market_id is distinct from new.market_id and (
    exists (
      select 1
      from market_finder_reports report
      where report.retailer_location_id = old.id
    )
    or exists (
      select 1
      from physical_product_observations observation
      where observation.retailer_location_id = old.id
    )
  ) then
    raise exception 'A reported or observed retailer location cannot move between markets.';
  end if;

  if (old.location_state = 'verified' or new.location_state = 'verified')
    and row(
      old.market_id,
      old.primary_place_id,
      old.public_name,
      old.shop_number,
      old.floor,
      old.public_directions
    ) is distinct from row(
      new.market_id,
      new.primary_place_id,
      new.public_name,
      new.shop_number,
      new.floor,
      new.public_directions
    )
  then
    raise exception 'Move a verified retailer location to disputed before correcting its facts.';
  end if;

  return new;
end;
$$;

create trigger retailer_locations_history_trigger
before update on retailer_locations
for each row execute function market_finder_enforce_location_history();

create function market_finder_validate_place_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_market_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.market_id <> new.market_id then
      raise exception 'A physical market place cannot move between markets.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.market_id::text, 0));

  if new.parent_place_id is null then
    return new;
  end if;

  select market_id
  into parent_market_id
  from physical_market_places
  where id = new.parent_place_id;

  if parent_market_id is null or parent_market_id <> new.market_id then
    raise exception 'Physical market place parents must belong to the same market.';
  end if;

  if exists (
    with recursive ancestors(id, parent_place_id) as (
      select place.id, place.parent_place_id
      from physical_market_places place
      where place.id = new.parent_place_id
      union
      select place.id, place.parent_place_id
      from physical_market_places place
      join ancestors ancestor on place.id = ancestor.parent_place_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Physical market place hierarchy cycles are prohibited.';
  end if;

  return new;
end;
$$;

create trigger physical_market_places_hierarchy_trigger
before insert or update of market_id, parent_place_id
on physical_market_places
for each row execute function market_finder_validate_place_hierarchy();

create function market_finder_validate_location_place()
returns trigger
language plpgsql
as $$
declare
  place_market_id uuid;
begin
  if new.primary_place_id is null then
    return new;
  end if;

  if new.market_id is null then
    raise exception 'A market place cannot be attached to a location without a market.';
  end if;

  select market_id
  into place_market_id
  from physical_market_places
  where id = new.primary_place_id;

  if place_market_id is null or place_market_id <> new.market_id then
    raise exception 'Retailer location and primary place must belong to the same market.';
  end if;

  return new;
end;
$$;

create trigger retailer_locations_place_trigger
before insert or update of market_id, primary_place_id
on retailer_locations
for each row execute function market_finder_validate_location_place();

create function market_finder_evidence_max_lifetime(
  source_method physical_evidence_source_method
)
returns interval
language sql
immutable
strict
as $$
  select case source_method
    when 'field_visit' then interval '180 days'
    when 'retailer_confirmation' then interval '90 days'
    when 'branch_online_record' then interval '30 days'
    when 'partnership_application' then interval '90 days'
    when 'community_report' then interval '30 days'
    when 'online_listing' then interval '30 days'
    when 'map_result' then interval '30 days'
    when 'social_profile' then interval '30 days'
    when 'search_result' then interval '7 days'
    when 'old_receipt' then interval '7 days'
  end;
$$;

create function market_finder_validate_location_evidence()
returns trigger
language plpgsql
as $$
declare
  channel_location_id uuid;
  previous_evidence retailer_location_evidence%rowtype;
begin
  if tg_op = 'INSERT'
    and (
      new.decision <> 'pending'
      or new.reviewed_by is not null
      or new.reviewed_at is not null
    )
  then
    raise exception 'New retailer location evidence must enter pending review.';
  end if;

  if new.expires_at > new.observed_at + market_finder_evidence_max_lifetime(new.source_method) then
    raise exception 'Location evidence expiry exceeds its source-specific maximum.';
  end if;

  if new.decision = 'approved'
    and (
      new.observed_at > statement_timestamp()
      or new.expires_at <= statement_timestamp()
      or new.reviewed_at > statement_timestamp()
    )
  then
    raise exception 'Approved location evidence must be current and not future-dated.';
  end if;

  if new.channel_id is not null then
    select retailer_location_id
    into channel_location_id
    from retailer_location_channels
    where id = new.channel_id;

    if channel_location_id is null or channel_location_id <> new.retailer_location_id then
      raise exception 'Channel evidence must reference a channel on the same retailer location.';
    end if;
  end if;

  if new.supersedes_evidence_id is not null then
    select *
    into previous_evidence
    from retailer_location_evidence
    where id = new.supersedes_evidence_id;

    if not found
      or previous_evidence.retailer_location_id <> new.retailer_location_id
      or previous_evidence.evidence_scope <> new.evidence_scope
      or previous_evidence.channel_id is distinct from new.channel_id
      or new.observed_at <= previous_evidence.observed_at
    then
      raise exception 'Superseding location evidence must be newer and share the same subject.';
    end if;

    if new.decision = 'approved' and previous_evidence.decision <> 'approved' then
      raise exception 'Approved location evidence can supersede only approved evidence.';
    end if;
  end if;

  return new;
end;
$$;

create trigger retailer_location_evidence_validation_trigger
before insert or update on retailer_location_evidence
for each row execute function market_finder_validate_location_evidence();

create function market_finder_enforce_evidence_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Retailer location evidence is append-only.';
  end if;

  if row(
    old.id,
    old.retailer_location_id,
    old.channel_id,
    old.evidence_scope,
    old.source_method,
    old.source_reference,
    old.observed_at,
    old.expires_at,
    old.supersedes_evidence_id,
    old.created_at
  ) is distinct from row(
    new.id,
    new.retailer_location_id,
    new.channel_id,
    new.evidence_scope,
    new.source_method,
    new.source_reference,
    new.observed_at,
    new.expires_at,
    new.supersedes_evidence_id,
    new.created_at
  ) then
    raise exception 'Retailer location evidence facts are immutable.';
  end if;

  if old.decision = new.decision then
    if row(old.reviewed_by, old.reviewed_at) is distinct from row(new.reviewed_by, new.reviewed_at) then
      raise exception 'A settled evidence decision cannot be rewritten.';
    end if;
    return new;
  end if;

  if not (
    (old.decision = 'pending' and new.decision in ('approved', 'rejected'))
    or (
      old.decision = 'approved'
      and new.decision = 'superseded'
      and exists (
        select 1
        from retailer_location_evidence successor
        where successor.supersedes_evidence_id = old.id
          and successor.decision = 'approved'
      )
    )
  ) then
    raise exception 'Invalid retailer location evidence decision transition.';
  end if;

  return new;
end;
$$;

create trigger retailer_location_evidence_immutable_update_trigger
before update on retailer_location_evidence
for each row execute function market_finder_enforce_evidence_history();

create trigger retailer_location_evidence_immutable_delete_trigger
before delete on retailer_location_evidence
for each row execute function market_finder_enforce_evidence_history();

create function market_finder_apply_evidence_supersession()
returns trigger
language plpgsql
as $$
begin
  if new.decision = 'approved' and new.supersedes_evidence_id is not null then
    if tg_op = 'UPDATE' and old.decision is not distinct from new.decision then
      return new;
    end if;

    update retailer_location_evidence
    set decision = 'superseded',
        reviewed_by = new.reviewed_by,
        reviewed_at = new.reviewed_at
    where id = new.supersedes_evidence_id
      and decision = 'approved';

    if not found then
      raise exception 'The superseded location evidence is not currently approved.';
    end if;
  end if;

  return new;
end;
$$;

create trigger retailer_location_evidence_supersession_trigger
after insert or update of decision on retailer_location_evidence
for each row execute function market_finder_apply_evidence_supersession();

create function market_finder_validate_verified_location()
returns trigger
language plpgsql
as $$
begin
  if new.location_state <> 'verified' then
    return new;
  end if;

  if new.verification_expires_at <= statement_timestamp() then
    raise exception 'A verified retailer location requires current evidence.';
  end if;

  if new.verified_at > statement_timestamp()
    or new.reviewed_at > statement_timestamp()
  then
    raise exception 'A verified retailer location cannot be future-dated.';
  end if;

  if new.primary_place_id is not null and not exists (
    select 1
    from physical_market_places place
    where place.id = new.primary_place_id
      and place.market_id = new.market_id
      and place.place_state = 'verified'
  ) then
    raise exception 'A verified location can reference only a verified primary place.';
  end if;

  if not exists (
    select 1
    from retailer_location_evidence evidence
    where evidence.retailer_location_id = new.id
      and evidence.evidence_scope = 'location_identity'
      and evidence.channel_id is null
      and evidence.decision = 'approved'
      and evidence.source_method in (
        'field_visit',
        'retailer_confirmation',
        'branch_online_record',
        'partnership_application'
      )
      and evidence.expires_at >= new.verification_expires_at
  ) then
    raise exception 'A verified location requires approved attributable identity evidence.';
  end if;

  return new;
end;
$$;

create trigger retailer_locations_verification_trigger
before insert or update of market_id, location_state, verified_at, verification_expires_at, primary_place_id
on retailer_locations
for each row execute function market_finder_validate_verified_location();

create function market_finder_enforce_channel_history()
returns trigger
language plpgsql
as $$
begin
  if row(
    old.id,
    old.retailer_location_id,
    old.channel_kind,
    old.public_destination,
    old.source_method,
    old.source_reference,
    old.created_at
  ) is distinct from row(
    new.id,
    new.retailer_location_id,
    new.channel_kind,
    new.public_destination,
    new.source_method,
    new.source_reference,
    new.created_at
  ) then
    raise exception 'Retailer location channel facts are immutable; append a replacement channel.';
  end if;

  if old.channel_state = new.channel_state then
    if row(
      old.verified_at,
      old.expires_at,
      old.reviewed_by,
      old.reviewed_at
    ) is distinct from row(
      new.verified_at,
      new.expires_at,
      new.reviewed_by,
      new.reviewed_at
    ) then
      raise exception 'A retailer channel decision cannot be rewritten in place.';
    end if;
    return new;
  end if;

  if not (
    (
      old.channel_state = 'pending'
      and new.channel_state in ('verified', 'disputed', 'retired')
    )
    or (
      old.channel_state = 'verified'
      and new.channel_state in ('disputed', 'retired')
    )
    or (
      old.channel_state = 'disputed'
      and new.channel_state in ('verified', 'retired')
    )
  ) then
    raise exception 'Invalid retailer location channel state transition.';
  end if;

  return new;
end;
$$;

create trigger retailer_location_channels_history_trigger
before update on retailer_location_channels
for each row execute function market_finder_enforce_channel_history();

create function market_finder_validate_verified_channel()
returns trigger
language plpgsql
as $$
begin
  if new.channel_state <> 'verified' then
    return new;
  end if;

  if new.expires_at <= statement_timestamp() then
    raise exception 'A verified retailer channel requires current evidence.';
  end if;

  if new.verified_at > statement_timestamp()
    or new.reviewed_at > statement_timestamp()
  then
    raise exception 'A verified retailer channel cannot be future-dated.';
  end if;

  if not exists (
    select 1
    from retailer_locations location
    where location.id = new.retailer_location_id
      and location.location_state = 'verified'
      and location.verification_expires_at > statement_timestamp()
  ) then
    raise exception 'A verified channel requires a current verified retailer location.';
  end if;

  if not exists (
    select 1
    from retailer_location_evidence evidence
    where evidence.retailer_location_id = new.retailer_location_id
      and evidence.channel_id = new.id
      and evidence.evidence_scope = 'channel_ownership'
      and evidence.decision = 'approved'
      and evidence.expires_at >= new.expires_at
  ) then
    raise exception 'A verified channel requires approved attributable ownership evidence.';
  end if;

  return new;
end;
$$;

create trigger retailer_location_channels_verification_trigger
before insert or update of retailer_location_id, channel_state, verified_at, expires_at
on retailer_location_channels
for each row execute function market_finder_validate_verified_channel();

create function market_finder_observation_max_lifetime(
  source_method physical_evidence_source_method
)
returns interval
language sql
immutable
strict
as $$
  select case source_method
    when 'field_visit' then interval '14 days'
    when 'retailer_confirmation' then interval '7 days'
    when 'branch_online_record' then interval '3 days'
    when 'community_report' then interval '3 days'
    else interval '30 days'
  end;
$$;

create function market_finder_validate_physical_observation()
returns trigger
language plpgsql
as $$
declare
  previous_observation physical_product_observations%rowtype;
begin
  if tg_op = 'INSERT'
    and (
      new.moderation_status <> 'pending'
      or new.reviewed_by is not null
      or new.reviewed_at is not null
    )
  then
    raise exception 'New physical product observations must enter pending review.';
  end if;

  if new.expires_at > new.observed_at + market_finder_observation_max_lifetime(new.source_method) then
    raise exception 'Physical observation expiry exceeds its source-specific maximum.';
  end if;

  if new.supersedes_observation_id is not null then
    select *
    into previous_observation
    from physical_product_observations
    where id = new.supersedes_observation_id;

    if not found
      or previous_observation.retailer_location_id <> new.retailer_location_id
      or previous_observation.product_identity_version_id <> new.product_identity_version_id
      or new.observed_at <= previous_observation.observed_at
    then
      raise exception 'A superseding physical observation must be newer and share location and identity.';
    end if;

    if new.moderation_status = 'approved'
      and previous_observation.moderation_status <> 'approved'
    then
      raise exception 'An approved supersession must replace an approved observation.';
    end if;
  end if;

  if new.moderation_status = 'approved' then
    if new.source_method not in (
      'field_visit',
      'retailer_confirmation',
      'branch_online_record',
      'community_report'
    ) then
      raise exception 'Discovery-only sources cannot approve physical shelf availability.';
    end if;

    if new.observed_at > statement_timestamp()
      or new.expires_at <= statement_timestamp()
      or new.reviewed_at > statement_timestamp()
    then
      raise exception 'An approved physical observation must be current and not future-dated.';
    end if;

    if not exists (
      select 1
      from catalogue_product_identity_versions identity_version
      join products product on product.id = identity_version.product_id
      where identity_version.identity_version_id = new.product_identity_version_id
        and identity_version.lifecycle_state = 'active'
        and product.is_published = true
    ) then
      raise exception 'Approved physical observations require an active published exact identity.';
    end if;

    if not exists (
      select 1
      from retailer_locations location
      where location.id = new.retailer_location_id
        and location.location_state = 'verified'
        and location.verification_expires_at > statement_timestamp()
    ) then
      raise exception 'Approved physical observations require a current verified location.';
    end if;
  end if;

  return new;
end;
$$;

create trigger physical_product_observations_validation_trigger
before insert or update on physical_product_observations
for each row execute function market_finder_validate_physical_observation();

create function market_finder_enforce_observation_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Physical product observations are append-only.';
  end if;

  if row(
    old.id,
    old.retailer_location_id,
    old.product_identity_version_id,
    old.availability,
    old.price_ngn,
    old.observed_at,
    old.expires_at,
    old.source_method,
    old.source_reference,
    old.observed_title,
    old.observed_size,
    old.supersedes_observation_id,
    old.created_at
  ) is distinct from row(
    new.id,
    new.retailer_location_id,
    new.product_identity_version_id,
    new.availability,
    new.price_ngn,
    new.observed_at,
    new.expires_at,
    new.source_method,
    new.source_reference,
    new.observed_title,
    new.observed_size,
    new.supersedes_observation_id,
    new.created_at
  ) then
    raise exception 'Physical product observation facts are immutable.';
  end if;

  if old.moderation_status = new.moderation_status then
    if row(old.reviewed_by, old.reviewed_at) is distinct from row(new.reviewed_by, new.reviewed_at) then
      raise exception 'A settled physical observation decision cannot be rewritten.';
    end if;
    return new;
  end if;

  if not (
    (
      old.moderation_status = 'pending'
      and new.moderation_status in ('approved', 'rejected')
    )
    or (
      old.moderation_status = 'approved'
      and new.moderation_status = 'superseded'
      and exists (
        select 1
        from physical_product_observations successor
        where successor.supersedes_observation_id = old.id
          and successor.moderation_status = 'approved'
      )
    )
  ) then
    raise exception 'Invalid physical product observation moderation transition.';
  end if;

  return new;
end;
$$;

create trigger physical_product_observations_immutable_update_trigger
before update on physical_product_observations
for each row execute function market_finder_enforce_observation_history();

create trigger physical_product_observations_immutable_delete_trigger
before delete on physical_product_observations
for each row execute function market_finder_enforce_observation_history();

create function market_finder_apply_observation_supersession()
returns trigger
language plpgsql
as $$
begin
  if new.moderation_status = 'approved'
    and new.supersedes_observation_id is not null
  then
    if tg_op = 'UPDATE'
      and old.moderation_status is not distinct from new.moderation_status
    then
      return new;
    end if;

    update physical_product_observations
    set moderation_status = 'superseded',
        reviewed_by = new.reviewed_by,
        reviewed_at = new.reviewed_at
    where id = new.supersedes_observation_id
      and moderation_status = 'approved';

    if not found then
      raise exception 'The superseded observation is not currently approved.';
    end if;
  end if;

  return new;
end;
$$;

create trigger physical_product_observations_supersession_trigger
after insert or update of moderation_status on physical_product_observations
for each row execute function market_finder_apply_observation_supersession();

create function market_finder_validate_report_context()
returns trigger
language plpgsql
as $$
declare
  parent_kind text;
  parent_status community_moderation_status;
  parent_retain_until timestamptz;
begin
  if new.moderation_status <> 'pending'
    or new.reviewed_by is not null
    or new.reviewed_at is not null
  then
    raise exception 'A new Market Finder report projection must enter pending review.';
  end if;

  select contribution_kind::text, moderation_status, retain_until
  into parent_kind, parent_status, parent_retain_until
  from community_contributions
  where id = new.contribution_id;

  if parent_kind is null
    or parent_kind <> 'market_report'
    or parent_status = 'rejected'
    or parent_retain_until <= statement_timestamp()
  then
    raise exception 'Market Finder reports require a retained non-rejected market-report contribution.';
  end if;

  if not exists (
    select 1
    from physical_markets market
    join retailer_locations location on location.id = new.retailer_location_id
    where market.id = new.market_id
      and market.publication_state = 'published'
      and location.market_id = market.id
      and location.location_state = 'verified'
      and location.verification_expires_at > statement_timestamp()
      and (
        location.primary_place_id is null
        or exists (
          select 1
          from physical_market_places place
          where place.id = location.primary_place_id
            and place.market_id = market.id
            and place.place_state = 'verified'
        )
      )
      and exists (
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
          and identity_evidence.expires_at > statement_timestamp()
      )
  ) then
    raise exception 'Market Finder report context requires a published market and current verified location.';
  end if;

  if not exists (
    select 1
    from catalogue_product_identity_versions identity_version
    join products product on product.id = identity_version.product_id
    where identity_version.identity_version_id = new.product_identity_version_id
      and identity_version.lifecycle_state = 'active'
      and product.is_published = true
  ) then
    raise exception 'Market Finder report context requires an active published exact identity.';
  end if;

  return new;
end;
$$;

create trigger market_finder_reports_context_trigger
before insert on market_finder_reports
for each row execute function market_finder_validate_report_context();

create function market_finder_enforce_report_immutability()
returns trigger
language plpgsql
as $$
begin
  if row(
    old.contribution_id,
    old.market_id,
    old.retailer_location_id,
    old.product_identity_version_id,
    old.outcome,
    old.created_at
  ) is distinct from row(
    new.contribution_id,
    new.market_id,
    new.retailer_location_id,
    new.product_identity_version_id,
    new.outcome,
    new.created_at
  ) then
    raise exception 'Market Finder report context and outcome are immutable.';
  end if;

  if old.moderation_status = new.moderation_status then
    if row(old.reviewed_by, old.reviewed_at) is distinct from row(new.reviewed_by, new.reviewed_at) then
      raise exception 'A settled Market Finder report decision cannot be rewritten.';
    end if;
    return new;
  end if;

  if new.moderation_status = 'rejected'
    and new.reviewed_by is null
    and not exists (
      select 1
      from community_contributions contribution
      where contribution.id = new.contribution_id
        and contribution.moderation_status = 'rejected'
    )
  then
    raise exception 'A direct Market Finder report rejection requires reviewer attribution.';
  end if;

  if new.reviewed_at > statement_timestamp() then
    raise exception 'A Market Finder report decision cannot be future-dated.';
  end if;

  if not (
    (
      old.moderation_status = 'pending'
      and new.moderation_status in ('mapped', 'approved', 'rejected')
    )
    or (
      old.moderation_status = 'mapped'
      and new.moderation_status in ('approved', 'rejected')
    )
    or (
      old.moderation_status = 'approved'
      and new.moderation_status = 'rejected'
      and exists (
        select 1
        from community_contributions contribution
        where contribution.id = new.contribution_id
          and contribution.moderation_status = 'rejected'
      )
    )
  ) then
    raise exception 'Invalid Market Finder report moderation transition.';
  end if;

  return new;
end;
$$;

create trigger market_finder_reports_immutable_update_trigger
before update on market_finder_reports
for each row execute function market_finder_enforce_report_immutability();

create function market_finder_reject_report_with_parent()
returns trigger
language plpgsql
as $$
begin
  if new.moderation_status = 'rejected'
    and old.moderation_status is distinct from new.moderation_status
  then
    update market_finder_reports
    set moderation_status = 'rejected'
    where contribution_id = new.id
      and moderation_status <> 'rejected';
  end if;

  return new;
end;
$$;

create trigger community_contributions_market_report_rejection_trigger
after update of moderation_status on community_contributions
for each row execute function market_finder_reject_report_with_parent();

alter table moderation_audit_log
  drop constraint moderation_audit_log_queue_check;

alter table moderation_audit_log
  add constraint moderation_audit_log_queue_check check (queue in (
    'community_contribution',
    'community_edge',
    'community_observation',
    'community_moderation_value',
    'community_research_task',
    'retailer_application',
    'commerce_signal',
    'market_finder_report',
    'retailer_location',
    'physical_product_observation'
  ));

revoke all privileges on table
  physical_markets,
  physical_market_places,
  retailer_locations,
  retailer_location_channels,
  retailer_location_evidence,
  physical_product_observations,
  market_finder_reports
from public;

grant usage on type
  market_publication_state,
  physical_market_place_kind,
  physical_market_place_state,
  market_coordinate_precision,
  retailer_location_state,
  retailer_location_channel_kind,
  retailer_location_channel_state,
  physical_evidence_source_method,
  retailer_location_evidence_scope,
  physical_evidence_decision,
  physical_product_availability,
  physical_observation_moderation_status,
  market_report_outcome
to jelocare_app_runtime;

grant select on table
  physical_markets,
  physical_market_places,
  retailer_locations,
  retailer_location_channels,
  retailer_location_evidence,
  physical_product_observations,
  market_finder_reports
to jelocare_app_runtime;

grant insert, update on table
  physical_markets,
  physical_market_places,
  retailer_locations,
  retailer_location_channels
to jelocare_app_runtime;

grant insert on table
  retailer_location_evidence,
  physical_product_observations,
  market_finder_reports
to jelocare_app_runtime;

grant update (decision, reviewed_by, reviewed_at)
  on table retailer_location_evidence
  to jelocare_app_runtime;

grant update (moderation_status, reviewed_by, reviewed_at)
  on table physical_product_observations, market_finder_reports
  to jelocare_app_runtime;

revoke delete on table
  physical_markets,
  physical_market_places,
  retailer_locations,
  retailer_location_channels,
  retailer_location_evidence,
  physical_product_observations,
  market_finder_reports
from jelocare_app_runtime;

commit;
