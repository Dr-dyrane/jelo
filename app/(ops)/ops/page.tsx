import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { OverviewBriefing } from './OverviewBriefing';
import { loadOverviewBriefing } from './overview-read-model';

export const dynamic = 'force-dynamic';

// Briefing only: queue review and every moderation decision remain on their
// canonical queue routes.
export default async function OpsOverview() {
  const operator = await requireConsoleOperator();
  const briefing = await loadOverviewBriefing(getPostgresClient(), operator.role);

  return <OverviewBriefing briefing={briefing} />;
}
