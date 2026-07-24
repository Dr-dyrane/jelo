import 'server-only';

import { notFound } from 'next/navigation';
import { getPostgresClient, hasPostgresConfig } from '@/lib/db/postgres';
import { ModerationAccessError, requireOperator, type ModerationOperator } from './access';

// The single gate every ops page, layout, and server action awaits. A denied,
// unauthenticated, or unconfigured request becomes a 404 (hiding the console's
// existence), never a 403. A layout guard is chrome-only — each page and each
// action must call this independently, because a layout does not gate its children.
export async function requireConsoleOperator(): Promise<ModerationOperator> {
  if (!hasPostgresConfig()) notFound();
  try {
    return await requireOperator(getPostgresClient());
  } catch (error) {
    if (error instanceof ModerationAccessError) notFound();
    throw error;
  }
}
