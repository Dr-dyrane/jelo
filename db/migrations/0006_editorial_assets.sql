begin;

create table editorial_assets (
  id text primary key,
  role text not null,
  blob_url text not null unique,
  local_path text,
  alt_text text not null,
  mime_type text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size bigint not null check (byte_size >= 0),
  has_alpha boolean not null default false,
  source_kind text not null default 'generated' check (source_kind in ('generated', 'licensed', 'owned')),
  status asset_status not null default 'verified',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index editorial_assets_role_status_idx on editorial_assets (role, status);

commit;
