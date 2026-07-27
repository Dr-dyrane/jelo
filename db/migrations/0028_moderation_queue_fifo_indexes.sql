begin;

-- Relationship and observation review both read pending rows oldest-first and
-- continue with the exact (created_at, id) queue identity.
create index if not exists community_knowledge_edges_queue_fifo_idx
  on community_knowledge_edges (moderation_status, created_at asc, id asc)
  where moderation_status = 'pending';

create index if not exists community_observations_queue_fifo_idx
  on community_observations (moderation_status, created_at asc, id asc)
  where moderation_status = 'pending';

commit;
