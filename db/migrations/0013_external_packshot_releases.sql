begin;

alter table external_catalogue_products
  drop constraint if exists external_catalogue_products_import_status_check;

alter table external_catalogue_products
  add constraint external_catalogue_products_import_status_check
  check (import_status in ('candidate', 'published', 'quarantined', 'retired', 'superseded'));

alter table external_catalogue_products
  add column source_full_image_url text,
  add column image_has_alpha boolean,
  add column image_treatment text,
  add column image_review_status text,
  add column image_review_scope text,
  add column image_reviewed_at timestamptz,
  add column image_reviewer text,
  add column image_processing_model text,
  add column image_processing_version text,
  add column image_processing_provider text,
  add column candidate_sha256 char(64),
  add column packshot_release_sha256 char(64);

alter table external_catalogue_products
  add constraint external_catalogue_published_packshot_check
  check (
    not is_published or (
      source_full_image_url is not null
      and image_has_alpha is true
      and image_treatment = 'source-faithful-background-extraction'
      and image_review_status = 'human-approved'
      and image_review_scope = 'product-identity-source-and-cutout'
      and image_reviewed_at is not null
      and length(trim(image_reviewer)) >= 2
      and image_processing_model is not null
      and image_processing_version is not null
      and image_processing_provider is not null
      and candidate_sha256 ~ '^[0-9a-f]{64}$'
      and packshot_release_sha256 ~ '^[0-9a-f]{64}$'
      and image_width = 1000
      and image_height = 1000
    )
  ) not valid;

create table external_catalogue_releases (
  release_sha256 char(64) primary key,
  selection_sha256 char(64) not null,
  candidate_manifest_sha256 char(64) not null,
  candidate_metadata_sha256 char(64) not null,
  audit_manifest_sha256 char(64) not null,
  source_snapshot_sha256 char(64) not null,
  product_count integer not null check (product_count = 977),
  review_status text not null check (review_status = 'human-approved'),
  review_scope text not null check (review_scope = 'product-identity-source-and-cutout'),
  reviewed_at timestamptz not null,
  reviewer text not null check (length(trim(reviewer)) >= 2),
  status text not null check (status in ('active', 'superseded')),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index external_catalogue_one_active_release_idx
  on external_catalogue_releases ((status))
  where status = 'active';

create index external_catalogue_products_release_idx
  on external_catalogue_products (packshot_release_sha256)
  where packshot_release_sha256 is not null;

commit;
