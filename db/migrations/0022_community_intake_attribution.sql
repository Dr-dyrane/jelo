begin;

-- First-touch campaign context for anonymous intake. These fields are bounded,
-- self-reported analytics labels. They are never identity, evidence, or trust.
create table community_intake_attributions (
  draft_id uuid primary key references community_intake_drafts(id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  source text not null check (source ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  medium text check (medium is null or medium ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  campaign text check (campaign is null or campaign ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  content text check (content is null or content ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  landing_path text not null check (
    char_length(landing_path) between 1 and 120
    and landing_path ~ '^/contribute(?:/[a-z0-9/_-]*)?$'
  ),
  captured_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '24 months'),
  check (retain_until > captured_at)
);

create index community_intake_attributions_campaign_idx
  on community_intake_attributions (source, campaign, captured_at desc);

commit;
