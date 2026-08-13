import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { listAssistedOrderQueue } from '@/lib/commerce/assisted-procurement-repository';
import { listAssistedOrderNotificationDeliverySummaries } from '@/lib/commerce/order-notification-repository';
import { listAssistedOrderOperatorAlertSummaries } from '@/lib/commerce/order-operator-alert-repository';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { OrdersQueue } from './OrdersQueue';

export const dynamic = 'force-dynamic';

export default async function AssistedOrdersPage() {
  const operator = await requireConsoleOperator();
  const orders = await listAssistedOrderQueue();
  const orderIds = orders.map(order => order.id);
  const [notificationDeliveries, operatorAlerts] = await Promise.all([
    listAssistedOrderNotificationDeliverySummaries(orderIds),
    listAssistedOrderOperatorAlertSummaries(orderIds),
  ]);
  return (
    <OpsWorkspace title="Assisted orders">
      <OrdersQueue
        orders={orders}
        notificationDeliveries={notificationDeliveries}
        operatorAlerts={operatorAlerts}
        canManage={can(operator.role, 'orders.manage')}
      />
    </OpsWorkspace>
  );
}
