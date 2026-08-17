import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { getPostgresClient } from "@/lib/db/postgres";
import { getCommunityOutcomeCounts } from "@/lib/clinical/care-evidence-queries";
import { requireConsoleOperator } from "@/lib/moderation/console-access";
import {
  careStateLabel,
  identifyCareEvidenceSignals,
  type ProductCareEvidenceSignal,
} from "@/lib/clinical/care-evidence-bridge";
import { CareEvidenceView, type CareEvidenceProduct } from "./CareEvidenceView";

export const dynamic = "force-dynamic";

type CareEvidenceGroups = {
  readyForReview: CareEvidenceProduct[];
  underMonitoring: CareEvidenceProduct[];
  awaitingEvidenceCount: number;
};

function groupSignals(
  signals: ProductCareEvidenceSignal[],
): CareEvidenceGroups {
  const readyForReview: CareEvidenceProduct[] = [];
  const underMonitoring: CareEvidenceProduct[] = [];
  let awaitingEvidenceCount = 0;

  for (const signal of signals) {
    const product: CareEvidenceProduct = {
      productSlug: signal.productSlug,
      careStateLabel: careStateLabel(signal.productSlug),
      outcomeSummary: signal.outcomeSummary,
    };

    switch (signal.recommendation) {
      case "ready-for-pharmacist-review":
        readyForReview.push(product);
        break;
      case "keep-monitoring":
        underMonitoring.push(product);
        break;
      case "insufficient-evidence":
        awaitingEvidenceCount += 1;
        break;
    }
  }

  return { readyForReview, underMonitoring, awaitingEvidenceCount };
}

export default async function CareEvidencePage() {
  await requireConsoleOperator();
  const products = await listCatalogueProducts();
  const productSlugs = products.map((product) => product.slug);
  const sql = getPostgresClient();
  const communityOutcomes = await getCommunityOutcomeCounts(sql, productSlugs);
  const signals = identifyCareEvidenceSignals(productSlugs, communityOutcomes);
  const groups = groupSignals(signals);

  return (
    <OpsWorkspace title="Care evidence">
      <CareEvidenceView
        readyForReview={groups.readyForReview}
        underMonitoring={groups.underMonitoring}
        awaitingEvidenceCount={groups.awaitingEvidenceCount}
      />
    </OpsWorkspace>
  );
}
