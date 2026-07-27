import 'server-only';

import type { Sql } from 'postgres';
import type { ModerationRole } from './access';
import type { ModerationAction } from './schema';
import { isOperatorAccessLifecycleUnavailable } from './operator-access';

const uuidPattern =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

export type ConsoleOperatorActivity = {
  id: string;
  queue: ModerationAction['queue'];
  action: ModerationAction['action'];
  targetLabel: string;
  createdAt: string;
};

export type ConsoleAccessActivity = {
  id: string;
  action:
    | 'invite'
    | 'send'
    | 'accept'
    | 'change_role'
    | 'deactivate'
    | 'reactivate'
    | 'revoke';
  outcome: 'attempted' | 'sent' | 'failed' | 'not_configured' | null;
  createdAt: string;
};

export type ConsoleOperatorRecord = {
  id: string;
  kind: 'operator' | 'invitation';
  status: 'active' | 'inactive' | 'pending' | 'expired' | 'revoked';
  displayName: string | null;
  email: string | null;
  role: ModerationRole;
  active: boolean;
  decisionsToday: number;
  decisionsLast7Days: number;
  decisionsTotal: number;
  lastActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'not_configured' | null;
  expiresAt: string | null;
  lastSentAt: string | null;
  invitedByName: string | null;
  recentActivity: ConsoleOperatorActivity[];
  recentAccessActivity: ConsoleAccessActivity[];
};

export type ConsoleOperatorDirectory = {
  rows: ConsoleOperatorRecord[];
  accessLifecycleReady: boolean;
};

type ConsoleInvitationRow = {
  id: string;
  email: string;
  role: ModerationRole;
  status: 'pending' | 'expired' | 'revoked';
  delivery_status: 'pending' | 'sent' | 'failed' | 'not_configured';
  invited_by_name: string;
  invited_at: string;
  expires_at: string;
  last_sent_at: string | null;
  updated_at: string;
};

type ConsoleAccessRow = {
  id: string;
  target_kind: 'operator' | 'invitation';
  target_ref: string;
  action: ConsoleAccessActivity['action'];
  outcome: ConsoleAccessActivity['outcome'];
  created_at: string;
};

function accessActivityFor(
  rows: ConsoleAccessRow[],
  targetKind: ConsoleAccessRow['target_kind'],
  targetRef: string,
): ConsoleAccessActivity[] {
  const matching = rows.filter(
    activity => activity.target_kind === targetKind && activity.target_ref === targetRef,
  );

  return matching
    .filter((activity, index) => !(
      activity.action === 'send'
      && activity.outcome === 'attempted'
      && matching.slice(0, index).some(later => (
        later.action === 'send'
        && later.outcome != null
        && later.outcome !== 'attempted'
      ))
    ))
    .map(activity => ({
      id: activity.id,
      action: activity.action,
      outcome: activity.outcome,
      createdAt: activity.created_at,
    }));
}

export async function listConsoleOperators(sql: Sql): Promise<ConsoleOperatorDirectory> {
  const [rows, recentRows] = await Promise.all([
    sql<{
      id: string;
      display_name: string | null;
      email: string | null;
      role: ModerationRole;
      active: boolean;
      decisions_today: number;
      decisions_last_7_days: number;
      decisions_total: number;
      last_action_at: string | null;
      created_at: string;
      updated_at: string;
    }[]>`
      select
        operator.id,
        operator.display_name,
        operator.email,
        operator.role,
        operator.active,
        count(audit.id) filter (
          where audit.created_at >= date_trunc('day', now())
        )::int as decisions_today,
        count(audit.id) filter (
          where audit.created_at >= now() - interval '7 days'
        )::int as decisions_last_7_days,
        count(audit.id)::int as decisions_total,
        max(audit.created_at)::text as last_action_at,
        operator.created_at::text as created_at,
        operator.updated_at::text as updated_at
      from moderation_operators as operator
      left join moderation_audit_log as audit
        on audit.operator_subject = operator.auth_subject
      group by operator.id
      order by
        operator.active desc,
        operator.display_name asc nulls last,
        operator.email asc nulls last
    `,
    sql<{
      id: string;
      operator_id: string;
      queue: ModerationAction['queue'];
      action: ModerationAction['action'];
      target_label: string;
      created_at: string;
    }[]>`
      with recent as (
        select
          audit.id,
          operator.id as operator_id,
          audit.queue,
          audit.action,
          audit.target_ref,
          audit.created_at,
          row_number() over (
            partition by operator.id
            order by audit.created_at desc, audit.id desc
          ) as operator_rank
        from moderation_audit_log audit
        join moderation_operators operator
          on operator.auth_subject = audit.operator_subject
      )
      select
        recent.id,
        recent.operator_id,
        recent.queue,
        recent.action,
        coalesce(
          case
            when recent.queue = 'community_contribution'
              and recent.target_ref ~* ${uuidPattern} then (
                select coalesce(
                  contribution.payload -> 'products' -> 0 ->> 'label',
                  contribution.payload -> 'brands' -> 0 ->> 'label',
                  initcap(contribution.contribution_kind::text) || ' note'
                )
                from community_contributions contribution
                where contribution.id = recent.target_ref::uuid
              )
            when recent.queue = 'community_observation'
              and recent.target_ref ~* ${uuidPattern} then (
                select coalesce(
                  contribution.payload -> 'products' -> 0 ->> 'label',
                  observation.subject_ref
                )
                from community_observations observation
                join community_contributions contribution
                  on contribution.id = observation.contribution_id
                where observation.id = recent.target_ref::uuid
              )
            when recent.queue = 'community_edge'
              and recent.target_ref ~* ${uuidPattern} then (
                select coalesce(
                  contribution.payload -> 'products' -> 0 ->> 'label',
                  edge.subject_ref
                )
                from community_knowledge_edges edge
                join community_contributions contribution
                  on contribution.id = edge.contribution_id
                where edge.id = recent.target_ref::uuid
              )
            when recent.queue = 'community_moderation_value'
              and recent.target_ref ~* ${uuidPattern} then (
                select value.raw_value
                from community_moderation_values value
                where value.id = recent.target_ref::uuid
              )
            when recent.queue = 'community_research_task'
              and recent.target_ref ~* ${uuidPattern} then (
                select task.entity_label
                from community_research_tasks task
                where task.id = recent.target_ref::uuid
              )
            when recent.queue = 'retailer_application'
              and recent.target_ref ~* ${uuidPattern} then (
                select application.store_name
                from retailer_partnership_applications application
                where application.id = recent.target_ref::uuid
              )
            else null
          end,
          'Recorded work'
        ) as target_label,
        recent.created_at::text as created_at
      from recent
      where recent.operator_rank <= 8
      order by recent.created_at desc, recent.id desc
    `,
  ]);

  let invitations: ConsoleInvitationRow[] = [];
  let accessRows: ConsoleAccessRow[] = [];
  let accessLifecycleReady = true;

  try {
    [invitations, accessRows] = await Promise.all([
    sql<ConsoleInvitationRow[]>`
      select
        invitation.id,
        invitation.email,
        invitation.role,
        case
          when invitation.status = 'pending' and invitation.expires_at <= now()
            then 'expired'
          else invitation.status
        end as status,
        invitation.delivery_status,
        coalesce(inviter.display_name, inviter.email, 'JeloCare admin') as invited_by_name,
        invitation.invited_at::text as invited_at,
        invitation.expires_at::text as expires_at,
        invitation.last_sent_at::text as last_sent_at,
        invitation.updated_at::text as updated_at
      from moderation_operator_invitations invitation
      left join moderation_operators inviter
        on inviter.auth_subject = invitation.invited_by_subject
      where invitation.status in ('pending', 'revoked')
      order by
        case when invitation.status = 'pending' then 0 else 1 end,
        invitation.invited_at desc
      limit 50
    `,
    sql<ConsoleAccessRow[]>`
      with ranked as (
        select
          audit.id,
          audit.target_kind,
          audit.target_ref,
          audit.action,
          audit.metadata,
          audit.created_at,
          row_number() over (
            partition by audit.target_kind, audit.target_ref
            order by audit.created_at desc, audit.id desc
          ) as target_rank
        from moderation_operator_access_audit audit
      )
      select
        id,
        target_kind,
        target_ref::text as target_ref,
        action,
        case
          when metadata ->> 'outcome' in ('attempted', 'sent', 'failed', 'not_configured')
            then metadata ->> 'outcome'
          else null
        end as outcome,
        created_at::text as created_at
      from ranked
      where target_rank <= 8
      order by created_at desc, id desc
    `,
    ]);
  } catch (error) {
    if (!isOperatorAccessLifecycleUnavailable(error)) throw error;
    accessLifecycleReady = false;
  }

  const operatorRecords: ConsoleOperatorRecord[] = rows.map(row => ({
    id: row.id,
    kind: 'operator',
    status: row.active ? 'active' : 'inactive',
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    active: row.active,
    decisionsToday: row.decisions_today,
    decisionsLast7Days: row.decisions_last_7_days,
    decisionsTotal: row.decisions_total,
    lastActionAt: row.last_action_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveryStatus: null,
    expiresAt: null,
    lastSentAt: null,
    invitedByName: null,
    recentActivity: recentRows
      .filter(activity => activity.operator_id === row.id)
      .map(activity => ({
        id: activity.id,
        queue: activity.queue,
        action: activity.action,
        targetLabel: activity.target_label,
        createdAt: activity.created_at,
      })),
    recentAccessActivity: accessActivityFor(accessRows, 'operator', row.id),
  }));

  const invitationRecords: ConsoleOperatorRecord[] = invitations.map(invitation => ({
    id: invitation.id,
    kind: 'invitation',
    status: invitation.status,
    displayName: null,
    email: invitation.email,
    role: invitation.role,
    active: false,
    decisionsToday: 0,
    decisionsLast7Days: 0,
    decisionsTotal: 0,
    lastActionAt: null,
    createdAt: invitation.invited_at,
    updatedAt: invitation.updated_at,
    deliveryStatus: invitation.delivery_status,
    expiresAt: invitation.expires_at,
    lastSentAt: invitation.last_sent_at,
    invitedByName: invitation.invited_by_name,
    recentActivity: [],
    recentAccessActivity: accessActivityFor(accessRows, 'invitation', invitation.id),
  }));

  return {
    accessLifecycleReady,
    rows: [
      ...operatorRecords.filter(record => record.status === 'active'),
      ...invitationRecords.filter(record => record.status === 'pending' || record.status === 'expired'),
      ...operatorRecords.filter(record => record.status === 'inactive'),
      ...invitationRecords.filter(record => record.status === 'revoked'),
    ],
  };
}
