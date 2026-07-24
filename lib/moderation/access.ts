import 'server-only';

import type { Sql } from 'postgres';

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

// The authenticated operator's stable subject from the Neon Auth session, or null.
// Neon Auth is provisioned but not yet wired (ADR 0007); until it is, this returns
// null so every console access is denied by default. Identity must only ever come
// from the verified Neon Auth session — never from a request header, query
// parameter, or any cookie other than that session.
export async function operatorAuthSubject(): Promise<string | null> {
  return null;
}

// Looks up an active operator by auth subject. Returns null for an unknown or
// deactivated subject, so authorization is an explicit allowlist with default deny.
export async function resolveActiveOperator(sql: Sql, authSubject: string | null): Promise<ModerationOperator | null> {
  if (!authSubject) return null;
  const [row] = await sql<{ id: string; auth_subject: string; role: ModerationRole }[]>`
    select id, auth_subject, role
    from moderation_operators
    where auth_subject = ${authSubject} and active = true
  `;
  return row ? { id: row.id, authSubject: row.auth_subject, role: row.role } : null;
}

export async function currentOperator(sql: Sql): Promise<ModerationOperator | null> {
  return resolveActiveOperator(sql, await operatorAuthSubject());
}

// Gate for every console entry point. Throws unless the request carries a verified,
// allowlisted, active operator. Callers translate the error into a 404/403 and must
// not expose any moderation data before this resolves.
export async function requireOperator(sql: Sql): Promise<ModerationOperator> {
  const operator = await currentOperator(sql);
  if (!operator) throw new ModerationAccessError();
  return operator;
}
