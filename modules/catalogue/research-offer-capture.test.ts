import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { catalogueDiscoverySources } from '@/data/catalogue-discovery-sources';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import packetProjection from '@/data/catalogue-research-evidence-packets.json';
import {
  assertPrivateResearchOfferCaptureManifest,
  assertResearchOfferCaptureManifestMatchesPlan,
  buildResearchOfferCaptureManifest,
  buildResearchOfferCapturePlan,
  captureResearchOfferResponse,
  maximumResearchOfferResponseBytes,
  researchOfferCaptureManifestPath,
  verifyResearchOfferCaptureBundle,
  writeResearchOfferCaptureBundle,
  type ResearchOfferCaptureManifest,
  type ResearchOfferCapturePlanItem,
} from '@/lib/catalogue/research-offer-capture';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';
import type { CatalogueResearchEvidencePacketManifest } from '@/lib/catalogue/research-evidence-packet';
import type { CatalogueResearchEvidencePacketProjection } from '@/lib/catalogue/research-evidence-packet-source';

const firstPacketSourcePath = (
  packetProjection as CatalogueResearchEvidencePacketProjection
).shards[0]!.sourcePath;
const packetManifest = JSON.parse(
  readFileSync(path.join(process.cwd(), firstPacketSourcePath), 'utf8'),
) as CatalogueResearchEvidencePacketManifest;

function planItem(overrides: Partial<ResearchOfferCapturePlanItem> = {}): ResearchOfferCapturePlanItem {
  return {
    packetId: 'a'.repeat(24),
    discoveryId: 'b'.repeat(24),
    retailer: 'BuyBetter',
    retailerStatus: 'directory-listed',
    listingUrl: 'https://buybetter.ng/product/cerave-hydrating-cleanser-473ml/',
    sourceProductId: 421,
    sourceProductApiUrl: 'https://buybetter.ng/wp-json/wc/store/v1/products/421',
    expectedTitle: 'CeraVe Hydrating Cleanser 473 ml',
    expectedSize: '473 ml',
    evidencePath: `data/catalogue-offer-source-evidence/${'b'.repeat(24)}--buybetter.json`,
    ...overrides,
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 421,
    name: 'CeraVe Hydrating Cleanser 473 ml',
    slug: 'cerave-hydrating-cleanser-473ml',
    permalink: 'https://buybetter.ng/product/cerave-hydrating-cleanser-473ml/',
    sku: '3337875597333',
    prices: { price: '1526500', currency_code: 'NGN', currency_minor_unit: 2 },
    stock_availability: { text: 'Low stock', class: 'low-stock' },
    is_in_stock: true,
    low_stock_remaining: 2,
    ...overrides,
  };
}

function responseFor(value: unknown, url = planItem().sourceProductApiUrl, headers: Record<string, string> = {}) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  const response = new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'content-length': String(bytes.byteLength),
      ...headers,
    },
  });
  Object.defineProperty(response, 'url', { value: url });
  return { bytes, response };
}

function fetchResponse(response: Response) {
  return (async () => response) as typeof fetch;
}

test('joins only the bounded checked-in packet selection to exact retailer product API endpoints', () => {
  const packets = structuredClone(packetManifest) as CatalogueResearchEvidencePacketManifest;
  const snapshot = structuredClone(discoverySnapshot) as CatalogueDiscoverySnapshot;
  const first = packets.packets[0];
  assert.equal(first.source, 'static-priority');
  if (first.source !== 'static-priority') throw new Error('Expected a static research packet.');
  const candidate = snapshot.candidates.find(item => item.discoveryId === first.productLead.discoveryId);
  assert.ok(candidate);

  const plan = buildResearchOfferCapturePlan(packets, snapshot, 1);
  assert.equal(plan.length, candidate.retailerObservations.length);
  assert.equal(plan.every(item => item.packetId === first.id), true);
  assert.equal(plan.every(item => (
    new URL(item.sourceProductApiUrl).hostname.replace(/^www\./, '')
    === new URL(item.listingUrl).hostname.replace(/^www\./, '')
  )), true);
  assert.throws(
    () => buildResearchOfferCapturePlan(packets, snapshot, 13),
    /between 1 and 12/,
  );

  const thirdShardDescriptor = (
    packetProjection as CatalogueResearchEvidencePacketProjection
  ).shards[2]!;
  const thirdShard = JSON.parse(
    readFileSync(path.join(process.cwd(), thirdShardDescriptor.sourcePath), 'utf8'),
  ) as CatalogueResearchEvidencePacketManifest;
  const laterPacket = thirdShard.packets.find(packet => (
    packet.source === 'static-priority'
    && packet.productLead.discoveryId === '7f5e4463688a37e008b523ff'
  ));
  assert.ok(laterPacket);
  const laterPlan = buildResearchOfferCapturePlan(
    thirdShard,
    snapshot,
    [laterPacket.id],
  );
  assert.equal(laterPlan.every(item => item.discoveryId === '7f5e4463688a37e008b523ff'), true);

  const staleSnapshot = structuredClone(snapshot);
  const staleCandidate = staleSnapshot.candidates.find(item =>
    item.discoveryId === first.productLead.discoveryId);
  assert.ok(staleCandidate);
  const staleObservation = staleCandidate.retailerObservations[0];
  assert.ok(staleObservation.sourceProductId);
  assert.ok(staleObservation.sourceProductApiUrl);
  staleObservation.sourceProductId += 1;
  staleObservation.sourceProductApiUrl = staleObservation.sourceProductApiUrl
    .replace(/\/\d+$/, `/${staleObservation.sourceProductId}`);
  assert.throws(
    () => buildResearchOfferCapturePlan(packets, staleSnapshot, 1),
    /not bound to the research packet/,
  );
});

test('captures exact JSON bytes while keeping retailer SKU local and publication authority absent', async () => {
  const item = planItem();
  const { bytes, response } = responseFor(product());
  const captured = await captureResearchOfferResponse(item, {
    fetchImpl: fetchResponse(response),
    capturedAt: '2026-07-27T16:00:00.000Z',
  });

  assert.deepEqual(captured.responseBytes, bytes);
  assert.equal(captured.record.source.responseByteSize, bytes.byteLength);
  assert.equal(captured.record.offer.price.amount, 15_265);
  assert.equal(captured.record.offer.stock, 'low-stock');
  assert.deepEqual(captured.record.offer.retailerSku, {
    value: '3337875597333',
    treatment: 'retailer-local-code-not-manufacturer-identity',
  });
  assert.equal(captured.record.publicationAuthority, 'none');
  assert.equal(captured.record.identityAuthority, 'none');

  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: 'c'.repeat(64),
    discoverySnapshotSha256: 'd'.repeat(64),
    packetIds: [item.packetId],
    captured: [captured],
    generatedAt: '2026-07-27T16:00:01.000Z',
  });
  assert.doesNotThrow(() => assertPrivateResearchOfferCaptureManifest(manifest));
  assert.equal(manifest.publicationAuthority, 'none');
  assert.deepEqual(manifest.qualityCautions, []);
  assert.equal(manifest.captures[0].publicationStatus, 'not-a-catalogue-candidate');
  assert.doesNotThrow(() => (
    assertResearchOfferCaptureManifestMatchesPlan(manifest, [item])
  ));
  assert.throws(
    () => assertResearchOfferCaptureManifestMatchesPlan(manifest, [{
      ...item,
      expectedTitle: 'A different product title 473 ml',
    }]),
    /packet-derived capture plan/,
  );
});

test('binds source-quality cautions to the exact retained response digest', async () => {
  const item = planItem();
  const captured = await captureResearchOfferResponse(item, {
    fetchImpl: fetchResponse(responseFor(product()).response),
    capturedAt: '2026-07-27T16:00:00.000Z',
  });
  const caution = {
    captureId: captured.record.id,
    responseSha256: captured.record.source.responseSha256,
    kind: 'cross-product-visual' as const,
    disposition: 'exclude-source-visual-from-all-use' as const,
    basis: 'retained-response-and-live-listing-review' as const,
    reviewedAt: '2026-07-28T05:40:00.000Z',
  };
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: 'c'.repeat(64),
    discoverySnapshotSha256: 'd'.repeat(64),
    packetIds: [item.packetId],
    captured: [captured],
    qualityCautions: [caution],
    generatedAt: '2026-07-27T16:00:01.000Z',
  });
  assert.deepEqual(manifest.qualityCautions, [caution]);

  const stale = structuredClone(manifest);
  stale.qualityCautions[0].responseSha256 = 'e'.repeat(64);
  assert.throws(
    () => assertPrivateResearchOfferCaptureManifest(stale),
    /source-quality caution is invalid or stale/,
  );
});

test('retains source bytes only under an explicit private, no-reuse source grant', async () => {
  const grantedSourceKeys = catalogueDiscoverySources
    .filter(source => (
      source.privateSourceByteRetention.capability
      === 'private-exact-product-response-audit'
    ))
    .map(source => source.key);
  assert.deepEqual(grantedSourceKeys, ['buybetter', 'slique-beauty']);

  for (const source of catalogueDiscoverySources) {
    assert.equal(source.privateSourceByteRetention.publicContentReuse, 'none');
    assert.equal(source.privateSourceByteRetention.publicImageReuse, 'none');
    assert.equal(source.contentUse, 'link-only');
  }
  const lux = catalogueDiscoverySources.find(source => source.key === 'lux-beauty-ng');
  assert.equal(lux?.privateSourceByteRetention.capability, 'none');
  assert.equal(lux?.privateSourceByteRetention.retentionBoundary, 'none');

  let fetchCalled = false;
  const denied = planItem({
    retailer: 'Lux Beauty',
    listingUrl:
      'https://www.luxbeautyng.com/product/cerave-hydrating-cleanser-473ml/',
    sourceProductApiUrl:
      'https://www.luxbeautyng.com/wp-json/wc/store/v1/products/421',
    evidencePath:
      `data/catalogue-offer-source-evidence/${'b'.repeat(24)}--lux-beauty.json`,
  });
  await assert.rejects(
    () => captureResearchOfferResponse(denied, {
      fetchImpl: (async () => {
        fetchCalled = true;
        return responseFor(product()).response;
      }) as typeof fetch,
    }),
    /private source-byte retention is not explicitly granted/,
  );
  assert.equal(fetchCalled, false);
});

test('rejects route, product, permalink, title, size, price and response-boundary drift', async () => {
  const item = planItem();
  await assert.rejects(
    captureResearchOfferResponse(
      planItem({ sourceProductApiUrl: 'https://attacker.example/wp-json/wc/store/v1/products/421' }),
      { fetchImpl: fetchResponse(responseFor(product()).response) },
    ),
    /exact reviewed product API route/,
  );
  await assert.rejects(
    captureResearchOfferResponse(item, { fetchImpl: fetchResponse(responseFor(product({ id: 422 })).response) }),
    /product id changed/,
  );
  await assert.rejects(
    captureResearchOfferResponse(item, {
      fetchImpl: fetchResponse(responseFor(product({
        permalink: 'https://buybetter.ng/product/a-different-product/',
      })).response),
    }),
    /permalink does not match/,
  );
  await assert.rejects(
    captureResearchOfferResponse(item, {
      fetchImpl: fetchResponse(responseFor(product({ name: 'A different cleanser 473 ml' })).response),
    }),
    /title does not match/,
  );
  await assert.rejects(
    captureResearchOfferResponse(item, {
      fetchImpl: fetchResponse(responseFor(product({ name: 'CeraVe Hydrating Cleanser 236 ml' })).response),
    }),
    /title does not match/,
  );
  await assert.rejects(
    captureResearchOfferResponse(item, {
      fetchImpl: fetchResponse(responseFor(product({
        prices: { price: '20', currency_code: 'USD', currency_minor_unit: 0 },
      })).response),
    }),
    /NGN price/,
  );
  await assert.rejects(
    captureResearchOfferResponse(item, {
      fetchImpl: fetchResponse(responseFor(product(), item.sourceProductApiUrl, {
        'content-length': String(maximumResearchOfferResponseBytes + 1),
      }).response),
    }),
    /byte limit/,
  );
});

test('atomically writes exact evidence bytes and verifies the private manifest offline', async () => {
  const item = planItem();
  const { bytes, response } = responseFor(product());
  const captured = await captureResearchOfferResponse(item, {
    fetchImpl: fetchResponse(response),
    capturedAt: '2026-07-27T16:00:00.000Z',
  });
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: 'c'.repeat(64),
    discoverySnapshotSha256: 'd'.repeat(64),
    packetIds: [item.packetId],
    captured: [captured],
    generatedAt: '2026-07-27T16:00:01.000Z',
  });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'jelocare-offer-capture-'));
  try {
    await writeResearchOfferCaptureBundle(temporaryRoot, manifest, [captured]);
    assert.deepEqual(await readFile(path.join(temporaryRoot, item.evidencePath)), bytes);
    const storedManifest = JSON.parse(
      await readFile(path.join(temporaryRoot, researchOfferCaptureManifestPath), 'utf8'),
    ) as ResearchOfferCaptureManifest;
    assert.deepEqual(storedManifest, manifest);
    assert.deepEqual(await verifyResearchOfferCaptureBundle(temporaryRoot, storedManifest), {
      packetCount: 1,
      responseCount: 1,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('offline verification rejects a symlinked retained response', async () => {
  const item = planItem();
  const captured = await captureResearchOfferResponse(item, {
    fetchImpl: fetchResponse(responseFor(product()).response),
    capturedAt: '2026-07-27T16:00:00.000Z',
  });
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: 'c'.repeat(64),
    discoverySnapshotSha256: 'd'.repeat(64),
    packetIds: [item.packetId],
    captured: [captured],
    generatedAt: '2026-07-27T16:00:01.000Z',
  });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'jelocare-offer-capture-'));
  try {
    await writeResearchOfferCaptureBundle(temporaryRoot, manifest, [captured]);
    const evidencePath = path.join(temporaryRoot, item.evidencePath);
    const targetPath = path.join(temporaryRoot, 'retained-offer-target.json');
    await writeFile(targetPath, captured.responseBytes);
    await rm(evidencePath);
    await symlink(targetPath, evidencePath);
    await assert.rejects(
      () => verifyResearchOfferCaptureBundle(temporaryRoot, manifest),
      /not a regular checked-in file/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('manifest verification rejects publication authority and retailer identity promotion', async () => {
  const item = planItem();
  const captured = await captureResearchOfferResponse(item, {
    fetchImpl: fetchResponse(responseFor(product()).response),
    capturedAt: '2026-07-27T16:00:00.000Z',
  });
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: 'c'.repeat(64),
    discoverySnapshotSha256: 'd'.repeat(64),
    packetIds: [item.packetId],
    captured: [captured],
    generatedAt: '2026-07-27T16:00:01.000Z',
  });

  const publishable = structuredClone(manifest) as unknown as { publicationAuthority: string };
  publishable.publicationAuthority = 'catalogue';
  assert.throws(
    () => assertPrivateResearchOfferCaptureManifest(publishable as unknown as ResearchOfferCaptureManifest),
    /publication authority/,
  );

  const promoted = structuredClone(manifest);
  assert.ok(promoted.captures[0].offer.retailerSku);
  promoted.captures[0].offer.retailerSku!.treatment = 'manufacturer-identity' as never;
  assert.throws(
    () => assertPrivateResearchOfferCaptureManifest(promoted),
    /Retailer SKU was promoted/,
  );
});

test('manifest verification normalizes malformed response route failures', async () => {
  const item = planItem();
  const captured = await captureResearchOfferResponse(item, {
    fetchImpl: fetchResponse(responseFor(product()).response),
    capturedAt: '2026-07-27T16:00:00.000Z',
  });
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: 'c'.repeat(64),
    discoverySnapshotSha256: 'd'.repeat(64),
    packetIds: [item.packetId],
    captured: [captured],
    generatedAt: '2026-07-27T16:00:01.000Z',
  });
  manifest.captures[0].source.responseUrl = 'not a URL';

  assert.throws(
    () => assertPrivateResearchOfferCaptureManifest(manifest),
    error => (
      error instanceof Error
      && error.message === 'Private offer capture response route or digest binding is invalid.'
      && error.name === 'Error'
    ),
  );
});
