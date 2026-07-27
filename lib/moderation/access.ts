import 'server-only';

import type { Sql } from 'postgres';
import { getAuthSubject } from '@/lib/auth/subject';
import {
  claimPendingOperatorInvitation,
  isOperatorAccessLifecycleUnavailable,
} from './operator-access';

export type ModerationRole = 'moderator' | 'operator' | 'admin';

export type ModerationOperator = {
  id: string;
  authSubject: string;
  role: ModerationRole;
};

export class ModerationAccessError extends Error {
  constructor() {
    super('Operator access denied.');
    this.name = 'ModerationAccessError';
  }
}

// The authenticated operator's stable subject from the verified Neon Auth session,
// or null. Identity comes only from getAuthSubject() (the session cookie the SDK
// verifies) — never a request header, query parameter, or any other cookie. Unknown
// or deactivated subjects are still denied downstream by the active = true allowlist,
// and an unconfigured environment returns null, preserving deny-by-default.
export async function operatorAuthSubject(): Promise<string | null> {
  const identity = await getAuthSubject();
  return identity?.subject ?? null;
}

// Looks up an active operator by auth subject. Returns null for an unknown or
// deactivated subject, so authorization is an explicit allowlist with default deny.
export async function resolveActiveOperator(sql: Sql, authSubject: string | null): Promise<ModerationOperator | null> {
  if (!authSubject) {
    console.log('[Console Access]: No authSubject found in verified session.');
    return null;
  }
  const [row] = await sql<{ id: string; auth_subject: string; role: ModerationRole }[]>`
    select id, auth_subject, role
    from moderation_operators
    where auth_subject = ${authSubject} and active = true
  `;
  if (!row) {
    console.log(`[Console Access]: Subject "${authSubject}" is not in moderation_operators allowlist.`);
    return null;
  }
  return { id: row.id, authSubject: row.auth_subject, role: row.role };
}

export async function currentOperator(sql: Sql): Promise<ModerationOperator | null> {
  const identity = await getAuthSubject();
  const existing = await resolveActiveOperator(sql, identity?.subject ?? null);
  if (existing || !identity) return existing;

  // A pending invitation is only claimed after Neon Auth has verified the exact
  // mailbox and supplied its stable subject. The invitation itself never grants a
  // session and an unverified email can never enter this path.
  try {
    const claimed = await claimPendingOperatorInvitation(sql, identity);
    if (claimed) return claimed;
    // A concurrent request may have accepted the same invitation while this
    // request waited on the normalized-email lock.
    return resolveActiveOperator(sql, identity.subject);
  } catch (error) {
    if (isOperatorAccessLifecycleUnavailable(error)) return null;
    throw error;
  }
}

// Gate for every console entry point. Throws unless the request carries a verified,
// allowlisted, active operator. Callers translate the error into a 404/403 and must
// not expose any moderation data before this resolves.
export async function requireOperator(sql: Sql): Promise<ModerationOperator> {
  const operator = await currentOperator(sql);
  if (!operator) throw new ModerationAccessError();
  return operator;
}
