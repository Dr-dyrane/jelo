begin;

create type catalogue_identity_provenance as enum (
  'jelocare_reviewed',
  'community_sourced_public'
);

create type catalogue_public_eligibility_basis as enum (
  'reviewed_catalogue_projection',
  'community_publication_release'
);

create type catalogue_identity_lifecycle_state as enum (
  'active',
  'merged',
  'retired',
  'superseded'
);

create type catalogue_identity_transition_kind as enum (
  'alias',
  'successor'
);

create table catalogue_product_identity_versions (
  identity_version_id uuid primary key,
  identity_id uuid not null,
  product_id uuid not null unique references products(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  provenance catalogue_identity_provenance not null,
  public_eligibility_basis catalogue_public_eligibility_basis not null,
  public_eligible_at timestamptz not null,
  slug_at_review text not null check (slug_at_review <> ''),
  brand_at_review text not null check (brand_at_review <> ''),
  variant_at_review text not null check (variant_at_review <> ''),
  size_at_review text not null check (size_at_review <> ''),
  package_version_at_review text not null check (package_version_at_review <> ''),
  formula_version_at_review text not null check (formula_version_at_review <> ''),
  lifecycle_state catalogue_identity_lifecycle_state not null default 'active',
  retired_at timestamptz,
  retirement_reason_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identity_id, version_number),
  constraint catalogue_identity_public_authority_check check (
    (
      provenance = 'jelocare_reviewed'
      and public_eligibility_basis = 'reviewed_catalogue_projection'
    )
    or (
      provenance = 'community_sourced_public'
      and public_eligibility_basis = 'community_publication_release'
    )
  ),
  constraint catalogue_identity_retirement_state_check check (
    (
      lifecycle_state = 'retired'
      and retired_at is not null
      and nullif(trim(retirement_reason_category), '') is not null
    )
    or (
      lifecycle_state <> 'retired'
      and retired_at is null
      and retirement_reason_category is null
    )
  )
);

create table catalogue_product_identity_transitions (
  from_identity_version_id uuid primary key
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  to_identity_version_id uuid not null
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  transition_kind catalogue_identity_transition_kind not null,
  reason_category text not null check (nullif(trim(reason_category), '') is not null),
  created_at timestamptz not null default now(),
  constraint catalogue_identity_transition_not_self_check
    check (from_identity_version_id <> to_identity_version_id)
);

create index catalogue_product_identity_versions_identity_idx
  on catalogue_product_identity_versions (identity_id, version_number desc);

create index catalogue_product_identity_versions_lifecycle_idx
  on catalogue_product_identity_versions (lifecycle_state, identity_version_id);

create index catalogue_product_identity_transitions_target_idx
  on catalogue_product_identity_transitions (to_identity_version_id);

create function catalogue_require_public_identity_source()
returns trigger
language plpgsql
as $$
declare
  product_is_published boolean;
  product_source_version text;
begin
  select is_published, source_version
  into product_is_published, product_source_version
  from products
  where id = new.product_id;

  if product_is_published is distinct from true then
    raise exception 'Catalogue identity versions require a public catalogue product.';
  end if;

  if (
    new.public_eligibility_basis = 'reviewed_catalogue_projection'
    and product_source_version not in ('static-v1', 'published-intake-v1')
  ) then
    raise exception 'Reviewed identity versions require the reviewed catalogue projection.';
  end if;

  return new;
end;
$$;

create trigger catalogue_product_identity_public_source_trigger
before insert on catalogue_product_identity_versions
for each row execute function catalogue_require_public_identity_source();

create function catalogue_enforce_identity_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Catalogue identity version history is append-only.';
  end if;

  if row(
    old.identity_version_id,
    old.identity_id,
    old.product_id,
    old.version_number,
    old.provenance,
    old.public_eligibility_basis,
    old.public_eligible_at,
    old.slug_at_review,
    old.brand_at_review,
    old.variant_at_review,
    old.size_at_review,
    old.package_version_at_review,
    old.formula_version_at_review,
    old.created_at
  ) is distinct from row(
    new.identity_version_id,
    new.identity_id,
    new.product_id,
    new.version_number,
    new.provenance,
    new.public_eligibility_basis,
    new.public_eligible_at,
    new.slug_at_review,
    new.brand_at_review,
    new.variant_at_review,
    new.size_at_review,
    new.package_version_at_review,
    new.formula_version_at_review,
    new.created_at
  ) then
    raise exception 'Catalogue identity and reviewed version fields are immutable.';
  end if;

  if old.lifecycle_state <> new.lifecycle_state and old.lifecycle_state <> 'active' then
    raise exception 'Catalogue identity lifecycle transitions cannot be rewritten.';
  end if;

  if new.lifecycle_state = 'merged' and not exists (
    select 1
    from catalogue_product_identity_transitions
    where from_identity_version_id = new.identity_version_id
      and transition_kind = 'alias'
  ) then
    raise exception 'Merged identity versions require an explicit alias.';
  end if;

  if new.lifecycle_state = 'superseded' and not exists (
    select 1
    from catalogue_product_identity_transitions
    where from_identity_version_id = new.identity_version_id
      and transition_kind = 'successor'
  ) then
    raise exception 'Superseded identity versions require an explicit successor.';
  end if;

  return new;
end;
$$;

create trigger catalogue_product_identity_immutable_update_trigger
before update on catalogue_product_identity_versions
for each row execute function catalogue_enforce_identity_version_immutability();

create trigger catalogue_product_identity_immutable_delete_trigger
before delete on catalogue_product_identity_versions
for each row execute function catalogue_enforce_identity_version_immutability();

create function catalogue_validate_identity_transition()
returns trigger
language plpgsql
as $$
declare
  source_state catalogue_identity_lifecycle_state;
begin
  select lifecycle_state
  into source_state
  from catalogue_product_identity_versions
  where identity_version_id = new.from_identity_version_id
  for update;

  if source_state <> 'active' then
    raise exception 'Only an active identity version can receive a transition.';
  end if;

  if exists (
    with recursive reachable(identity_version_id) as (
      select new.to_identity_version_id
      union
      select transition.to_identity_version_id
      from catalogue_product_identity_transitions transition
      join reachable
        on transition.from_identity_version_id = reachable.identity_version_id
    )
    select 1
    from reachable
    where identity_version_id = new.from_identity_version_id
  ) then
    raise exception 'Catalogue identity transition cycles are prohibited.';
  end if;

  return new;
end;
$$;

create trigger catalogue_product_identity_transition_validation_trigger
before insert on catalogue_product_identity_transitions
for each row execute function catalogue_validate_identity_transition();

create function catalogue_apply_identity_transition_state()
returns trigger
language plpgsql
as $$
begin
  update catalogue_product_identity_versions
  set lifecycle_state = case
        when new.transition_kind = 'alias' then 'merged'::catalogue_identity_lifecycle_state
        else 'superseded'::catalogue_identity_lifecycle_state
      end,
      updated_at = now()
  where identity_version_id = new.from_identity_version_id;
  return new;
end;
$$;

create trigger catalogue_product_identity_transition_state_trigger
after insert on catalogue_product_identity_transitions
for each row execute function catalogue_apply_identity_transition_state();

create function catalogue_reject_transition_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Catalogue identity transitions are append-only.';
end;
$$;

create trigger catalogue_product_identity_transition_update_trigger
before update on catalogue_product_identity_transitions
for each row execute function catalogue_reject_transition_history_mutation();

create trigger catalogue_product_identity_transition_delete_trigger
before delete on catalogue_product_identity_transitions
for each row execute function catalogue_reject_transition_history_mutation();

create function catalogue_preserve_product_identity_history()
returns trigger
language plpgsql
as $$
begin
  if old.size is distinct from new.size and exists (
    select 1
    from catalogue_product_identity_versions
    where product_id = old.id
  ) then
    raise exception 'A material size change requires a new catalogue identity version and explicit successor.';
  end if;

  if old.is_published = false and new.is_published = true and exists (
    select 1
    from catalogue_product_identity_versions
    where product_id = old.id
      and lifecycle_state <> 'active'
  ) then
    raise exception 'A retired or transitioned identity version cannot be republished in place.';
  end if;

  if old.is_published = true and new.is_published = false then
    update catalogue_product_identity_versions
    set lifecycle_state = 'retired',
        retired_at = now(),
        retirement_reason_category = 'catalogue_projection_retirement',
        updated_at = now()
    where product_id = old.id
      and lifecycle_state = 'active';
  end if;

  return new;
end;
$$;

create trigger catalogue_products_preserve_identity_history_trigger
before update of is_published, size on products
for each row execute function catalogue_preserve_product_identity_history();

insert into catalogue_product_identity_versions (
  identity_version_id,
  identity_id,
  product_id,
  version_number,
  provenance,
  public_eligibility_basis,
  public_eligible_at,
  slug_at_review,
  brand_at_review,
  variant_at_review,
  size_at_review,
  package_version_at_review,
  formula_version_at_review
)
select
  substring(encode(digest(
    'jelocare:catalogue-product-identity-version:v1:' || product.id::text,
    'sha256'
  ), 'hex') from 1 for 32)::uuid,
  substring(encode(digest(
    'jelocare:catalogue-product-identity:v1:' || product.id::text,
    'sha256'
  ), 'hex') from 1 for 32)::uuid,
  product.id,
  1,
  'jelocare_reviewed',
  'reviewed_catalogue_projection',
  now(),
  product.slug,
  brand.name,
  product.name,
  product.size,
  'reviewed-baseline-v1:' || product.source_version,
  'reviewed-baseline-v1:' || product.source_version
from products product
join brands brand on brand.id = product.brand_id
where product.is_published = true
  and product.source_version in ('static-v1', 'published-intake-v1')
on conflict (product_id) do nothing;

commit;
