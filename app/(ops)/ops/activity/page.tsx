import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { getPostgresClient } from '@/lib/db/postgres';
import { getActivityInference } from '@/lib/moderation/activity-read-model';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { ActivityInsights } from './ActivityInsights';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  await requireConsoleOperator();
  const inference = await getActivityInference(getPostgresClient());

  return (
    <OpsWorkspace title="Insights">
      <ActivityInsights inference={inference} />
    </OpsWorkspace>
  );
}
