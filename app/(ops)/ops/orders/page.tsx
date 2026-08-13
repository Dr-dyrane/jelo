import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { listAssistedOrderQueue } from '@/lib/commerce/assisted-procurement-repository';
import { listAssistedOrderNotificationDeliverySummaries } from '@/lib/commerce/order-notification-repository';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { OrdersQueue } from './OrdersQueue';

export const dynamic = 'force-dynamic';

export default async function AssistedOrdersPage() {
  const operator = await requireConsoleOperator();
  const orders = await listAssistedOrderQueue();
  const notificationDeliveries = await listAssistedOrderNotificationDeliverySummaries(
    orders.map(order => order.id),
  );
  return (
    <OpsWorkspace title="Assisted orders">
      <OrdersQueue
        orders={orders}
        notificationDeliveries={notificationDeliveries}
        canManage={can(operator.role, 'orders.manage')}
      />
    </OpsWorkspace>
  );
}
