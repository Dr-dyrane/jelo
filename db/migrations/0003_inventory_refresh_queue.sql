begin;

create type inventory_refresh_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');

create table inventory_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  status inventory_refresh_status not null default 'queued',
  priority smallint not null default 100,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_refresh_jobs_active_offer_idx
  on inventory_refresh_jobs (offer_id)
  where status in ('queued', 'processing');

create index inventory_refresh_jobs_dispatch_idx
  on inventory_refresh_jobs (status, next_attempt_at, priority, requested_at);

commit;
