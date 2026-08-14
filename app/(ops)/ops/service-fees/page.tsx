import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { can } from "@/lib/moderation/capabilities";
import { listServiceFeePolicies } from "@/lib/commerce/service-fee-policy";
import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";
import { ServiceFeeManager } from "./ServiceFeeManager";

export const dynamic = "force-dynamic";

export default async function ServiceFeesPage() {
  const operator = await requireConsoleOperator();
  const policies = await listServiceFeePolicies();
  const canManage = can(operator.role, "orders.manage");
  return (
    <OpsWorkspace title="Service fee policies">
      <ServiceFeeManager policies={policies} canManage={canManage} />
    </OpsWorkspace>
  );
}
