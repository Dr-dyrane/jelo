begin;

alter table offers
  add column if not exists match_kind text not null default 'exact';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'offers_match_kind_check'
  ) then
    alter table offers
      add constraint offers_match_kind_check
      check (match_kind in ('exact', 'search'));
  end if;
end
$$;

update offers
set match_kind = 'search'
where url ~* '(\?|&)s=|/search\?|/catalog/\?q=|/catalogsearch/|amazon\.com/s\?|walmart\.com/search\?';

commit;
