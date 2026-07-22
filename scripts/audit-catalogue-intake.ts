import {
  catalogueIntakeExposure,
  catalogueIntakeQueue,
} from '@/data/catalogue-intake';

const asJson = process.argv.includes('--json');
const report = {
  ...catalogueIntakeExposure,
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
  console.log(`${report.candidateCount} deliberate candidates · ${report.approvalDraftReadyCount} approval drafts ready · ${report.publicProductCount} public products`);
  console.table(report.queue.map(item => ({
    candidate: item.id,
    priority: item.priority,
    stage: item.stage,
    exactOffers: item.freshExactOffers,
    next: item.nextAction,
  })));
}
