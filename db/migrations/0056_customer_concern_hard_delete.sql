begin;

-- Expand the Concern write contract before the hard-delete application cutover.
-- The legacy UPDATE path remains valid until the bridge application is live;
-- migration 0058 performs the schema and privilege contraction.
lock table public.customer_concerns in access exclusive mode;

delete from public.customer_concerns
where removed_at is not null;

grant delete on table public.customer_concerns to jelocare_shelf_runtime;

commit;
