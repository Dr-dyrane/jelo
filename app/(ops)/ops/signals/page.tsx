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
import { SignalsRefreshControl } from './SignalsRefreshControl';

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
  const commerce = commerceSignalView(monitor, products);
  const contributions = contributionSignalView(contributionMonitor);

  return (
    <OpsWorkspace title="Signals">
      <SignalsRefreshControl />
      <SignalsMonitor commerce={commerce} contributions={contributions} />
    </OpsWorkspace>
  );
}
