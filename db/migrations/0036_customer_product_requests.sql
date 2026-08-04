begin;

create type customer_product_request_lifecycle_state as enum (
  'draft',
  'pending',
  'in_review',
  'needs_info',
  'matched',
  'published',
  'withdrawn'
);

create type customer_product_request_origin as enum (
  'customer',
  'legacy_pages_v1_0'
);

create type customer_product_request_mutation_operation as enum (
  'create',
  'update',
  'consent_revoke',
  'submit',
  'withdraw',
  'image_replace',
  'image_remove'
);

-- Research resolution evidence is append-only by cycle. Existing tasks and
-- their one historical product resolution become cycle 1; a terminal task can
-- later advance without deleting or overwriting that evidence.
alter table community_research_tasks
  add column resolution_cycle integer;

update community_research_tasks
set resolution_cycle = 1
where resolution_cycle is null;

alter table community_research_tasks
  alter column resolution_cycle set not null,
  alter column resolution_cycle set default 1,
  add constraint community_research_tasks_resolution_cycle_check
    check (resolution_cycle > 0);

alter table community_product_research_resolutions
  add column resolution_cycle integer;

update community_product_research_resolutions
set resolution_cycle = 1
where resolution_cycle is null;

alter table community_product_research_resolutions
  alter column resolution_cycle set not null,
  alter column resolution_cycle set default 1,
  add constraint community_product_research_resolutions_cycle_check
    check (resolution_cycle > 0),
  drop constraint community_product_research_resolutions_pkey,
  add constraint community_product_research_resolutions_pkey
    primary key (task_id, resolution_cycle);

create table customer_product_requests (
  id uuid primary key default gen_random_uuid(),
  owner_subject text not null
    check (nullif(pg_catalog.btrim(owner_subject), '') is not null and pg_catalog.length(owner_subject) <= 320),
  revision integer not null default 0 check (revision >= 0),
  lifecycle_state customer_product_request_lifecycle_state not null default 'draft',
  brand text
    check (brand is null or (nullif(pg_catalog.btrim(brand), '') is not null and pg_catalog.length(brand) <= 120)),
  full_pack_name text
    check (full_pack_name is null or (nullif(pg_catalog.btrim(full_pack_name), '') is not null and pg_catalog.length(full_pack_name) <= 240)),
  printed_size_variant text
    check (printed_size_variant is null or (nullif(pg_catalog.btrim(printed_size_variant), '') is not null and pg_catalog.length(printed_size_variant) <= 120)),
  category text
    check (category is null or (nullif(pg_catalog.btrim(category), '') is not null and pg_catalog.length(category) <= 80)),
  retailer_label text
    check (retailer_label is null or (nullif(pg_catalog.btrim(retailer_label), '') is not null and pg_catalog.length(retailer_label) <= 160)),
  source_url text
    check (
      source_url is null
      or (
        pg_catalog.length(source_url) <= 2048
        and source_url ~ '^https://[^[:space:][:cntrl:]]+$'
      )
    ),
  normalized_entity_ref text
    check (
      normalized_entity_ref is null
      or (
        pg_catalog.length(normalized_entity_ref) between 8 and 160
        and normalized_entity_ref ~ '^custom:[^[:cntrl:]]+$'
      )
    ),
  photo_identification_consent boolean not null default false,
  matched_identity_version_id uuid
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  origin customer_product_request_origin not null default 'customer',
  origin_reference text
    check (
      origin_reference is null
      or origin = 'customer'
      or (
        origin = 'legacy_pages_v1_0'
        and origin_reference ~ '^pages-v1\.0:[a-z0-9]+(?:-[a-z0-9]+)*$'
        and pg_catalog.length(origin_reference) <= 120
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (owner_subject, id),
  check (
    (lifecycle_state = 'draft' and submitted_at is null)
    or (
      lifecycle_state in ('pending', 'in_review', 'needs_info', 'matched', 'published')
      and submitted_at is not null
    )
    or lifecycle_state = 'withdrawn'
  ),
  check (
    (
      lifecycle_state in ('matched', 'published')
      and matched_identity_version_id is not null
    )
    or (
      lifecycle_state not in ('matched', 'published')
      and (
        matched_identity_version_id is null
        or lifecycle_state = 'withdrawn'
      )
    )
  ),
  check (
    (
      lifecycle_state = 'withdrawn'
      and brand is null
      and full_pack_name is null
      and printed_size_variant is null
      and category is null
      and retailer_label is null
      and source_url is null
      and normalized_entity_ref is null
      and origin_reference is null
      and photo_identification_consent = false
    )
    or (
      lifecycle_state <> 'withdrawn'
      and brand is not null
      and full_pack_name is not null
      and printed_size_variant is not null
      and normalized_entity_ref is not null
      and (
        (origin = 'customer' and origin_reference is null)
        or (origin = 'legacy_pages_v1_0' and origin_reference is not null)
      )
    )
  )
);

create index customer_product_requests_owner_updated_idx
  on customer_product_requests (owner_subject, updated_at desc, id);
create index customer_product_requests_active_demand_idx
  on customer_product_requests (normalized_entity_ref, updated_at desc)
  where lifecycle_state in ('pending', 'in_review', 'needs_info');

create table customer_product_request_images (
  request_id uuid primary key,
  owner_subject text not null,
  blob_pathname text not null unique
    check (
      pg_catalog.length(blob_pathname) between 1 and 512
      and blob_pathname ~ '^customer-product-requests/[a-f0-9]{32}/[0-9a-f-]{36}/[a-f0-9-]+\.webp$'
    ),
  media_type text not null default 'image/webp' check (media_type = 'image/webp'),
  byte_size integer not null check (byte_size between 1 and 4194304),
  pixel_width integer not null check (pixel_width between 1 and 1600),
  pixel_height integer not null check (pixel_height between 1 and 1600),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_subject, request_id)
    references customer_product_requests(owner_subject, id) on delete restrict
);

create table customer_product_request_mutations (
  owner_subject text not null,
  idempotency_key uuid not null,
  request_id uuid not null,
  operation customer_product_request_mutation_operation not null,
  request_fingerprint_sha256 text not null
    check (request_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  result_revision integer not null check (result_revision >= 0),
  created_at timestamptz not null default now(),
  primary key (owner_subject, idempotency_key),
  foreign key (owner_subject, request_id)
    references customer_product_requests(owner_subject, id) on delete restrict
);

create index customer_product_request_mutations_request_idx
  on customer_product_request_mutations (owner_subject, request_id, created_at desc);

create table customer_product_request_blob_cleanup (
  owner_subject text not null,
  request_id uuid not null,
  blob_pathname text not null,
  queued_at timestamptz not null default now(),
  primary key (owner_subject, blob_pathname),
  foreign key (owner_subject, request_id)
    references customer_product_requests(owner_subject, id) on delete restrict
);

create index customer_product_request_blob_cleanup_pending_idx
  on customer_product_request_blob_cleanup (owner_subject, queued_at, blob_pathname);

create table customer_product_request_research_mentions (
  request_id uuid primary key
    references customer_product_requests(id) on delete restrict,
  task_id uuid not null references community_research_tasks(id) on delete restrict,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index customer_product_request_research_mentions_task_idx
  on customer_product_request_research_mentions (task_id, active);

alter table customer_product_requests enable row level security;
alter table customer_product_requests force row level security;
alter table customer_product_request_images enable row level security;
alter table customer_product_request_images force row level security;
alter table customer_product_request_mutations enable row level security;
alter table customer_product_request_mutations force row level security;
alter table customer_product_request_blob_cleanup enable row level security;
alter table customer_product_request_blob_cleanup force row level security;

create policy customer_product_requests_owner_policy
on customer_product_requests
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

create policy customer_product_request_images_owner_policy
on customer_product_request_images
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

create policy customer_product_request_mutations_owner_policy
on customer_product_request_mutations
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

create policy customer_product_request_blob_cleanup_owner_policy
on customer_product_request_blob_cleanup
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

-- This bridge is the only Shelf-runtime path into the existing aggregate queue.
-- Its input is a private request ID; it copies only normalized product identity
-- text and adjusts one active signal by delta, so retries and edits cannot inflate
-- the contribution-backed signal_count already present on a task.
create function sync_customer_product_request_research_signal(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  customer_subject text := pg_catalog.current_setting('app.customer_subject', true);
  request_row public.customer_product_requests%rowtype;
  existing_mention public.customer_product_request_research_mentions%rowtype;
  next_task_id uuid;
  should_be_active boolean;
  identity_label text;
begin
  if nullif(pg_catalog.btrim(customer_subject), '') is null then
    raise exception 'Customer subject is unavailable.' using errcode = '42501';
  end if;

  select request.*
  into request_row
  from public.customer_product_requests request
  where request.id = target_request_id
    and request.owner_subject = customer_subject;

  if not found then
    raise exception 'Customer product request is unavailable.' using errcode = 'P0002';
  end if;

  should_be_active := request_row.lifecycle_state in ('pending', 'in_review', 'needs_info');
  identity_label := pg_catalog.left(
    request_row.brand || ' · ' || request_row.full_pack_name || ' · ' || request_row.printed_size_variant,
    120
  );

  select mention.*
  into existing_mention
  from public.customer_product_request_research_mentions mention
  where mention.request_id = target_request_id
  for update;

  if should_be_active then
    insert into public.community_research_tasks (
      task_kind,
      entity_kind,
      entity_ref,
      entity_label,
      entity_source,
      priority_lane,
      publication_status
    ) values (
      'product-identity',
      'product',
      request_row.normalized_entity_ref,
      identity_label,
      'custom',
      'community-first',
      'private-research-only'
    )
    on conflict (task_kind, entity_ref) do update
    set entity_label = excluded.entity_label,
        entity_source = excluded.entity_source,
        updated_at = now()
    returning id into next_task_id;
  end if;

  -- A terminal task is reopened only when this call is about to add a new
  -- active demand signal. A retry for an already-active mention leaves the
  -- operator's completed/dismissed decision intact and cannot inflate counts.
  if should_be_active and (
    existing_mention.request_id is null
    or not existing_mention.active
    or existing_mention.task_id <> next_task_id
  ) then
    update public.community_research_tasks
    set status = 'pending',
        resolution_cycle = resolution_cycle + 1,
        assigned_operator_id = null,
        work_state = 'ready',
        next_action = null,
        last_reviewed_at = null,
        updated_at = now()
    where id = next_task_id
      and status in ('completed', 'dismissed');
  end if;

  if existing_mention.request_id is not null and existing_mention.active
    and (not should_be_active or existing_mention.task_id <> next_task_id)
  then
    update public.community_research_tasks
    set signal_count = pg_catalog.greatest(signal_count - 1, 0),
        updated_at = now()
    where id = existing_mention.task_id;
  end if;

  if should_be_active then
    if existing_mention.request_id is null then
      insert into public.customer_product_request_research_mentions (
        request_id, task_id, active
      ) values (
        target_request_id, next_task_id, true
      );
      update public.community_research_tasks
      set signal_count = signal_count + 1,
          last_seen_at = now(),
          updated_at = now()
      where id = next_task_id;
    elsif not existing_mention.active or existing_mention.task_id <> next_task_id then
      update public.customer_product_request_research_mentions
      set task_id = next_task_id,
          active = true,
          last_seen_at = now()
      where request_id = target_request_id;
      update public.community_research_tasks
      set signal_count = signal_count + 1,
          last_seen_at = now(),
          updated_at = now()
      where id = next_task_id;
    else
      update public.customer_product_request_research_mentions
      set last_seen_at = now()
      where request_id = target_request_id;
    end if;
  elsif existing_mention.request_id is not null then
    if request_row.lifecycle_state = 'withdrawn' then
      delete from public.customer_product_request_research_mentions
      where request_id = target_request_id;
    else
      update public.customer_product_request_research_mentions
      set active = false,
          last_seen_at = now()
      where request_id = target_request_id;
    end if;
  end if;
end
$$;

alter table customer_shelf_import_receipts
  add column pending_request_count integer not null default 0
    check (pending_request_count >= 0);

revoke all privileges on table public.customer_product_requests from public;
revoke all privileges on table public.customer_product_request_images from public;
revoke all privileges on table public.customer_product_request_mutations from public;
revoke all privileges on table public.customer_product_request_blob_cleanup from public;
revoke all privileges on table public.customer_product_request_research_mentions from public;
revoke all privileges on function public.sync_customer_product_request_research_signal(uuid) from public;

revoke all privileges on table public.customer_product_requests from jelocare_app_runtime;
revoke all privileges on table public.customer_product_request_images from jelocare_app_runtime;
revoke all privileges on table public.customer_product_request_mutations from jelocare_app_runtime;
revoke all privileges on table public.customer_product_request_blob_cleanup from jelocare_app_runtime;
revoke all privileges on table public.customer_product_request_research_mentions from jelocare_app_runtime;
revoke all privileges on function public.sync_customer_product_request_research_signal(uuid) from jelocare_app_runtime;

revoke all privileges on table public.customer_product_requests from jelocare_shelf_runtime;
revoke all privileges on table public.customer_product_request_images from jelocare_shelf_runtime;
revoke all privileges on table public.customer_product_request_mutations from jelocare_shelf_runtime;
revoke all privileges on table public.customer_product_request_blob_cleanup from jelocare_shelf_runtime;
revoke all privileges on table public.customer_product_request_research_mentions from jelocare_shelf_runtime;
revoke all privileges on function public.sync_customer_product_request_research_signal(uuid) from jelocare_shelf_runtime;

grant usage on type public.customer_product_request_lifecycle_state to jelocare_shelf_runtime;
grant usage on type public.customer_product_request_origin to jelocare_shelf_runtime;
grant usage on type public.customer_product_request_mutation_operation to jelocare_shelf_runtime;
grant select, insert, update on table public.customer_product_requests to jelocare_shelf_runtime;
grant select, insert, update, delete on table public.customer_product_request_images to jelocare_shelf_runtime;
grant select, insert on table public.customer_product_request_mutations to jelocare_shelf_runtime;
grant select, insert, delete on table public.customer_product_request_blob_cleanup to jelocare_shelf_runtime;
grant execute on function public.sync_customer_product_request_research_signal(uuid) to jelocare_shelf_runtime;
grant select (task_id, active, first_seen_at, last_seen_at)
  on table public.customer_product_request_research_mentions
  to jelocare_app_runtime;

commit;
