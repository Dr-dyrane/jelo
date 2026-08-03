begin;

do $$
declare
  runtime_role_name text;
  runtime_role pg_roles%rowtype;
begin
  foreach runtime_role_name in array array[
    'jelocare_app_runtime',
    'jelocare_shelf_runtime'
  ] loop
    select *
    into runtime_role
    from pg_catalog.pg_roles
    where rolname = runtime_role_name;

    if not found then
      raise exception 'Required runtime database role is not provisioned.';
    end if;

    if not runtime_role.rolcanlogin
      or runtime_role.rolinherit
      or runtime_role.rolsuper
      or runtime_role.rolcreatedb
      or runtime_role.rolcreaterole
      or runtime_role.rolreplication
      or runtime_role.rolbypassrls
    then
      raise exception 'Required runtime database role is not safely configured.';
    end if;

    if exists (
      select 1
      from pg_catalog.pg_auth_members membership
      where membership.member = runtime_role.oid
    ) then
      raise exception 'Required runtime database role belongs to another role.';
    end if;

    if exists (
      select 1
      from pg_catalog.pg_class relation
      where relation.relowner = runtime_role.oid
    ) then
      raise exception 'Required runtime database role owns a relation.';
    end if;
  end loop;
end
$$;

alter role jelocare_app_runtime noinherit;
alter role jelocare_app_runtime set search_path to pg_catalog, public;
alter role jelocare_shelf_runtime noinherit;
alter role jelocare_shelf_runtime set search_path to pg_catalog, public;

do $$
begin
  execute pg_catalog.format(
    'grant connect on database %I to jelocare_app_runtime, jelocare_shelf_runtime',
    pg_catalog.current_database()
  );
end
$$;

create table customer_shelf_import_receipts (
  manifest_id text not null,
  owner_subject text not null
    check (nullif(trim(owner_subject), '') is not null and length(owner_subject) <= 320),
  source_commit text not null
    check (source_commit ~ '^[0-9a-f]{40}$'),
  source_products_sha256 text not null
    check (source_products_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_count integer not null
    check (accepted_count > 0),
  completed_at timestamptz not null default now(),
  primary key (manifest_id, owner_subject)
);

revoke all privileges on table public.customer_shelf_items from public;
revoke all privileges on table public.customer_shelf_import_receipts from public;

grant usage on schema public to jelocare_app_runtime;
grant select, insert, update, delete on all tables in schema public to jelocare_app_runtime;
grant usage, select, update on all sequences in schema public to jelocare_app_runtime;

revoke update, delete on table public.moderation_audit_log from jelocare_app_runtime;
revoke update, delete on table public.moderation_operator_access_audit from jelocare_app_runtime;
revoke all privileges on table public.customer_shelf_items from jelocare_app_runtime;
revoke all privileges on table public.customer_shelf_import_receipts from jelocare_app_runtime;
revoke all privileges on table public.schema_migrations from jelocare_app_runtime;

revoke all privileges on all tables in schema public from jelocare_shelf_runtime;
revoke all privileges on all sequences in schema public from jelocare_shelf_runtime;
revoke all privileges on all functions in schema public from jelocare_shelf_runtime;
revoke all privileges on type public.customer_shelf_save_origin from jelocare_shelf_runtime;
revoke all privileges on schema public from jelocare_shelf_runtime;

grant usage on schema public to jelocare_shelf_runtime;
grant usage on type public.customer_shelf_save_origin to jelocare_shelf_runtime;
grant usage on type public.catalogue_identity_lifecycle_state to jelocare_shelf_runtime;
grant select, insert, delete on table public.customer_shelf_items to jelocare_shelf_runtime;
grant select (
  identity_version_id,
  product_id,
  version_number,
  lifecycle_state,
  slug_at_review,
  brand_at_review,
  variant_at_review,
  size_at_review,
  package_version_at_review,
  formula_version_at_review
) on table public.catalogue_product_identity_versions to jelocare_shelf_runtime;
grant select (
  id,
  slug,
  is_published
) on table public.products to jelocare_shelf_runtime;

commit;
