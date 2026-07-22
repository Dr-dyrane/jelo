begin;

alter table offers
  add column if not exists extraction_confidence smallint,
  add column if not exists extraction_evidence jsonb not null default '[]'::jsonb,
  add column if not exists extraction_adapter text,
  add column if not exists observed_title text,
  add column if not exists canonical_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'offers_extraction_confidence_check'
  ) then
    alter table offers
      add constraint offers_extraction_confidence_check
      check (extraction_confidence is null or extraction_confidence between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'offers_extraction_evidence_array_check'
  ) then
    alter table offers
      add constraint offers_extraction_evidence_array_check
      check (jsonb_typeof(extraction_evidence) = 'array');
  end if;
end
$$;

commit;
