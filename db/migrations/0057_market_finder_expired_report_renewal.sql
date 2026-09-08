begin;

-- An expired exact-product observation is precisely the record a shopper can
-- help renew. Keep the verified market, location, place, identity, moderation,
-- and serialization boundaries from 0055, while allowing the newest approved
-- observation to be expired. Current observations still require a positive
-- availability state and a current safe public action.
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
      and (
        observation.expires_at <= validation_now
        or (
          observation.expires_at > validation_now
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
        )
      )
  ) then
    raise exception 'Market Finder report context requires a current eligible result or an expired reviewed exact-product record.';
  end if;

  return new;
end;
$$;

commit;
