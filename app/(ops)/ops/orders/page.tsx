import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { can } from "@/lib/moderation/capabilities";
import { listAssistedOrderQueue } from "@/lib/commerce/assisted-procurement-repository";
import { listAssistedOrderNotificationDeliverySummaries } from "@/lib/commerce/order-notification-repository";
import { listAssistedOrderOperatorAlertSummaries } from "@/lib/commerce/order-operator-alert-repository";
import {
  resolveServiceFee,
  type ResolvedServiceFee,
} from "@/lib/commerce/service-fee-policy";
import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";
import { OrdersQueue } from "./OrdersQueue";

export const dynamic = "force-dynamic";

export default async function AssistedOrdersPage() {
  const operator = await requireConsoleOperator();
  const orders = await listAssistedOrderQueue();
  const orderIds = orders.map((order) => order.id);
  const [notificationDeliveries, operatorAlerts] = await Promise.all([
    listAssistedOrderNotificationDeliverySummaries(orderIds),
    listAssistedOrderOperatorAlertSummaries(orderIds),
  ]);

  // Resolve service fee policies for orders in quoting state (where the
  // operator is about to enter a quote). We use the observed product subtotal
  // as the basis for percentage calculations.
  const quotingOrders = orders.filter((order) => order.state === "quoting");
  const serviceFeeEntries = await Promise.all(
    quotingOrders.map(async (order) => {
      const productSubtotalNgn = order.lines.reduce(
        (sum, line) => sum + line.observedUnitPriceNgn * line.quantity,
        0,
      );
      const resolved = await resolveServiceFee({
        retailerSlug: order.retailer,
        deliveryState: order.deliveryState,
        productSubtotalNgn,
      });
      return [order.id, resolved] as const;
    }),
  );
  const serviceFees = new Map<string, ResolvedServiceFee | null>(
    serviceFeeEntries,
  );

  return (
    <OpsWorkspace title="Assisted orders">
      <OrdersQueue
        orders={orders}
        notificationDeliveries={notificationDeliveries}
        operatorAlerts={operatorAlerts}
        canManage={can(operator.role, "orders.manage")}
        serviceFees={serviceFees}
      />
    </OpsWorkspace>
  );
}
