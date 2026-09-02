begin;

-- A reviewed row keeps the operator and timestamp that made its original
-- decision. Supersession is a later state transition, not a new attribution
-- for the historical approval.
create or replace function public.market_finder_enforce_evidence_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
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
        from public.retailer_location_evidence successor
        where successor.supersedes_evidence_id = old.id
          and successor.decision = 'approved'
      )
    )
  ) then
    raise exception 'Invalid retailer location evidence decision transition.';
  end if;

  if old.decision = 'approved'
    and new.decision = 'superseded'
    and row(old.reviewed_by, old.reviewed_at) is distinct from row(new.reviewed_by, new.reviewed_at)
  then
    raise exception 'Supersession must preserve the original evidence reviewer.';
  end if;

  return new;
end;
$$;

create or replace function public.market_finder_apply_evidence_supersession()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.decision = 'approved' and new.supersedes_evidence_id is not null then
    if tg_op = 'UPDATE' and old.decision is not distinct from new.decision then
      return new;
    end if;

    update public.retailer_location_evidence
    set decision = 'superseded'
    where id = new.supersedes_evidence_id
      and decision = 'approved';

    if not found then
      raise exception 'The superseded location evidence is not currently approved.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.market_finder_enforce_observation_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
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
        from public.physical_product_observations successor
        where successor.supersedes_observation_id = old.id
          and successor.moderation_status = 'approved'
      )
    )
  ) then
    raise exception 'Invalid physical product observation moderation transition.';
  end if;

  if old.moderation_status = 'approved'
    and new.moderation_status = 'superseded'
    and row(old.reviewed_by, old.reviewed_at) is distinct from row(new.reviewed_by, new.reviewed_at)
  then
    raise exception 'Supersession must preserve the original observation reviewer.';
  end if;

  return new;
end;
$$;

create or replace function public.market_finder_apply_observation_supersession()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
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

    update public.physical_product_observations
    set moderation_status = 'superseded'
    where id = new.supersedes_observation_id
      and moderation_status = 'approved';

    if not found then
      raise exception 'The superseded observation is not currently approved.';
    end if;
  end if;

  return new;
end;
$$;

-- All eligibility-changing writes and report inserts share one short-lived
-- transaction lock. Statement triggers acquire it before a context mutation;
-- the report trigger acquires it before taking fresh READ COMMITTED snapshots.
create function public.market_finder_lock_context_write()
returns trigger
language plpgsql
volatile
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('jelocare:market-finder'),
    pg_catalog.hashtext('current-context')
  );
  return null;
end;
$$;

create trigger physical_markets_market_finder_context_lock_trigger
before insert or update or delete on public.physical_markets
for each statement execute function public.market_finder_lock_context_write();

create trigger physical_market_places_market_finder_context_lock_trigger
before insert or update or delete on public.physical_market_places
for each statement execute function public.market_finder_lock_context_write();

create trigger retailer_locations_market_finder_context_lock_trigger
before insert or update or delete on public.retailer_locations
for each statement execute function public.market_finder_lock_context_write();

create trigger retailer_location_channels_market_finder_context_lock_trigger
before insert or update or delete on public.retailer_location_channels
for each statement execute function public.market_finder_lock_context_write();

create trigger retailer_location_evidence_market_finder_context_lock_trigger
before insert or update or delete on public.retailer_location_evidence
for each statement execute function public.market_finder_lock_context_write();

create trigger products_market_finder_context_lock_trigger
before insert or update or delete on public.products
for each statement execute function public.market_finder_lock_context_write();

create trigger catalogue_identity_market_finder_context_lock_trigger
before insert or update or delete on public.catalogue_product_identity_versions
for each statement execute function public.market_finder_lock_context_write();

create trigger physical_observations_market_finder_context_lock_trigger
before insert or update or delete on public.physical_product_observations
for each statement execute function public.market_finder_lock_context_write();

-- CREATE TRIGGER has now taken transaction-held locks on both append-only
-- evidence tables. If another environment committed a supersession under the
-- old function while this migration was starting, this audit sees it after
-- the writer completes. The original reviewer cannot be reconstructed safely,
-- so stop for an operator audit instead of guessing.
do $audit$
begin
  if exists (
    select 1
    from public.retailer_location_evidence
    where decision = 'superseded'
  ) or exists (
    select 1
    from public.physical_product_observations
    where moderation_status = 'superseded'
  ) then
    raise exception '0055 requires an operator audit of pre-existing Market Finder supersessions.';
  end if;
end;
$audit$;

-- TRUNCATE is not an application operation and takes its relation lock before
-- a table trigger can coordinate. Keep it outside the runtime authority; the
-- protected migration boundary already requires report intake to stay off.
revoke truncate on table
  public.physical_markets,
  public.physical_market_places,
  public.retailer_locations,
  public.retailer_location_channels,
  public.retailer_location_evidence,
  public.products,
  public.catalogue_product_identity_versions,
  public.physical_product_observations
from public, jelocare_app_runtime;

create or replace function public.market_finder_validate_report_context()
returns trigger
language plpgsql
volatile
set search_path = pg_catalog, public, pg_temp
as $$
declare
  parent_kind text;
  parent_status public.community_moderation_status;
  parent_retain_until timestamptz;
  validation_now timestamptz;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Market Finder report context validation requires READ COMMITTED isolation.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('jelocare:market-finder'),
    pg_catalog.hashtext('current-context')
  );
  validation_now := pg_catalog.clock_timestamp();

  if new.moderation_status <> 'pending'
    or new.reviewed_by is not null
    or new.reviewed_at is not null
  then
    raise exception 'A new Market Finder report projection must enter pending review.';
  end if;

  select contribution_kind::text, moderation_status, retain_until
  into parent_kind, parent_status, parent_retain_until
  from public.community_contributions
  where id = new.contribution_id
  for no key update;

  if parent_kind is null
    or parent_kind <> 'market_report'
    or parent_status = 'rejected'
    or parent_retain_until <= validation_now
  then
    raise exception 'Market Finder reports require a retained non-rejected market-report contribution.';
  end if;

  if not exists (
    select 1
    from public.physical_markets market
    join public.retailer_locations location on location.id = new.retailer_location_id
    where market.id = new.market_id
      and market.publication_state = 'published'
      and location.market_id = market.id
      and location.location_state = 'verified'
      and location.verification_expires_at > validation_now
      and (
        location.primary_place_id is null
        or exists (
          select 1
          from public.physical_market_places place
          where place.id = location.primary_place_id
            and place.market_id = market.id
            and place.place_state = 'verified'
        )
      )
      and exists (
        select 1
        from public.retailer_location_evidence identity_evidence
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
          and identity_evidence.expires_at > validation_now
      )
  ) then
    raise exception 'Market Finder report context requires a published market and current verified location.';
  end if;

  if not exists (
    select 1
    from public.catalogue_product_identity_versions identity_version
    join public.products product on product.id = identity_version.product_id
    where identity_version.identity_version_id = new.product_identity_version_id
      and identity_version.lifecycle_state = 'active'
      and product.is_published = true
  ) then
    raise exception 'Market Finder report context requires an active published exact identity.';
  end if;

  if not exists (
    select 1
    from public.retailer_locations location
    join lateral (
      select approved_observation.availability,
             approved_observation.expires_at
      from public.physical_product_observations approved_observation
      where approved_observation.retailer_location_id = location.id
        and approved_observation.product_identity_version_id = new.product_identity_version_id
        and approved_observation.moderation_status = 'approved'
        and not exists (
          select 1
          from public.physical_product_observations approved_successor
          where approved_successor.supersedes_observation_id = approved_observation.id
            and approved_successor.moderation_status = 'approved'
        )
      order by
        approved_observation.observed_at desc,
        approved_observation.created_at desc,
        approved_observation.id desc
      limit 1
    ) observation on true
    where location.id = new.retailer_location_id
      and location.market_id = new.market_id
      and observation.expires_at > validation_now
      and observation.availability in ('in_stock', 'low_stock')
      and (
        exists (
          select 1
          from public.retailer_location_evidence directions_evidence
          where location.public_directions is not null
            and public.market_finder_public_action_is_usable(
              'directions',
              location.public_directions
            )
            and directions_evidence.retailer_location_id = location.id
            and directions_evidence.evidence_scope = 'public_directions'
            and directions_evidence.channel_id is null
            and directions_evidence.decision = 'approved'
            and directions_evidence.expires_at > validation_now
        )
        or exists (
          select 1
          from public.retailer_location_channels channel
          join public.retailer_location_evidence channel_evidence
            on channel_evidence.channel_id = channel.id
            and channel_evidence.retailer_location_id = location.id
            and channel_evidence.evidence_scope = 'channel_ownership'
            and channel_evidence.decision = 'approved'
            and channel_evidence.expires_at > validation_now
          where channel.retailer_location_id = location.id
            and channel.channel_state = 'verified'
            and channel.expires_at > validation_now
            and public.market_finder_public_action_is_usable(
              channel.channel_kind::text,
              channel.public_destination
            )
        )
      )
  ) then
    raise exception 'Market Finder report context requires a current eligible exact-product result.';
  end if;

  return new;
end;
$$;

commit;
