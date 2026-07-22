begin;

create extension if not exists pg_trgm;

create type external_catalogue_category as enum (
  'Face care',
  'Hair & scalp',
  'Body care',
  'Makeup',
  'Fragrance',
  'Personal care'
);

create table external_catalogue_products (
  id uuid primary key default gen_random_uuid(),
  source_catalogue text not null check (source_catalogue = 'open-beauty-facts'),
  source_product_id text not null,
  barcode text not null check (barcode ~ '^[0-9]{8,14}$'),
  brand text not null,
  name text not null,
  quantity text not null,
  category external_catalogue_category not null,
  source_categories jsonb not null default '[]'::jsonb,
  countries jsonb not null default '[]'::jsonb,
  search_text text not null,
  source_url text not null,
  source_updated_at timestamptz not null,
  source_retrieved_at timestamptz not null,
  source_schema_version text not null,
  source_snapshot_sha256 char(64) not null,
  raw_payload_sha256 char(64) not null,
  ingredient_label_sha256 char(64),
  source_image_url text not null,
  ingredient_image_url text,
  canonical_image_url text not null,
  source_image_sha256 char(64) not null,
  image_sha256 char(64) not null,
  image_mime_type text not null check (image_mime_type = 'image/webp'),
  image_width integer not null check (image_width >= 100),
  image_height integer not null check (image_height >= 100),
  image_byte_size integer not null check (image_byte_size > 0),
  image_license text not null check (image_license = 'CC BY-SA 3.0'),
  image_attribution text not null,
  data_license text not null check (data_license = 'ODbL 1.0'),
  content_license text not null check (content_license = 'Database Contents License 1.0'),
  clinical_review_status text not null default 'not-reviewed' check (clinical_review_status = 'not-reviewed'),
  source_photo_validated boolean not null default false,
  source_ingredients_complete boolean not null default false,
  quality_score integer not null,
  import_status text not null default 'published' check (import_status in ('candidate', 'published', 'quarantined', 'retired')),
  quarantine_reason text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_catalogue, source_product_id),
  unique (source_catalogue, barcode),
  check ((import_status = 'quarantined') = (quarantine_reason is not null))
);

create index external_catalogue_published_category_idx
  on external_catalogue_products (is_published, category, quality_score desc, barcode);
create index external_catalogue_barcode_idx
  on external_catalogue_products (barcode);
create index external_catalogue_search_trgm_idx
  on external_catalogue_products using gin (search_text gin_trgm_ops);
create index external_catalogue_source_updated_idx
  on external_catalogue_products (source_updated_at desc);

commit;
