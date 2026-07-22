import {
  catalogueIntakeCandidates,
  catalogueIntakeExposure,
  catalogueIntakeQueue,
} from '@/data/catalogue-intake';
import { verifyCatalogueIdentityEvidenceArtifacts } from '@/lib/catalogue/identity-evidence-artifact';

async function main() {
  const matchedCanonicalIdentityArtifacts = await verifyCatalogueIdentityEvidenceArtifacts(catalogueIntakeCandidates);
  const asJson = process.argv.includes('--json');
  const report = {
    ...catalogueIntakeExposure,
    matchedCanonicalIdentityArtifacts,
    queue: catalogueIntakeQueue.map(decision => ({
      id: decision.candidate.id,
      priority: decision.candidate.priority,
      stage: decision.stage,
      nextAction: decision.nextAction,
      freshExactOffers: decision.freshExactOffers.length,
      directoryListedOffers: decision.freshExactOffers.filter(offer => offer.retailerStatus === 'directory-listed').length,
      provisionalOffers: decision.freshExactOffers.filter(offer => offer.retailerStatus === 'provisional').length,
      blockers: decision.blockers,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Private catalogue intake');
    console.log(`${report.candidateCount} deliberate candidates · ${report.matchedCanonicalIdentityArtifacts} canonical artifact files matched · ${report.approvalDraftReadyCount} approval drafts ready · ${report.publicProductCount} public products`);
    console.table(report.queue.map(item => ({
      candidate: item.id,
      priority: item.priority,
      stage: item.stage,
      exactOffers: item.freshExactOffers,
      next: item.nextAction,
    })));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
