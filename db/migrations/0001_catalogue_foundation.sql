begin;

create extension if not exists pgcrypto;

create type product_category as enum ('Face', 'Hair', 'Body');
create type evidence_level as enum ('high', 'moderate', 'emerging');
create type asset_kind as enum ('packshot', 'thumbnail', 'hero', 'lifestyle', 'texture', 'ingredient', 'logo');
create type asset_status as enum ('pending', 'verified', 'failed', 'retired');

create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  country_code text,
  summary text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  slug text not null unique,
  name text not null,
  size text not null,
  category product_category not null,
  routine_step text not null,
  display_line text not null,
  usage text not null,
  evidence evidence_level not null,
  sensitive_friendly boolean not null default false,
  is_published boolean not null default false,
  source_version text not null default 'static-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  kind asset_kind not null,
  blob_url text,
  source_url text,
  source_host text,
  alt_text text not null,
  mime_type text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  byte_size bigint check (byte_size is null or byte_size >= 0),
  status asset_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, kind)
);

create table concerns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  summary text,
  created_at timestamptz not null default now()
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  inci_name text not null unique,
  display_name text not null,
  summary text,
  created_at timestamptz not null default now()
);

create table product_concerns (
  product_id uuid not null references products(id) on delete cascade,
  concern_id uuid not null references concerns(id) on delete cascade,
  priority smallint not null default 0,
  primary key (product_id, concern_id)
);

create table product_ingredients (
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  concentration_text text,
  is_key boolean not null default false,
  primary key (product_id, ingredient_id)
);

create table product_skin_types (
  product_id uuid not null references products(id) on delete cascade,
  skin_type text not null,
  primary key (product_id, skin_type)
);

create table product_best_for (
  product_id uuid not null references products(id) on delete cascade,
  label text not null,
  priority smallint not null default 0,
  primary key (product_id, label)
);

create table retailers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  trust_score smallint not null check (trust_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  retailer_id uuid not null references retailers(id) on delete restrict,
  url text not null,
  market_code text not null,
  available boolean not null default true,
  price_minor bigint check (price_minor is null or price_minor >= 0),
  currency_code char(3),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, retailer_id, market_code)
);

create index products_brand_id_idx on products (brand_id);
create index products_published_category_idx on products (is_published, category);
create index product_images_status_idx on product_images (status);
create index product_concerns_concern_id_idx on product_concerns (concern_id);
create index offers_product_market_idx on offers (product_id, market_code);

commit;
