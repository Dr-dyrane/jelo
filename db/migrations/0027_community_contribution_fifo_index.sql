begin;

-- Contribution review reads pending submissions oldest-first and continues
-- with the exact (submitted_at, id) queue identity.
create index if not exists community_contributions_queue_fifo_idx
  on community_contributions (moderation_status, submitted_at asc, id asc)
  where moderation_status = 'pending';

commit;
