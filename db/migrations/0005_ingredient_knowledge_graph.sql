begin;

create type clinical_evidence_grade as enum ('high', 'moderate', 'emerging', 'insufficient');
create type ingredient_safety_status as enum ('generally_safe', 'use_with_caution', 'avoid', 'unknown');
create type ingredient_relation_type as enum ('compatible', 'complementary', 'redundant', 'irritation_risk', 'avoid_together');

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  inci_name text not null,
  common_name text,
  summary text,
  evidence_grade clinical_evidence_grade not null default 'insufficient',
  pregnancy_status ingredient_safety_status not null default 'unknown',
  nursing_status ingredient_safety_status not null default 'unknown',
  sensitive_skin_status ingredient_safety_status not null default 'unknown',
  comedogenic_rating smallint check (comedogenic_rating between 0 and 5),
  requires_sun_protection boolean not null default false,
  pharmacist_reviewed boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ingredient_synonyms (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  synonym text not null,
  normalized_synonym text generated always as (lower(trim(synonym))) stored,
  created_at timestamptz not null default now(),
  unique (ingredient_id, normalized_synonym)
);

create unique index ingredient_synonyms_global_name_idx
  on ingredient_synonyms (normalized_synonym);

create table ingredient_concerns (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  concern_slug text not null,
  evidence_grade clinical_evidence_grade not null default 'insufficient',
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ingredient_id, concern_slug)
);

create table product_ingredients (
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  position integer check (position is null or position > 0),
  concentration_percent numeric(6,3) check (
    concentration_percent is null
    or (concentration_percent >= 0 and concentration_percent <= 100)
  ),
  is_active boolean not null default false,
  source text,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id)
);

create table ingredient_relations (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  related_ingredient_id uuid not null references ingredients(id) on delete cascade,
  relation_type ingredient_relation_type not null,
  evidence_grade clinical_evidence_grade not null default 'insufficient',
  rationale text not null,
  pharmacist_reviewed boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ingredient_id <> related_ingredient_id),
  primary key (ingredient_id, related_ingredient_id, relation_type)
);

create index ingredients_inci_name_idx on ingredients (lower(inci_name));
create index ingredients_common_name_idx on ingredients (lower(common_name));
create index ingredient_concerns_concern_idx on ingredient_concerns (concern_slug, evidence_grade);
create index product_ingredients_ingredient_idx on product_ingredients (ingredient_id, product_id);
create index product_ingredients_active_idx on product_ingredients (product_id, is_active) where is_active = true;
create index ingredient_relations_related_idx on ingredient_relations (related_ingredient_id, relation_type);

commit;
