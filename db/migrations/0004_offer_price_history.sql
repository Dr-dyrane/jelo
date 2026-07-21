begin;

create table offer_price_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  price_minor bigint not null check (price_minor >= 0),
  currency_code char(3) not null,
  observed_at timestamptz not null default now(),
  source verification_method not null default 'retailer_page',
  created_at timestamptz not null default now()
);

create index offer_price_history_offer_observed_idx
  on offer_price_history (offer_id, observed_at desc);

create unique index offer_price_history_dedupe_idx
  on offer_price_history (offer_id, price_minor, currency_code, observed_at);

insert into offer_price_history (offer_id, price_minor, currency_code, observed_at, source)
select
  id,
  price_minor,
  currency_code,
  coalesce(last_verified_at, checked_at, updated_at, created_at),
  verification_method
from offers
where price_minor is not null
  and currency_code is not null;

commit;
