import 'server-only';

import { getAuth, isAuthConfigured } from './server';

export type AuthIdentity = {
  subject: string;
  email: string | null;
  emailVerified: boolean;
};

// The single place that turns a verified Neon Auth session into an identity.
// `subject` is neon_auth."user".id (a uuid, equal to the JWT `sub`) returned as a
// string — exactly the value stored in moderation_operators.auth_subject. The SDK
// reads and verifies the session cookie internally; this helper never touches a raw
// request header, cookie, or query param. Returns null when auth is unconfigured or
// no user is signed in, so every caller stays deny-by-default.
export async function getAuthSubject(): Promise<AuthIdentity | null> {
  if (!isAuthConfigured()) return null;
  try {
    const { data: session } = await getAuth().getSession();
    const user = session?.user;
    if (!user?.id) return null;
    return {
      subject: user.id,
      email: user.email ?? null,
      emailVerified: user.emailVerified === true,
    };
  } catch (err) {
    console.error('[getAuthSubject Error]:', err);
    return null;
  }
}
