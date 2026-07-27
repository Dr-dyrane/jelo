begin;

-- Insights reads the immutable ledger across every queue. Queue-scoped indexes
-- cannot serve that global newest-first order.
create index if not exists moderation_audit_log_created_id_idx
  on moderation_audit_log (created_at desc, id desc);

commit;
