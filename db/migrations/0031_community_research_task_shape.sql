begin;

alter table moderation_audit_log
  drop constraint moderation_audit_log_action_check;
alter table moderation_audit_log
  add constraint moderation_audit_log_action_check check (action in (
    'claim', 'approve', 'reject', 'map', 'promote', 'reconcile', 'defer', 'retry', 'note'
  ));

alter table community_research_tasks
  add constraint community_research_tasks_shape_check check (
    (
      task_kind = 'product-identity'
      and entity_kind = 'product'
      and entity_source = 'custom'
      and entity_ref ~ '^custom:[^[:cntrl:]]+$'
    )
    or (
      task_kind = 'product-retail-refresh'
      and entity_kind = 'product'
      and entity_source = 'canonical'
      and entity_ref ~ '^product:[a-z0-9]+(-[a-z0-9]+)*$'
    )
    or (
      task_kind = 'retailer-identity'
      and entity_kind = 'retailer'
      and entity_source = 'custom'
      and entity_ref ~ '^custom:[^[:cntrl:]]+$'
    )
    or (
      task_kind = 'retailer-refresh'
      and entity_kind = 'retailer'
      and entity_source = 'canonical'
      and entity_ref ~ '^retailer:[a-z0-9]+(-[a-z0-9]+)*$'
    )
  );

commit;
