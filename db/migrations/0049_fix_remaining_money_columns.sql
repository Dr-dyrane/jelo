begin;

-- Complete the integer-to-numeric migration for remaining NGN money
-- columns that were missed in 0048. These columns store naira directly
-- (not minor units/kobo), so they must accept decimal values.

-- 1. commerce_events.price_ngn (store click price tracking)
alter table commerce_events
  alter column price_ngn type numeric(12,2) using price_ngn::numeric(12,2);

-- 2. community_observations.amount_ngn (community-reported prices)
alter table community_observations
  alter column amount_ngn type numeric(12,2) using amount_ngn::numeric(12,2);

commit;
