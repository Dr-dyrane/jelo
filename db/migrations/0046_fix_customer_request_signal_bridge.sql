begin;

-- PostgreSQL exposes GREATEST as a SQL conditional expression, not as a
-- pg_catalog function. Migration 0036 schema-qualified it, so the first
-- transition that decremented an existing private request signal failed with
-- undefined_function. Replace only the bridge body; keep its signature,
-- SECURITY DEFINER boundary, pinned search path, owner check, and grants.
create or replace function public.sync_customer_product_request_research_signal(
  target_request_id uuid
)
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
    set signal_count = greatest(signal_count - 1, 0),
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

revoke all privileges on function public.sync_customer_product_request_research_signal(uuid)
  from public, jelocare_app_runtime;
grant execute on function public.sync_customer_product_request_research_signal(uuid)
  to jelocare_shelf_runtime;

commit;
