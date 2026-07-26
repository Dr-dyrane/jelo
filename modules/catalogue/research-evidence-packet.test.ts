import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import researchQueue from '@/data/catalogue-research-queue.json';
import {
  assertPrivateResearchEvidencePacketManifest,
  buildCommunityResearchEvidencePacketManifest,
  buildStaticResearchEvidencePacketManifest,
  catalogueResearchEvidencePacketPublicationStatus,
  maximumCatalogueResearchPacketBatch,
  type CatalogueResearchEvidencePacketManifest,
  type CommunityAggregateResearchReport,
} from '@/lib/catalogue/research-evidence-packet';
import { catalogueResearchQueueDigest, type CatalogueResearchQueue } from '@/lib/catalogue/research-priority';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';

async function staticInputs() {
  const root = process.cwd();
  const [snapshotBytes, queueBytes] = await Promise.all([
    readFile(path.join(root, 'data/catalogue-discovery-screening.json')),
    readFile(path.join(root, 'data/catalogue-research-queue.json')),
  ]);
  return { snapshotBytes, queueBytes };
}

function communityReport(): CommunityAggregateResearchReport {
  return {
    generatedAt: '2026-07-26T12:00:00.000Z',
    researchQueue: [{
      taskKind: 'product-identity',
      entityKind: 'product',
      entityLabel: 'Example community cleanser',
      entitySource: 'custom',
      priorityLane: 'community-first',
      signalCount: 3,
      status: 'pending',
      lastSeenAt: '2026-07-26T11:00:00.000Z',
      publicationStatus: 'private-research-only',
      identity: { brand: 'Example', name: 'Community Cleanser', size: '200 ml' },
    }],
  };
}

test('prepares a bounded, traceable static batch while keeping retailer codes out of product identity', async () => {
  const { snapshotBytes, queueBytes } = await staticInputs();
  const manifest = buildStaticResearchEvidencePacketManifest(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    catalogueResearchQueueDigest(queueBytes),
    catalogueResearchQueueDigest(snapshotBytes),
    { mode: 'batch', count: 8 },
  );

  assert.equal(manifest.policy, 'private-evidence-packet-only');
  assert.equal(manifest.publicationStatus, catalogueResearchEvidencePacketPublicationStatus);
  assert.equal(manifest.packets.length, 8);
  assert.equal(manifest.packets.every(packet => packet.source === 'static-priority'), true);
  assert.doesNotThrow(() => assertPrivateResearchEvidencePacketManifest(manifest));

  const first = manifest.packets[0];
  assert.equal(first.source, 'static-priority');
  if (first.source !== 'static-priority') throw new Error('Expected static packet.');
  assert.ok(first.discoveryEvidence.observations.length > 0);
  assert.ok(first.discoveryEvidence.retailerCodeLeads.length > 0);
  assert.equal(first.discoveryEvidence.retailerCodeLeads.every(code => (
    code.treatment === 'retailer-local-code-not-manufacturer-identity'
  )), true);
  assert.equal(first.proofSlots.officialIdentity.manufacturerGtin, null);
  assert.equal(first.proofSlots.exactNigeriaOffers.offers.length, 0);
});

test('rejects stale static source hashes and oversized batches', async () => {
  const { snapshotBytes, queueBytes } = await staticInputs();
  assert.throws(() => buildStaticResearchEvidencePacketManifest(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    catalogueResearchQueueDigest(queueBytes),
    'f'.repeat(64),
    { mode: 'batch', count: 1 },
  ), /does not match/);
  assert.throws(() => buildStaticResearchEvidencePacketManifest(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    catalogueResearchQueueDigest(queueBytes),
    catalogueResearchQueueDigest(snapshotBytes),
    { mode: 'batch', count: maximumCatalogueResearchPacketBatch + 1 },
  ), /between 1 and/);
});

test('accepts aggregate community tasks without retaining contributor identifiers', () => {
  const report = communityReport();
  const raw = JSON.stringify(report);
  const manifest = buildCommunityResearchEvidencePacketManifest(report, raw, { mode: 'batch', count: 1 });
  assert.doesNotThrow(() => assertPrivateResearchEvidencePacketManifest(manifest));
  assert.equal(manifest.packets[0]?.source, 'community-aggregate');
  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /contributionId|contributorId|draftId|email|phone|userId|sessionId/i);
  assert.match(serialized, /aggregate-task-only-no-contributor-identifiers/);
});

test('refuses community tasks carrying contributor identifiers and any prefilled proof', () => {
  const unsafe = communityReport() as CommunityAggregateResearchReport & {
    researchQueue: Array<CommunityAggregateResearchReport['researchQueue'][number] & { contributionId?: string }>;
  };
  unsafe.researchQueue[0]!.contributionId = 'b08d4cc3-8e72-4189-89a3-6d77f2c700bc';
  assert.throws(() => buildCommunityResearchEvidencePacketManifest(unsafe, JSON.stringify(unsafe), { mode: 'batch', count: 1 }), /contributor identifier/);

  const nestedUnsafe = communityReport() as CommunityAggregateResearchReport & {
    researchQueue: Array<CommunityAggregateResearchReport['researchQueue'][number] & {
      identity: NonNullable<CommunityAggregateResearchReport['researchQueue'][number]['identity']> & {
        sessionId?: string;
      };
    }>;
  };
  nestedUnsafe.researchQueue[0]!.identity!.sessionId = 'private-session';
  assert.throws(
    () => buildCommunityResearchEvidencePacketManifest(
      nestedUnsafe,
      JSON.stringify(nestedUnsafe),
      { mode: 'batch', count: 1 },
    ),
    /contributor identifier/,
  );

  const report = communityReport();
  const manifest = buildCommunityResearchEvidencePacketManifest(report, JSON.stringify(report), { mode: 'batch', count: 1 });
  const malformed = manifest as unknown as {
    packets: Array<{ proofSlots: { officialIdentity: { manufacturerGtin: string | null } } }>;
  };
  malformed.packets[0]!.proofSlots.officialIdentity.manufacturerGtin = '4005808319695';
  assert.throws(() => assertPrivateResearchEvidencePacketManifest(malformed as never), /uncollected and non-publishable/);
});

test('the checked-in first batch is deterministic and invisible to public catalogue sources', async () => {
  const root = process.cwd();
  const [storedBytes, snapshotBytes, queueBytes, publicCatalogue, publishedIntake] = await Promise.all([
    readFile(path.join(root, 'data/catalogue-research-evidence-packets.json')),
    readFile(path.join(root, 'data/catalogue-discovery-screening.json')),
    readFile(path.join(root, 'data/catalogue-research-queue.json')),
    readFile(path.join(root, 'data/catalogue.ts'), 'utf8'),
    readFile(path.join(root, 'data/published-intake-products.ts'), 'utf8'),
  ]);
  const stored = JSON.parse(storedBytes.toString('utf8')) as CatalogueResearchEvidencePacketManifest;
  const expected = buildStaticResearchEvidencePacketManifest(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    catalogueResearchQueueDigest(queueBytes),
    catalogueResearchQueueDigest(snapshotBytes),
    { mode: 'batch', count: 8 },
  );
  assert.deepEqual(stored, expected);
  assert.doesNotThrow(() => assertPrivateResearchEvidencePacketManifest(stored));
  assert.doesNotMatch(publicCatalogue, /catalogue-research-evidence-packets/);
  assert.doesNotMatch(publishedIntake, /catalogue-research-evidence-packets/);
});
