import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { listAssistedOrderQueue } from '@/lib/commerce/assisted-procurement-repository';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { OrdersQueue } from './OrdersQueue';

export const dynamic = 'force-dynamic';

export default async function AssistedOrdersPage() {
  const operator = await requireConsoleOperator();
  const orders = await listAssistedOrderQueue();
  return (
    <OpsWorkspace title="Assisted orders">
      <OrdersQueue orders={orders} canManage={can(operator.role, 'orders.manage')} />
    </OpsWorkspace>
  );
}
