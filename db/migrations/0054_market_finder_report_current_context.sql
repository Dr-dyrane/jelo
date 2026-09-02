begin;

-- Keep the public Market Finder read and its contextual report intake on the
-- same conservative action boundary. The application still normalizes the
-- returned value before rendering it; this predicate prevents a report from
-- being attached to a destination that cannot be offered publicly.
create function public.market_finder_public_action_is_usable(
  action_kind text,
  action_destination text
)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog, public, pg_temp
as $$
declare
  normalized_destination text;
  whitespace_characters text;
  url_authority text;
  url_host text;
  url_port text;
begin
  whitespace_characters :=
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32)
    || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
    || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
    || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
    || chr(12288) || chr(65279);
  normalized_destination := btrim(regexp_replace(
    translate(
      action_destination,
      whitespace_characters,
      repeat(' ', char_length(whitespace_characters))
    ),
    ' +',
    ' ',
    'g'
  ));

  if char_length(normalized_destination) not between 1 and 500
    or normalized_destination ~ '[[:cntrl:]]'
  then
    return false;
  end if;

  if action_kind in ('directions', 'physical_visit', 'visit') then
    return true;
  end if;

  if action_kind = 'phone' then
    if left(lower(normalized_destination), 4) = 'tel:' then
      normalized_destination := substr(normalized_destination, 5);
    end if;

    normalized_destination := regexp_replace(
      normalized_destination,
      '[[:space:]().-]',
      '',
      'g'
    );
    return normalized_destination ~ '^\+[1-9][0-9]{7,14}$';
  end if;

  if action_kind not in ('whatsapp', 'website', 'social_business_profile')
    or normalized_destination !~* '^https://'
    or normalized_destination ~ '[[:space:]]'
  then
    return false;
  end if;

  url_authority := substring(
    lower(normalized_destination)
    from '^https://([^/?#]+)'
  );

  if url_authority is null
    or url_authority !~ '^[a-z0-9.-]+(?::[0-9]+)?$'
    or position('@' in url_authority) > 0
    or position('[' in url_authority) > 0
    or position(']' in url_authority) > 0
  then
    return false;
  end if;

  url_host := rtrim(split_part(url_authority, ':', 1), '.');
  url_port := nullif(split_part(url_authority, ':', 2), '');

  if url_host = ''
    or url_host = 'localhost'
    or url_host like '%.localhost'
    or url_host like '%.local'
    or url_host ~ '(?:^|\.)xn--'
    or url_host ~ '(?:^|\.)(?:0x[0-9a-f]*|[0-9]+)$'
    or url_host ~ '^(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+))*$'
  then
    return false;
  end if;

  if url_port is not null then
    if char_length(url_port) > 5 then
      return false;
    end if;

    if url_port::integer > 65535 then
      return false;
    end if;
  end if;

  if action_kind = 'whatsapp' then
    return url_host in (
      'wa.me',
      'api.whatsapp.com',
      'www.whatsapp.com',
      'whatsapp.com'
    );
  end if;

  return true;
end;
$$;

create or replace function public.market_finder_validate_report_context()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  parent_kind text;
  parent_status public.community_moderation_status;
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
  from public.community_contributions
  where id = new.contribution_id
  for no key update;

  if parent_kind is null
    or parent_kind <> 'market_report'
    or parent_status = 'rejected'
    or parent_retain_until <= statement_timestamp()
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
      and location.verification_expires_at > statement_timestamp()
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
          and identity_evidence.expires_at > statement_timestamp()
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
      and observation.expires_at > statement_timestamp()
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
            and directions_evidence.expires_at > statement_timestamp()
        )
        or exists (
          select 1
          from public.retailer_location_channels channel
          join public.retailer_location_evidence channel_evidence
            on channel_evidence.channel_id = channel.id
            and channel_evidence.retailer_location_id = location.id
            and channel_evidence.evidence_scope = 'channel_ownership'
            and channel_evidence.decision = 'approved'
            and channel_evidence.expires_at > statement_timestamp()
          where channel.retailer_location_id = location.id
            and channel.channel_state = 'verified'
            and channel.expires_at > statement_timestamp()
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
