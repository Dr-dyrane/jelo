import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import {
  assertPrivateResearchEvidencePacketProjection,
  readStaticResearchPacketSourceFiles,
  type CatalogueResearchEvidencePacketProjection,
} from '@/lib/catalogue/research-evidence-packet-source';
import {
  assertPrivateResearchOfferCaptureProjection,
  compileResearchOfferCaptureSources,
  readResearchOfferCaptureSourceFiles,
  type ResearchOfferCaptureProjection,
} from '@/lib/catalogue/research-offer-capture-source';
import { researchOfferDigest } from '@/lib/catalogue/research-offer-capture';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';

test('immutable capture sources compile to the checked-in zero-authority projection', async () => {
  const root = process.cwd();
  const [
    packetProjectionBytes,
    captureProjectionBytes,
    snapshotBytes,
    packetSourceFiles,
    captureSourceFiles,
  ] = await Promise.all([
    readFile(path.join(root, 'data/catalogue-research-evidence-packets.json')),
    readFile(path.join(root, 'data/catalogue-research-offer-captures.json')),
    readFile(path.join(root, 'data/catalogue-discovery-screening.json')),
    readStaticResearchPacketSourceFiles(root),
    readResearchOfferCaptureSourceFiles(root),
  ]);
  const packetProjection = JSON.parse(
    packetProjectionBytes.toString('utf8'),
  ) as CatalogueResearchEvidencePacketProjection;
  const stored = JSON.parse(
    captureProjectionBytes.toString('utf8'),
  ) as ResearchOfferCaptureProjection;
  assertPrivateResearchEvidencePacketProjection(packetProjection);
  assertPrivateResearchOfferCaptureProjection(stored);

  const expected = await compileResearchOfferCaptureSources({
    repositoryRoot: root,
    packetProjection,
    packetProjectionBytes,
    packetSourceFiles,
    captureSourceFiles,
    snapshot: discoverySnapshot as CatalogueDiscoverySnapshot,
    discoverySnapshotSha256: researchOfferDigest(snapshotBytes),
  });
  assert.deepEqual(stored, expected);
  assert.equal(stored.publicationAuthority, 'none');
  assert.equal(stored.sources.every(source => source.packetCount <= 12), true);
  assert.equal(stored.sources[0]?.researchPacketSourceSha256, packetProjection.shards[0]?.sourceSha256);
  assert.equal(stored.captures.every(capture => (
    capture.publicationAuthority === 'none'
    && capture.identityAuthority === 'none'
  )), true);
});
