begin;

-- Cookieless behavioural events (ADR 0005, second half). store_click is the
-- highest-signal event: it answers "which store, and cheap vs pricey" from the
-- same market summary the product page shows. Measurement only -- never an input
-- to store ranking, guidance, or safety (ADR 0006). No name, account, address,
-- raw network identifier, or query text is stored, by construction.
create table commerce_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('store_click')),
  product_slug text not null check (char_length(product_slug) between 1 and 160),
  retailer text not null check (char_length(retailer) between 1 and 160),
  market text not null check (market in ('NG', 'US')),
  price_ngn integer check (price_ngn is null or price_ngn between 0 and 100000000),
  price_rank text not null check (price_rank in ('lowest', 'median', 'higher', 'only', 'marketplace')),
  position smallint not null check (position between 1 and 200),
  freshness_days smallint check (freshness_days is null or freshness_days between 0 and 3650),
  created_at timestamptz not null default now()
);

create index commerce_events_store_click_idx
  on commerce_events (event_type, product_slug, created_at);

commit;
