import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import dossierManifest from '@/data/catalogue-publication-dossiers.json';
import releaseManifest from '@/data/catalogue-publication-releases.json';
import researchQueue from '@/data/catalogue-research-queue.json';
import externalManifest from '@/data/external-products.json';
import { products, reviewedProductRecords } from '@/data/catalogue';
import { catalogueIntakeDecisions } from '@/data/catalogue-intake';
import { buildCataloguePipelineStatus } from '@/lib/catalogue/pipeline-status';

const status = buildCataloguePipelineStatus({
  liveProductCount: products.length,
  reviewedResearchCount: reviewedProductRecords.length,
  frozenLegacyCandidateCount: externalManifest.length,
  retailerDiscoveryLeadCount: discoverySnapshot.selectedCount,
  researchPriorityCount: researchQueue.selectedCount,
  privateDossierCount: dossierManifest.dossiers.length,
  explicitReleaseCount: releaseManifest.releases.length,
}, catalogueIntakeDecisions);

if (process.argv.includes('--json')) console.log(JSON.stringify(status, null, 2));
else {
  console.log('Catalogue pipeline');
  console.table({
    live: status.liveProductCount,
    reviewedResearch: status.reviewedResearchCount,
    frozenLegacyCandidates: status.frozenLegacyCandidateCount,
    retailerDiscoveryLeads: status.retailerDiscoveryLeadCount,
    prioritizedResearch: status.researchPriorityCount,
    deliberateIntake: status.deliberateIntakeCount,
    identityAndCareReady: status.identityAndCareReadyCount,
    exactNigeriaOfferReady: status.exactNigeriaOfferReadyCount,
    almostReady: status.almostReadyCount,
    approvalDraftReady: status.approvalDraftReadyCount,
    privateDossiers: status.privateDossierCount,
    explicitReleases: status.explicitReleaseCount,
  });
  if (status.almostReadyCandidateIds.length) {
    console.log(`Almost ready: ${status.almostReadyCandidateIds.join(', ')}`);
  }
}
