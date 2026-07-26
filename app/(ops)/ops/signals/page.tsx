import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import {
  getCommerceSignalMonitor,
  getContributionAttributionMonitor,
} from '@/lib/moderation/queues';
import {
  commerceSignalView,
  contributionSignalView,
} from '@/lib/moderation/signals-presentation';
import { SignalsMonitor } from './SignalsMonitor';

export const dynamic = 'force-dynamic';

export default async function SignalsView() {
  await requireConsoleOperator();
  const sql = getPostgresClient();
  const [monitor, contributionMonitor] = await Promise.all([
    getCommerceSignalMonitor(sql),
    getContributionAttributionMonitor(sql),
  ]);
  const productSlugs = new Set([
    ...monitor.topProducts.map(item => item.productSlug),
    ...monitor.recentVisits.map(item => item.productSlug),
  ]);
  const products = (await Promise.all(
    [...productSlugs].map(slug => findCatalogueProduct(slug)),
  )).filter(product => product != null);
  const view = commerceSignalView(monitor, products);

  return (
    <OpsWorkspace title="Signals">
      <SignalsMonitor
        commerce={view}
        contributions={contributionSignalView(contributionMonitor)}
      />
    </OpsWorkspace>
  );
}
