begin;

-- Contract only after the dual-compatible application revision is live.
-- Re-clean rows written by an in-flight legacy request before removing the
-- tombstone representation and its UPDATE authority.
lock table public.customer_concerns in access exclusive mode;

delete from public.customer_concerns
where removed_at is not null;

drop index public.customer_concerns_owner_slug_active_idx;

alter table public.customer_concerns
  drop constraint customer_concerns_owner_subject_concern_slug_removed_at_key,
  drop column removed_at,
  add constraint customer_concerns_owner_slug_key
    unique (owner_subject, concern_slug);

revoke update on table public.customer_concerns from jelocare_shelf_runtime;

commit;
