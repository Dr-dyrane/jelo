import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";
import { getPostgresClient } from "@/lib/db/postgres";
import { loadMarketTruthReadModel } from "@/lib/market-truth/loader";
import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { MarketHealthMonitor } from "./MarketHealthMonitor";

export const dynamic = "force-dynamic";

export default async function MarketHealthPage() {
  await requireConsoleOperator();
  const model = await loadMarketTruthReadModel(getPostgresClient());

  return (
    <OpsWorkspace title="Market health">
      <MarketHealthMonitor model={model} />
    </OpsWorkspace>
  );
}
