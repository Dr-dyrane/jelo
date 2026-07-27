begin;

-- Retailer review reads submitted applications oldest-first and continues with
-- an exact (submitted_at, id) keyset cursor.
create index if not exists retailer_partnership_queue_fifo_idx
  on retailer_partnership_applications (status, submitted_at asc, id asc)
  where submitted_at is not null;

commit;
