import { getAuth, isAuthConfigured } from '@/lib/auth/server';

// The Neon Auth catch-all. When auth is unconfigured (local dev, or before the
// Neon console is set up) the routes 404 instead of constructing the auth instance
// at module load, so the build and the public app are unaffected.
const handler = isAuthConfigured() ? getAuth().handler() : null;

async function notConfigured() {
  return new Response('Not found', { status: 404 });
}

export const GET = handler?.GET ?? notConfigured;
export const POST = handler?.POST ?? notConfigured;
