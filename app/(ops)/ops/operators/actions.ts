'use server';

import type { Sql } from 'postgres';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getPostgresClient } from '@/lib/db/postgres';
import {
  hasTransactionalEmailConfig,
  sendOperatorInvitation,
} from '@/lib/email/mailer';
import type { ModerationOperator } from '@/lib/moderation/access';
import { assertCan } from '@/lib/moderation/capabilities';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { operatorSignInUrl } from '@/lib/auth/operator-sign-in-url';
import {
  changeOperatorRole,
  createOperatorInvitation,
  OperatorAccessError,
  isOperatorAccessLifecycleUnavailable,
  operatorEmailSchema,
  operatorRoleSchema,
  recordOperatorInvitationDelivery,
  reserveOperatorInvitationDelivery,
  revokeOperatorInvitation,
  setOperatorActive,
  type OperatorInvitationRecord,
} from '@/lib/moderation/operator-access';

export type OperatorActionState = {
  ok: boolean;
  targetId?: string;
  message?: string;
  error?: string;
  tone?: 'success' | 'notice' | 'warning';
};

const inviteInput = z.object({
  email: operatorEmailSchema,
});

const mutationInput = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change_role'),
    targetKind: z.enum(['operator', 'invitation']),
    targetId: z.uuid(),
    role: operatorRoleSchema,
  }),
  z.object({
    action: z.enum(['deactivate', 'reactivate']),
    targetKind: z.literal('operator'),
    targetId: z.uuid(),
  }),
  z.object({
    action: z.enum(['revoke', 'resend']),
    targetKind: z.literal('invitation'),
    targetId: z.uuid(),
  }),
]);

function accessError(
  error: unknown,
  invalidInput = 'That access record is not valid.',
): string {
  if (error instanceof z.ZodError) return invalidInput;
  if (isOperatorAccessLifecycleUnavailable(error)) {
    return 'Access updates aren’t ready yet.';
  }
  if (!(error instanceof OperatorAccessError)) return 'That change could not be saved. Try again.';

  switch (error.code) {
    case 'not_admin':
      return 'Only an admin can change team access.';
    case 'existing_operator':
      return 'That email already belongs to the team.';
    case 'existing_invitation':
      return 'An invitation is already waiting for that email.';
    case 'not_found':
      return 'That access record is no longer available.';
    case 'no_change':
      return 'Nothing changed.';
    case 'self_role_change':
      return 'Ask another admin to change your role.';
    case 'self_deactivation':
      return 'Ask another admin to pause your access.';
    case 'last_active_admin':
      return 'Keep at least one active admin.';
    case 'delivery_cooldown':
      return 'That invitation was just sent. Try again in a minute.';
  }
}

async function deliverInvitation(
  sql: Sql,
  actor: ModerationOperator,
  invitation: OperatorInvitationRecord,
  mode: 'first' | 'again',
): Promise<OperatorActionState> {
  let outcome: 'sent' | 'failed' | 'not_configured' = 'not_configured';

  if (hasTransactionalEmailConfig()) {
    try {
      await sendOperatorInvitation({
        to: invitation.email,
        signInLink: operatorSignInUrl(),
      });
      outcome = 'sent';
    } catch (error) {
      outcome = 'failed';
      console.error(
        'Operator invitation delivery failed.',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }

  try {
    await recordOperatorInvitationDelivery(sql, actor, invitation.id, outcome);
  } catch (error) {
    console.error(
      'Operator invitation delivery status could not be recorded.',
      error instanceof Error ? error.message : 'unknown',
    );
    return {
      ok: true,
      targetId: invitation.id,
      tone: outcome === 'sent'
        ? 'success'
        : outcome === 'failed'
          ? 'warning'
          : 'notice',
      message: outcome === 'sent'
        ? 'Invitation sent. Its status may take a moment to update.'
        : outcome === 'failed'
          ? 'Invitation saved. Email didn’t send. Try again.'
          : 'Invitation saved. Share the sign-in link for now.',
    };
  }

  return {
    ok: true,
    targetId: invitation.id,
    tone: outcome === 'sent'
      ? 'success'
      : outcome === 'failed'
        ? 'warning'
        : 'notice',
    message: outcome === 'sent'
      ? mode === 'first' ? 'Invitation sent.' : 'Invitation sent again.'
      : outcome === 'failed'
        ? 'Invitation saved. Email didn’t send. Try again.'
        : 'Invitation saved. Share the sign-in link for now.',
  };
}

export async function inviteOperatorAction(
  _previousState: OperatorActionState | null,
  formData: FormData,
): Promise<OperatorActionState> {
  try {
    const actor = await requireConsoleOperator();
    assertCan(actor, 'operators.manage');
    const input = inviteInput.parse({ email: formData.get('email') });
    const sql = getPostgresClient();
    const invitation = await createOperatorInvitation(
      sql,
      actor,
      input.email,
    );
    const result = await deliverInvitation(sql, actor, invitation, 'first');
    revalidatePath('/ops/operators');
    return result;
  } catch (error) {
    if (
      error instanceof OperatorAccessError
      && error.code === 'existing_invitation'
      && error.targetId
    ) {
      return {
        ok: true,
        targetId: error.targetId,
        tone: 'notice',
        message: 'Invitation already saved. Open it to send again.',
      };
    }
    return {
      ok: false,
      error: accessError(error, 'Enter a valid email address.'),
    };
  }
}

export async function mutateOperatorAccessAction(
  _previousState: OperatorActionState | null,
  formData: FormData,
): Promise<OperatorActionState> {
  const targetId = String(formData.get('targetId') ?? '');
  try {
    const actor = await requireConsoleOperator();
    assertCan(actor, 'operators.manage');
    const input = mutationInput.parse({
      action: formData.get('action'),
      targetKind: formData.get('targetKind'),
      targetId,
      role: formData.get('role') || undefined,
    });
    const sql = getPostgresClient();

    if (input.action === 'change_role') {
      await changeOperatorRole(
        sql,
        actor,
        input.targetKind,
        input.targetId,
        input.role,
      );
    } else if (input.action === 'deactivate' || input.action === 'reactivate') {
      await setOperatorActive(
        sql,
        actor,
        input.targetId,
        input.action === 'reactivate',
      );
    } else if (input.action === 'revoke') {
      await revokeOperatorInvitation(sql, actor, input.targetId);
    } else {
      const invitation = await reserveOperatorInvitationDelivery(
        sql,
        actor,
        input.targetId,
      );
      const result = await deliverInvitation(sql, actor, invitation, 'again');
      revalidatePath('/ops/operators');
      return result;
    }

    revalidatePath('/ops/operators');
    return {
      ok: true,
      targetId: input.targetId,
      tone: 'success',
      message: input.action === 'change_role'
        ? 'Role updated.'
        : input.action === 'deactivate'
          ? 'Access paused.'
          : input.action === 'reactivate'
            ? 'Access restored.'
            : 'Invitation revoked.',
    };
  } catch (error) {
    return {
      ok: false,
      targetId: targetId || undefined,
      error: accessError(error),
    };
  }
}
