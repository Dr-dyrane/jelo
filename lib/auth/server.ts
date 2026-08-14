import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

let instance: ReturnType<typeof createNeonAuth> | undefined;

// Neon Managed Better Auth (@neondatabase/auth, beta). Both vars are server-only:
// NEON_AUTH_BASE_URL is the Neon Auth endpoint (already provisioned) and
// NEON_AUTH_COOKIE_SECRET (>= 32 chars) signs the session-cache cookie.
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET,
  );
}

// Lazy singleton: never constructed unless configured, so an environment without
// the secret (local dev, or before the console is set up) stays deny-by-default
// instead of throwing at module load.
export function getAuth() {
  if (!isAuthConfigured()) {
    throw new Error(
      "Neon Auth is not configured (NEON_AUTH_BASE_URL / NEON_AUTH_COOKIE_SECRET).",
    );
  }
  if (!instance) {
    instance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
        // SameSite=Lax so the session cookie survives top-level navigations
        // from external links (email recovery, search results, etc.).
        // The SDK defaults to Strict, which causes false "not signed in"
        // redirects when arriving from another site.
        sameSite: "lax",
      },
    });
  }
  return instance;
}
