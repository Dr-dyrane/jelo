'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// Browser auth client. Talks to the same-origin catch-all at /api/auth, so no
// base URL or secret is needed here (those stay server-only). Used by the operator
// sign-in surface to start the email magic-link flow.
export const authClient = createAuthClient();
