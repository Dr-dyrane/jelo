import 'server-only';

import type { Sql } from 'postgres';
import { z } from 'zod';
import type {
  AuthIdentity,
} from '@/lib/auth/subject';
import type {
  ModerationOperator,
  ModerationRole,
} from './access';

type TransactionCapableSql = Sql & {
  begin?: <T>(run: (tx: Sql) => Promise<T>) => Promise<T>;
};

export const operatorEmailSchema = z.string()
  .trim()
  .transform(value => value.toLocaleLowerCase('en-NG'))
  .pipe(z.email().max(254));

export const operatorRoleSchema = z.enum(['moderator', 'operator', 'admin']);
export type OperatorAccessTargetKind = 'operator' | 'invitation';
export type OperatorInvitationDelivery = 'sent' | 'failed' | 'not_configured';

export type OperatorInvitationRecord = {
  id: string;
  email: string;
  role: ModerationRole;
  expiresAt: string;
};

type OperatorAccessErrorCode =
  | 'not_admin'
  | 'existing_operator'
  | 'existing_invitation'
  | 'not_found'
  | 'no_change'
  | 'self_role_change'
  | 'self_deactivation'
  | 'last_active_admin'
  | 'delivery_cooldown';

export class OperatorAccessError extends Error {
  constructor(
    public readonly code: OperatorAccessErrorCode,
    public readonly targetId?: string,
  ) {
    super(code);
    this.name = 'OperatorAccessError';
  }
}

// The directory must remain readable while the access-lifecycle migration is
// rolling out. Mutations still fail closed until both tables exist.
export function isOperatorAccessLifecycleUnavailable(error: unknown): boolean {
  const databaseError = error as { code?: string; message?: string };
  if (databaseError.code !== '42P01') return false;
  return /moderation_operator_(?:invitations|access_audit)/i.test(
    databaseError.message ?? '',
  );
}

async function inTransaction<T>(sql: Sql, run: (tx: Sql) => Promise<T>): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  if (typeof begin !== 'function') {
    throw new Error('Transactional database access is required.');
  }
  return begin.call(sql, run) as Promise<T>;
}

function requireAdmin(actor: ModerationOperator) {
  if (actor.role !== 'admin') throw new OperatorAccessError('not_admin');
}

async function lockActiveAdmin(sql: Sql, actor: ModerationOperator) {
  const [activeAdmin] = await sql<{ id: string }[]>`
    select id
    from moderation_operators
    where id = ${actor.id}
      and auth_subject = ${actor.authSubject}
      and active = true
      and role = 'admin'
    limit 1
    for update
  `;
  if (!activeAdmin) throw new OperatorAccessError('not_admin');
}

async function lockOperatorEmail(sql: Sql, email: string) {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(${'operator-email:' + email}, 0)
    )
  `;
}

async function recordAccessEvent(
  sql: Sql,
  input: {
    actorSubject: string;
    targetKind: OperatorAccessTargetKind;
    targetRef: string;
    targetEmail: string | null;
    action: 'invite' | 'send' | 'accept' | 'change_role' | 'deactivate' | 'reactivate' | 'revoke';
    previousRole?: ModerationRole | null;
    nextRole?: ModerationRole | null;
    previousStatus?: 'pending' | 'active' | 'inactive' | 'accepted' | 'revoked' | null;
    nextStatus?: 'pending' | 'active' | 'inactive' | 'accepted' | 'revoked' | null;
    note?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  await sql`
    insert into moderation_operator_access_audit (
      actor_subject,
      target_kind,
      target_ref,
      target_email,
      action,
      previous_role,
      next_role,
      previous_status,
      next_status,
      note,
      metadata
    ) values (
      ${input.actorSubject},
      ${input.targetKind},
      ${input.targetRef},
      ${input.targetEmail},
      ${input.action},
      ${input.previousRole ?? null},
      ${input.nextRole ?? null},
      ${input.previousStatus ?? null},
      ${input.nextStatus ?? null},
      ${input.note ?? null},
      ${sql.json(input.metadata ?? {})}
    )
  `;
}

export async function createOperatorInvitation(
  sql: Sql,
  actor: ModerationOperator,
  rawEmail: string,
): Promise<OperatorInvitationRecord> {
  requireAdmin(actor);
  const email = operatorEmailSchema.parse(rawEmail);

  try {
    return await inTransaction(sql, async tx => {
      await lockActiveAdmin(tx, actor);
      await lockOperatorEmail(tx, email);
      const existingOperators = await tx<{ id: string }[]>`
        select id
        from moderation_operators
        where lower(email) = ${email}
        limit 1
        for update
      `;
      if (existingOperators.length > 0) {
        throw new OperatorAccessError('existing_operator');
      }

      const existingInvitations = await tx<{ id: string }[]>`
        select id
        from moderation_operator_invitations
        where lower(email) = ${email}
          and status = 'pending'
        limit 1
        for update
      `;
      if (existingInvitations.length > 0) {
        throw new OperatorAccessError(
          'existing_invitation',
          existingInvitations[0].id,
        );
      }

      const [invitation] = await tx<{
        id: string;
        email: string;
        role: ModerationRole;
        expires_at: string;
      }[]>`
        insert into moderation_operator_invitations (
          email,
          role,
          invited_by_subject
        ) values (
          ${email},
          'admin',
          ${actor.authSubject}
        )
        returning id, email, role, expires_at::text as expires_at
      `;

      await recordAccessEvent(tx, {
        actorSubject: actor.authSubject,
        targetKind: 'invitation',
        targetRef: invitation.id,
        targetEmail: invitation.email,
        action: 'invite',
        nextRole: invitation.role,
        nextStatus: 'pending',
      });

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      };
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      const [existingInvitation] = await sql<{ id: string }[]>`
        select id
        from moderation_operator_invitations
        where lower(email) = ${email}
          and status = 'pending'
        limit 1
      `;
      throw new OperatorAccessError(
        'existing_invitation',
        existingInvitation?.id,
      );
    }
    throw error;
  }
}

export async function reserveOperatorInvitationDelivery(
  sql: Sql,
  actor: ModerationOperator,
  invitationId: string,
): Promise<OperatorInvitationRecord> {
  requireAdmin(actor);

  return inTransaction(sql, async tx => {
    await lockActiveAdmin(tx, actor);
    const [invitation] = await tx<{
      id: string;
      email: string;
      role: ModerationRole;
      expires_at: string;
      last_sent_at: string | null;
      delivery_status: 'pending' | 'sent' | 'failed' | 'not_configured';
    }[]>`
      select id, email, role, expires_at::text as expires_at,
        last_sent_at::text as last_sent_at, delivery_status
      from moderation_operator_invitations
      where id = ${invitationId}
        and status = 'pending'
      limit 1
      for update
    `;
    if (!invitation) throw new OperatorAccessError('not_found');
    if (invitation.last_sent_at
      && invitation.delivery_status !== 'not_configured'
      && Date.now() - new Date(invitation.last_sent_at).getTime() < 60_000) {
      throw new OperatorAccessError('delivery_cooldown');
    }

    const [updated] = await tx<{ expires_at: string }[]>`
      update moderation_operator_invitations
      set
        delivery_status = 'pending',
        last_sent_at = now(),
        expires_at = now() + interval '7 days',
        updated_at = now()
      where id = ${invitation.id}
      returning expires_at::text as expires_at
    `;
    await recordAccessEvent(tx, {
      actorSubject: actor.authSubject,
      targetKind: 'invitation',
      targetRef: invitation.id,
      targetEmail: invitation.email,
      action: 'send',
      previousStatus: 'pending',
      nextStatus: 'pending',
      metadata: { outcome: 'attempted' },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: updated.expires_at,
    };
  });
}

export async function recordOperatorInvitationDelivery(
  sql: Sql,
  actor: ModerationOperator,
  invitationId: string,
  outcome: OperatorInvitationDelivery,
): Promise<void> {
  requireAdmin(actor);

  await inTransaction(sql, async tx => {
    await lockActiveAdmin(tx, actor);
    const [invitation] = await tx<{ id: string; email: string }[]>`
      update moderation_operator_invitations
      set
        delivery_status = ${outcome},
        last_sent_at = coalesce(last_sent_at, now()),
        updated_at = now()
      where id = ${invitationId}
        and status = 'pending'
      returning id, email
    `;
    if (!invitation) throw new OperatorAccessError('not_found');

    await recordAccessEvent(tx, {
      actorSubject: actor.authSubject,
      targetKind: 'invitation',
      targetRef: invitation.id,
      targetEmail: invitation.email,
      action: 'send',
      previousStatus: 'pending',
      nextStatus: 'pending',
      metadata: { outcome },
    });
  });
}

export async function changeOperatorRole(
  sql: Sql,
  actor: ModerationOperator,
  targetKind: OperatorAccessTargetKind,
  targetId: string,
  nextRole: ModerationRole,
): Promise<void> {
  requireAdmin(actor);
  operatorRoleSchema.parse(nextRole);

  await inTransaction(sql, async tx => {
    await lockActiveAdmin(tx, actor);
    if (targetKind === 'invitation') {
      const [invitation] = await tx<{
        id: string;
        email: string;
        role: ModerationRole;
      }[]>`
        select id, email, role
        from moderation_operator_invitations
        where id = ${targetId}
          and status = 'pending'
        limit 1
        for update
      `;
      if (!invitation) throw new OperatorAccessError('not_found');
      if (invitation.role === nextRole) throw new OperatorAccessError('no_change');

      await tx`
        update moderation_operator_invitations
        set role = ${nextRole}, updated_at = now()
        where id = ${invitation.id}
      `;
      await recordAccessEvent(tx, {
        actorSubject: actor.authSubject,
        targetKind,
        targetRef: invitation.id,
        targetEmail: invitation.email,
        action: 'change_role',
        previousRole: invitation.role,
        nextRole,
        previousStatus: 'pending',
        nextStatus: 'pending',
      });
      return;
    }

    const [target] = await tx<{
      id: string;
      email: string | null;
      role: ModerationRole;
      active: boolean;
    }[]>`
      select id, email, role, active
      from moderation_operators
      where id = ${targetId}
      limit 1
      for update
    `;
    if (!target) throw new OperatorAccessError('not_found');
    if (target.role === nextRole) throw new OperatorAccessError('no_change');
    if (target.id === actor.id) throw new OperatorAccessError('self_role_change');

    if (target.active && target.role === 'admin' && nextRole !== 'admin') {
      const admins = await tx<{ id: string }[]>`
        select id
        from moderation_operators
        where active = true and role = 'admin'
        for update
      `;
      if (admins.length <= 1) throw new OperatorAccessError('last_active_admin');
    }

    await tx`
      update moderation_operators
      set role = ${nextRole}, updated_at = now()
      where id = ${target.id}
    `;
    await recordAccessEvent(tx, {
      actorSubject: actor.authSubject,
      targetKind,
      targetRef: target.id,
      targetEmail: target.email,
      action: 'change_role',
      previousRole: target.role,
      nextRole,
      previousStatus: target.active ? 'active' : 'inactive',
      nextStatus: target.active ? 'active' : 'inactive',
    });
  });
}

export async function setOperatorActive(
  sql: Sql,
  actor: ModerationOperator,
  targetId: string,
  nextActive: boolean,
): Promise<void> {
  requireAdmin(actor);

  await inTransaction(sql, async tx => {
    await lockActiveAdmin(tx, actor);
    const [target] = await tx<{
      id: string;
      email: string | null;
      role: ModerationRole;
      active: boolean;
    }[]>`
      select id, email, role, active
      from moderation_operators
      where id = ${targetId}
      limit 1
      for update
    `;
    if (!target) throw new OperatorAccessError('not_found');
    if (target.active === nextActive) throw new OperatorAccessError('no_change');
    if (!nextActive && target.id === actor.id) {
      throw new OperatorAccessError('self_deactivation');
    }

    if (!nextActive && target.role === 'admin') {
      const admins = await tx<{ id: string }[]>`
        select id
        from moderation_operators
        where active = true and role = 'admin'
        for update
      `;
      if (admins.length <= 1) throw new OperatorAccessError('last_active_admin');
    }

    await tx`
      update moderation_operators
      set active = ${nextActive}, updated_at = now()
      where id = ${target.id}
    `;
    await recordAccessEvent(tx, {
      actorSubject: actor.authSubject,
      targetKind: 'operator',
      targetRef: target.id,
      targetEmail: target.email,
      action: nextActive ? 'reactivate' : 'deactivate',
      previousRole: target.role,
      nextRole: target.role,
      previousStatus: target.active ? 'active' : 'inactive',
      nextStatus: nextActive ? 'active' : 'inactive',
    });
  });
}

export async function revokeOperatorInvitation(
  sql: Sql,
  actor: ModerationOperator,
  invitationId: string,
): Promise<void> {
  requireAdmin(actor);

  await inTransaction(sql, async tx => {
    await lockActiveAdmin(tx, actor);
    const [invitation] = await tx<{
      id: string;
      email: string;
      role: ModerationRole;
    }[]>`
      update moderation_operator_invitations
      set
        status = 'revoked',
        revoked_at = now(),
        updated_at = now()
      where id = ${invitationId}
        and status = 'pending'
      returning id, email, role
    `;
    if (!invitation) throw new OperatorAccessError('not_found');

    await recordAccessEvent(tx, {
      actorSubject: actor.authSubject,
      targetKind: 'invitation',
      targetRef: invitation.id,
      targetEmail: invitation.email,
      action: 'revoke',
      previousRole: invitation.role,
      nextRole: invitation.role,
      previousStatus: 'pending',
      nextStatus: 'revoked',
    });
  });
}

export async function claimPendingOperatorInvitation(
  sql: Sql,
  identity: AuthIdentity,
): Promise<ModerationOperator | null> {
  if (!identity.email || !identity.emailVerified) return null;
  const parsedEmail = operatorEmailSchema.safeParse(identity.email);
  if (!parsedEmail.success) return null;
  const email = parsedEmail.data;

  return inTransaction(sql, async tx => {
    await lockOperatorEmail(tx, email);
    const [invitation] = await tx<{
      id: string;
      email: string;
      role: ModerationRole;
    }[]>`
      select id, email, role
      from moderation_operator_invitations
      where lower(email) = ${email}
        and status = 'pending'
        and expires_at > now()
      order by invited_at desc
      limit 1
      for update
    `;
    if (!invitation) return null;

    const existing = await tx<{ id: string }[]>`
      select id
      from moderation_operators
      where auth_subject = ${identity.subject}
         or lower(email) = ${email}
      limit 1
      for update
    `;
    if (existing.length > 0) return null;

    const [operator] = await tx<{ id: string }[]>`
      insert into moderation_operators (
        auth_subject,
        email,
        role,
        active
      ) values (
        ${identity.subject},
        ${email},
        ${invitation.role},
        true
      )
      returning id
    `;

    await tx`
      update moderation_operator_invitations
      set
        status = 'accepted',
        accepted_operator_id = ${operator.id},
        accepted_at = now(),
        updated_at = now()
      where id = ${invitation.id}
    `;
    await recordAccessEvent(tx, {
      actorSubject: identity.subject,
      targetKind: 'invitation',
      targetRef: invitation.id,
      targetEmail: email,
      action: 'accept',
      previousRole: invitation.role,
      nextRole: invitation.role,
      previousStatus: 'pending',
      nextStatus: 'accepted',
      metadata: { operatorId: operator.id },
    });

    return {
      id: operator.id,
      authSubject: identity.subject,
      role: invitation.role,
    };
  });
}
