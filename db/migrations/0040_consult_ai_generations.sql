begin;

create table consult_ai_generations (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique
    check (public_reference ~ '^JAI-[A-Z0-9]{12}$'),
  lane text not null check (lane = 'intake_shadow'),
  schema_version integer not null check (schema_version > 0),
  model_id text not null check (nullif(trim(model_id), '') is not null),
  input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
  input_character_count integer not null check (input_character_count between 5 and 1800),
  deterministic_outcome text not null check (deterministic_outcome in (
    'ordinary_care', 'clarification', 'condition_guide'
  )),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  output jsonb check (output is null or jsonb_typeof(output) = 'object'),
  usage jsonb check (usage is null or jsonb_typeof(usage) = 'object'),
  gateway_generation_id text
    check (gateway_generation_id is null or gateway_generation_id ~ '^gen_[A-Za-z0-9]+$'),
  provider_name text,
  finish_reason text,
  cost_usd numeric(14, 8) check (cost_usd is null or cost_usd >= 0),
  cost_source text check (cost_source is null or cost_source in ('gateway_exact', 'unavailable')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  retain_until timestamptz not null default (now() + interval '30 days'),
  constraint consult_ai_generations_settlement_check check (
    (status = 'pending' and completed_at is null and output is null and error_code is null)
    or (status = 'completed' and completed_at is not null and output is not null and error_code is null)
    or (status = 'failed' and completed_at is not null and output is null and nullif(trim(error_code), '') is not null)
  )
);

create index consult_ai_generations_created_idx
  on consult_ai_generations (created_at desc, id);
create index consult_ai_generations_status_idx
  on consult_ai_generations (status, created_at, id)
  where status <> 'completed';
create index consult_ai_generations_retention_idx
  on consult_ai_generations (retain_until, id);

comment on column consult_ai_generations.input_sha256 is
  'One-way digest of the bounded customer text. Raw health text is deliberately not retained.';
comment on column consult_ai_generations.output is
  'Strict non-clinical intake proposal. It is never the customer-visible care authority.';

revoke all privileges on table consult_ai_generations from public;
revoke all privileges on table consult_ai_generations from jelocare_app_runtime;
grant select, insert, update on table consult_ai_generations to jelocare_app_runtime;
revoke delete on table consult_ai_generations from jelocare_app_runtime;

commit;
