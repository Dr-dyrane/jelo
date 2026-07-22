begin;

alter table offers
  add column if not exists observed_size text;

commit;
