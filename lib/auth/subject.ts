import 'server-only';

import { getAuth, isAuthConfigured } from './server';

export type AuthIdentity = {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export type AuthSubjectResult =
  | { status: 'authenticated'; identity: AuthIdentity }
  | { status: 'signed-out' }
  | { status: 'unavailable' };

// The single place that turns a verified Neon Auth session into an identity.
// `subject` is neon_auth."user".id (a uuid, equal to the JWT `sub`) returned as a
// string — exactly the value stored in moderation_operators.auth_subject. The SDK
// reads and verifies the session cookie internally; this helper never touches a
// raw request header, cookie, or query param. The richer result lets guarded pages
// distinguish a normal signed-out visit from a failed check without exposing SDK
// details. Existing callers keep using getAuthSubject and remain deny-by-default.
export async function getAuthSubjectResult(): Promise<AuthSubjectResult> {
  if (!isAuthConfigured()) return { status: 'unavailable' };
  try {
    const { data: session, error } = await getAuth().getSession();
    if (error) {
      console.error('Authentication session lookup unavailable.');
      return { status: 'unavailable' };
    }
    const user = session?.user;
    if (!user?.id) return { status: 'signed-out' };
    return {
      status: 'authenticated',
      identity: {
        subject: user.id,
        email: user.email ?? null,
        emailVerified: user.emailVerified === true,
        name: user.name ?? null,
      },
    };
  } catch {
    console.error('Authentication session lookup unavailable.');
    return { status: 'unavailable' };
  }
}

export async function getAuthSubject(): Promise<AuthIdentity | null> {
  const result = await getAuthSubjectResult();
  return result.status === 'authenticated' ? result.identity : null;
}
