import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  catalogueDiscoverySources,
  type CatalogueDiscoverySource,
} from '@/data/catalogue-discovery-sources';
import {
  auditCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
  type DiscoveryRetailerObservation,
  type WooStoreProduct,
} from './discovery-screening';
import {
  assertPrivateResearchEvidencePacketManifest,
  type CatalogueResearchEvidencePacketManifest,
} from './research-evidence-packet';

export const researchOfferCaptureSchemaVersion = 2 as const;
export const researchOfferCapturePolicy = 'private-retained-offer-source-evidence-only' as const;
export const researchOfferCapturePublicationAuthority = 'none' as const;
export const researchOfferCapturePublicationStatus = 'not-a-catalogue-candidate' as const;
export const maximumResearchOfferCapturePackets = 12;
export const maximumResearchOfferResponseBytes = 1_000_000;
export const researchOfferCaptureManifestPath = 'data/catalogue-research-offer-captures.json' as const;
export const researchOfferCaptureEvidenceDirectory = 'data/catalogue-offer-source-evidence' as const;

const digestPattern = /^[0-9a-f]{64}$/;
const shortDigestPattern = /^[0-9a-f]{24}$/;
const productApiRoutePattern = /^\/wp-json\/wc\/store\/v1\/products\/([1-9]\d*)\/?$/;

type CaptureDiscoveryObservation = DiscoveryRetailerObservation & {
  sourceProductId: number;
  sourceProductApiUrl: string;
};

export type ResearchOfferCapturePlanItem = {
  packetId: string;
  discoveryId: string;
  retailer: string;
  retailerStatus: DiscoveryRetailerObservation['retailerStatus'];
  listingUrl: string;
  sourceProductId: number;
  sourceProductApiUrl: string;
  expectedTitle: string;
  expectedSize: string;
  evidencePath: string;
};

export type RetailerLocalSku = {
  value: string;
  treatment: 'retailer-local-code-not-manufacturer-identity';
} | null;

export type ResearchOfferCaptureRecord = {
  id: string;
  packetId: string;
  discoveryId: string;
  retailer: string;
  retailerStatus: DiscoveryRetailerObservation['retailerStatus'];
  publicationStatus: typeof researchOfferCapturePublicationStatus;
  publicationAuthority: typeof researchOfferCapturePublicationAuthority;
  identityAuthority: 'none';
  evidencePath: string;
  source: {
    productId: number;
    requestedUrl: string;
    responseUrl: string;
    listingUrl: string;
    capturedAt: string;
    responseSha256: string;
    responseByteSize: number;
    responseMimeType: 'application/json';
  };
  offer: {
    title: string;
    size: string;
    price: {
      amount: number;
      currency: 'NGN';
    };
    stock: DiscoveryRetailerObservation['stock'];
    retailerSku: RetailerLocalSku;
  };
};

export type ResearchOfferQualityCaution = {
  captureId: string;
  responseSha256: string;
  kind: 'cross-product-visual' | 'description-size-conflict';
  disposition:
    | 'exclude-source-visual-from-all-use'
    | 'exclude-description-from-identity-care-and-public-copy';
  basis: 'retained-response-and-live-listing-review';
  reviewedAt: string;
};

export type CapturedResearchOfferResponse = {
  record: ResearchOfferCaptureRecord;
  responseBytes: Buffer;
};

export type ResearchOfferCaptureManifest = {
  schemaVersion: typeof researchOfferCaptureSchemaVersion;
  policy: typeof researchOfferCapturePolicy;
  publicationStatus: typeof researchOfferCapturePublicationStatus;
  publicationAuthority: typeof researchOfferCapturePublicationAuthority;
  generatedAt: string;
  source: {
    researchPacketsSha256: string;
    discoverySnapshotSha256: string;
  };
  selection: {
    packetCount: number;
    packetIds: string[];
    responseCount: number;
  };
  qualityCautions: ResearchOfferQualityCaution[];
  captures: ResearchOfferCaptureRecord[];
};

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/^www\./, '');
}

function retailerSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedText(value: string) {
  return decodeHtml(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function measuredSize(value: string) {
  const matches = Array.from(decodeHtml(value).matchAll(
    /\b\d+(?:[.,]\d+)?\s*(?:fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/gi,
  )).map(match => match[0].replace(/\s+/g, ' ').trim());
  return Array.from(new Set(matches.map(match => match.toLowerCase()))).join(' / ');
}

function exactUrl(value: string) {
  const url = new URL(value);
  url.hash = '';
  return url.href;
}

function sameExactUrl(left: unknown, right: unknown) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  try {
    return exactUrl(left) === exactUrl(right);
  } catch {
    return false;
  }
}

function productApiRoute(url: URL, productId: number) {
  const route = productApiRoutePattern.exec(url.pathname);
  return route != null && Number(route[1]) === productId && !url.search && !url.hash;
}

function assertCaptureRoute(item: ResearchOfferCapturePlanItem) {
  let listing: URL;
  let api: URL;
  try {
    listing = new URL(item.listingUrl);
    api = new URL(item.sourceProductApiUrl);
  } catch {
    throw new Error(`${item.discoveryId}/${item.retailer} has an invalid source URL.`);
  }
  if (
    listing.protocol !== 'https:'
    || api.protocol !== 'https:'
    || normalizedHost(listing.hostname) !== normalizedHost(api.hostname)
    || listing.port !== api.port
    || listing.username !== ''
    || listing.password !== ''
    || api.username !== ''
    || api.password !== ''
    || !listing.pathname.includes('/product/')
    || !productApiRoute(api, item.sourceProductId)
  ) {
    throw new Error(`${item.discoveryId}/${item.retailer} is outside its exact reviewed product API route.`);
  }
}

function privateSourceByteRetentionGranted(source: CatalogueDiscoverySource) {
  const policy = source.privateSourceByteRetention;
  return (
    source.contentUse === 'link-only'
    && policy?.capability === 'private-exact-product-response-audit'
    && policy.rationale === 'reopen-dated-offer-fields-and-verify-response-integrity'
    && policy.retentionBoundary === 'private-evidence-repository-only'
    && policy.publicContentReuse === 'none'
    && policy.publicImageReuse === 'none'
  );
}

/**
 * Re-resolves the plan item against the canonical source registry. A packet,
 * snapshot, or hand-built plan cannot grant itself permission to retain bytes.
 */
function assertPrivateSourceByteRetention(item: ResearchOfferCapturePlanItem) {
  const api = new URL(item.sourceProductApiUrl);
  const source = catalogueDiscoverySources.find(candidate => {
    const endpoint = new URL(candidate.endpoint);
    return (
      candidate.retailer === item.retailer
      && normalizedHost(endpoint.hostname) === normalizedHost(api.hostname)
      && endpoint.protocol === api.protocol
      && endpoint.port === api.port
      && api.pathname === (
        `${endpoint.pathname.replace(/\/+$/, '')}/${item.sourceProductId}`
      )
    );
  });
  if (!source || !privateSourceByteRetentionGranted(source)) {
    throw new Error(
      `${item.discoveryId}/${item.retailer} private source-byte retention is not explicitly granted.`,
    );
  }
  return source;
}

function expectedEvidencePath(discoveryId: string, retailer: string) {
  const slug = retailerSlug(retailer);
  if (!slug) throw new Error('Retailer name cannot form an evidence path.');
  return `${researchOfferCaptureEvidenceDirectory}/${discoveryId}--${slug}.json`;
}

function positivePacketCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximumResearchOfferCapturePackets) {
    throw new Error(`Offer capture batch must be between 1 and ${maximumResearchOfferCapturePackets} packets.`);
  }
}

function captureObservation(value: DiscoveryRetailerObservation): CaptureDiscoveryObservation {
  const observation = value as CaptureDiscoveryObservation;
  if (
    !Number.isSafeInteger(observation.sourceProductId)
    || observation.sourceProductId <= 0
    || typeof observation.sourceProductApiUrl !== 'string'
  ) {
    throw new Error(`${observation.retailer} observation lacks an exact source product API endpoint.`);
  }
  return observation;
}

/**
 * Joins the checked-in private packet selection back to its snapshot-bound
 * observation. It cannot create a catalogue candidate or publication record.
 */
export function buildResearchOfferCapturePlan(
  packetManifest: CatalogueResearchEvidencePacketManifest,
  snapshot: CatalogueDiscoverySnapshot,
  packetCount: number,
): ResearchOfferCapturePlanItem[] {
  assertPrivateResearchEvidencePacketManifest(packetManifest);
  auditCatalogueDiscoverySnapshot(snapshot);
  positivePacketCount(packetCount);
  if (packetCount > packetManifest.packets.length) {
    throw new Error('Offer capture batch exceeds the checked-in research packet selection.');
  }

  const plan: ResearchOfferCapturePlanItem[] = [];
  const evidencePaths = new Set<string>();
  for (const packet of packetManifest.packets.slice(0, packetCount)) {
    if (packet.source !== 'static-priority') {
      throw new Error('Offer capture accepts only snapshot-bound static research packets.');
    }
    const candidate = snapshot.candidates.find(item => item.discoveryId === packet.productLead.discoveryId);
    if (!candidate) throw new Error(`Research packet ${packet.id} is absent from its discovery snapshot.`);

    for (const rawObservation of candidate.retailerObservations) {
      const packetObservation = packet.discoveryEvidence.observations.find(item =>
        item.retailer === rawObservation.retailer
        && sameExactUrl(item.listingUrl, rawObservation.listingUrl));
      if (
        !packetObservation
        || packetObservation.retailerStatus !== rawObservation.retailerStatus
        || packetObservation.sourceProductId !== rawObservation.sourceProductId
        || !sameExactUrl(
          packetObservation.sourceProductApiUrl,
          rawObservation.sourceProductApiUrl,
        )
        || normalizedText(packetObservation.observedTitle)
          !== normalizedText(rawObservation.observedTitle)
        || normalizedText(packetObservation.observedSize)
          !== normalizedText(rawObservation.observedSize)
      ) {
        throw new Error(`${candidate.discoveryId}/${rawObservation.retailer} is not bound to the research packet.`);
      }
      const observation = captureObservation(rawObservation);
      const item: ResearchOfferCapturePlanItem = {
        packetId: packet.id,
        discoveryId: candidate.discoveryId,
        retailer: observation.retailer,
        retailerStatus: observation.retailerStatus,
        listingUrl: observation.listingUrl,
        sourceProductId: observation.sourceProductId,
        sourceProductApiUrl: observation.sourceProductApiUrl,
        expectedTitle: observation.observedTitle,
        expectedSize: observation.observedSize,
        evidencePath: expectedEvidencePath(candidate.discoveryId, observation.retailer),
      };
      assertCaptureRoute(item);
      assertPrivateSourceByteRetention(item);
      if (evidencePaths.has(item.evidencePath)) {
        throw new Error(`${item.discoveryId}/${item.retailer} collides with another retained evidence path.`);
      }
      evidencePaths.add(item.evidencePath);
      plan.push(item);
    }
  }
  if (!plan.length) throw new Error('Offer capture plan has no exact retailer observations.');
  return plan;
}

function productPrice(product: WooStoreProduct) {
  if (product.prices?.currency_code !== 'NGN' || typeof product.prices.price !== 'string') {
    throw new Error('Offer response does not contain an NGN price.');
  }
  const raw = Number(product.prices.price);
  const minorUnit = product.prices.currency_minor_unit ?? 0;
  if (!Number.isSafeInteger(raw) || raw <= 0 || !Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 2) {
    throw new Error('Offer response contains an invalid price.');
  }
  const amount = raw / 10 ** minorUnit;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Offer response price is not a whole naira amount.');
  return amount;
}

function productStock(product: WooStoreProduct): DiscoveryRetailerObservation['stock'] {
  const value = `${product.stock_availability?.class ?? ''} ${product.stock_availability?.text ?? ''}`.toLowerCase();
  if (/out[ -]?of[ -]?stock|sold out|unavailable/.test(value) || product.is_in_stock === false) return 'out-of-stock';
  if (/low[ -]?stock|only\s+\d+\s+left/.test(value) || (product.low_stock_remaining ?? 0) > 0) return 'low-stock';
  if (/in[ -]?stock|available/.test(value) || product.is_in_stock === true) return 'in-stock';
  return 'unknown';
}

function captureId(item: ResearchOfferCapturePlanItem, responseSha256: string) {
  return sha256(
    `jelocare-private-retained-offer-v1\n${item.packetId}\n${item.discoveryId}\n`
    + `${item.retailer}\n${item.sourceProductId}\n${responseSha256}\n`,
  ).slice(0, 24);
}

async function boundedResponseBytes(response: Response, maximumBytes: number) {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error('Offer response exceeded the retained evidence byte limit.');
  }
  if (!response.body) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let byteSize = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      byteSize += chunk.byteLength;
      if (byteSize > maximumBytes) {
        await reader.cancel();
        throw new Error('Offer response exceeded the retained evidence byte limit.');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, byteSize);
}

export async function captureResearchOfferResponse(
  item: ResearchOfferCapturePlanItem,
  options: {
    fetchImpl?: typeof fetch;
    capturedAt?: string;
    maximumResponseBytes?: number;
  } = {},
): Promise<CapturedResearchOfferResponse> {
  assertCaptureRoute(item);
  assertPrivateSourceByteRetention(item);
  const fetchImpl = options.fetchImpl ?? fetch;
  const maximumResponseBytes = options.maximumResponseBytes ?? maximumResearchOfferResponseBytes;
  if (!Number.isSafeInteger(maximumResponseBytes) || maximumResponseBytes < 1) {
    throw new Error('Offer response byte limit is invalid.');
  }
  const response = await fetchImpl(item.sourceProductApiUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'JeloCarePrivateOfferEvidence/1.0 (+https://jelocare.com)',
    },
  });
  if (!response.ok) throw new Error(`${item.retailer} offer endpoint returned HTTP ${response.status}.`);

  const responseMimeType = response.headers.get('content-type') ?? '';
  if (!/^application\/json(?:;|$)/i.test(responseMimeType)) {
    throw new Error(`${item.retailer} offer endpoint did not return JSON.`);
  }
  const responseUrl = response.url || item.sourceProductApiUrl;
  const responseRouteItem = { ...item, sourceProductApiUrl: responseUrl };
  assertCaptureRoute(responseRouteItem);

  const responseBytes = await boundedResponseBytes(response, maximumResponseBytes);
  if (!responseBytes.byteLength) throw new Error(`${item.retailer} offer endpoint returned an empty response.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBytes.toString('utf8'));
  } catch {
    throw new Error(`${item.retailer} offer endpoint returned malformed JSON.`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${item.retailer} offer endpoint did not return one product.`);
  }
  const product = parsed as WooStoreProduct;
  if (product.id !== item.sourceProductId) throw new Error(`${item.retailer} offer response product id changed.`);
  if (typeof product.permalink !== 'string' || exactUrl(product.permalink) !== exactUrl(item.listingUrl)) {
    throw new Error(`${item.retailer} offer response permalink does not match the retained listing.`);
  }

  const title = decodeHtml(product.name ?? '');
  if (!title || normalizedText(title) !== normalizedText(item.expectedTitle)) {
    throw new Error(`${item.retailer} offer response title does not match the discovery observation.`);
  }
  const size = measuredSize(title);
  if (!size || normalizedText(size) !== normalizedText(item.expectedSize)) {
    throw new Error(`${item.retailer} offer response size does not match the discovery observation.`);
  }
  const amount = productPrice(product);
  const stock = productStock(product);
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error('Offer capture time is invalid.');
  const responseSha256 = sha256(responseBytes);
  const retailerSku = product.sku?.trim()
    ? {
      value: product.sku.trim(),
      treatment: 'retailer-local-code-not-manufacturer-identity' as const,
    }
    : null;

  return {
    responseBytes,
    record: {
      id: captureId(item, responseSha256),
      packetId: item.packetId,
      discoveryId: item.discoveryId,
      retailer: item.retailer,
      retailerStatus: item.retailerStatus,
      publicationStatus: researchOfferCapturePublicationStatus,
      publicationAuthority: researchOfferCapturePublicationAuthority,
      identityAuthority: 'none',
      evidencePath: item.evidencePath,
      source: {
        productId: item.sourceProductId,
        requestedUrl: item.sourceProductApiUrl,
        responseUrl,
        listingUrl: item.listingUrl,
        capturedAt,
        responseSha256,
        responseByteSize: responseBytes.byteLength,
        responseMimeType: 'application/json',
      },
      offer: {
        title,
        size,
        price: { amount, currency: 'NGN' },
        stock,
        retailerSku,
      },
    },
  };
}

export function buildResearchOfferCaptureManifest(input: {
  researchPacketsSha256: string;
  discoverySnapshotSha256: string;
  packetIds: string[];
  captured: CapturedResearchOfferResponse[];
  qualityCautions?: ResearchOfferQualityCaution[];
  generatedAt?: string;
}): ResearchOfferCaptureManifest {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const captures = input.captured.map(item => item.record).sort((left, right) =>
    left.packetId.localeCompare(right.packetId)
    || left.retailer.localeCompare(right.retailer)
    || left.id.localeCompare(right.id));
  const manifest: ResearchOfferCaptureManifest = {
    schemaVersion: researchOfferCaptureSchemaVersion,
    policy: researchOfferCapturePolicy,
    publicationStatus: researchOfferCapturePublicationStatus,
    publicationAuthority: researchOfferCapturePublicationAuthority,
    generatedAt,
    source: {
      researchPacketsSha256: input.researchPacketsSha256,
      discoverySnapshotSha256: input.discoverySnapshotSha256,
    },
    selection: {
      packetCount: input.packetIds.length,
      packetIds: [...input.packetIds],
      responseCount: captures.length,
    },
    qualityCautions: [...(input.qualityCautions ?? [])].sort((left, right) =>
      left.captureId.localeCompare(right.captureId)
      || left.kind.localeCompare(right.kind)),
    captures,
  };
  return assertPrivateResearchOfferCaptureManifest(manifest);
}

/**
 * Reopens the manifest against the exact packet-derived plan. This prevents a
 * valid-looking retained response from being reassigned to another packet,
 * retailer record, listing, title, or size after capture.
 */
export function assertResearchOfferCaptureManifestMatchesPlan(
  manifest: ResearchOfferCaptureManifest,
  plan: ResearchOfferCapturePlanItem[],
) {
  assertPrivateResearchOfferCaptureManifest(manifest);
  if (manifest.captures.length !== plan.length) {
    throw new Error('Retained offer manifest does not cover its packet-derived capture plan.');
  }
  const planByPath = new Map(plan.map(item => [item.evidencePath, item]));
  if (planByPath.size !== plan.length) {
    throw new Error('Packet-derived capture plan contains duplicate evidence paths.');
  }
  for (const capture of manifest.captures) {
    const item = planByPath.get(capture.evidencePath);
    if (
      !item
      || capture.packetId !== item.packetId
      || capture.discoveryId !== item.discoveryId
      || capture.retailer !== item.retailer
      || capture.retailerStatus !== item.retailerStatus
      || capture.source.productId !== item.sourceProductId
      || !sameExactUrl(capture.source.requestedUrl, item.sourceProductApiUrl)
      || !sameExactUrl(capture.source.listingUrl, item.listingUrl)
      || normalizedText(capture.offer.title)
        !== normalizedText(item.expectedTitle)
      || normalizedText(capture.offer.size)
        !== normalizedText(item.expectedSize)
    ) {
      throw new Error('Retained offer manifest drifted from its packet-derived capture plan.');
    }
  }
  return manifest;
}

function validIso(value: string) {
  return Number.isFinite(Date.parse(value));
}

function assertCaptureRecord(capture: ResearchOfferCaptureRecord, packetIds: Set<string>) {
  if (
    !shortDigestPattern.test(capture.id)
    || !shortDigestPattern.test(capture.packetId)
    || !shortDigestPattern.test(capture.discoveryId)
    || !packetIds.has(capture.packetId)
    || !capture.retailer.trim()
    || !['directory-listed', 'provisional'].includes(capture.retailerStatus)
    || capture.publicationStatus !== researchOfferCapturePublicationStatus
    || capture.publicationAuthority !== researchOfferCapturePublicationAuthority
    || capture.identityAuthority !== 'none'
    || capture.evidencePath !== expectedEvidencePath(capture.discoveryId, capture.retailer)
    || !Number.isSafeInteger(capture.source.productId)
    || capture.source.productId <= 0
    || !validIso(capture.source.capturedAt)
    || !digestPattern.test(capture.source.responseSha256)
    || !Number.isSafeInteger(capture.source.responseByteSize)
    || capture.source.responseByteSize < 1
    || capture.source.responseByteSize > maximumResearchOfferResponseBytes
    || capture.source.responseMimeType !== 'application/json'
    || !capture.offer.title.trim()
    || !capture.offer.size.trim()
    || !Number.isSafeInteger(capture.offer.price.amount)
    || capture.offer.price.amount <= 0
    || capture.offer.price.currency !== 'NGN'
    || !['in-stock', 'low-stock', 'out-of-stock', 'unknown'].includes(capture.offer.stock)
  ) {
    throw new Error('Private offer capture record is invalid or has publication authority.');
  }
  assertCaptureRoute({
    packetId: capture.packetId,
    discoveryId: capture.discoveryId,
    retailer: capture.retailer,
    retailerStatus: capture.retailerStatus,
    listingUrl: capture.source.listingUrl,
    sourceProductId: capture.source.productId,
    sourceProductApiUrl: capture.source.requestedUrl,
    expectedTitle: capture.offer.title,
    expectedSize: capture.offer.size,
    evidencePath: capture.evidencePath,
  });
  assertPrivateSourceByteRetention({
    packetId: capture.packetId,
    discoveryId: capture.discoveryId,
    retailer: capture.retailer,
    retailerStatus: capture.retailerStatus,
    listingUrl: capture.source.listingUrl,
    sourceProductId: capture.source.productId,
    sourceProductApiUrl: capture.source.requestedUrl,
    expectedTitle: capture.offer.title,
    expectedSize: capture.offer.size,
    evidencePath: capture.evidencePath,
  });
  let responseRoute: URL;
  let requestedRoute: URL;
  try {
    responseRoute = new URL(capture.source.responseUrl);
    requestedRoute = new URL(capture.source.requestedUrl);
  } catch {
    throw new Error('Private offer capture response route or digest binding is invalid.');
  }
  if (
    normalizedHost(responseRoute.hostname) !== normalizedHost(requestedRoute.hostname)
    || responseRoute.protocol !== 'https:'
    || responseRoute.port !== requestedRoute.port
    || responseRoute.username !== ''
    || responseRoute.password !== ''
    || !productApiRoute(responseRoute, capture.source.productId)
    || capture.id !== captureId({
      packetId: capture.packetId,
      discoveryId: capture.discoveryId,
      retailer: capture.retailer,
      retailerStatus: capture.retailerStatus,
      listingUrl: capture.source.listingUrl,
      sourceProductId: capture.source.productId,
      sourceProductApiUrl: capture.source.requestedUrl,
      expectedTitle: capture.offer.title,
      expectedSize: capture.offer.size,
      evidencePath: capture.evidencePath,
    }, capture.source.responseSha256)
  ) throw new Error('Private offer capture response route or digest binding is invalid.');
  if (capture.offer.retailerSku && (
    !capture.offer.retailerSku.value.trim()
    || capture.offer.retailerSku.treatment !== 'retailer-local-code-not-manufacturer-identity'
  )) throw new Error('Retailer SKU was promoted beyond retailer-local evidence.');
}

export function assertPrivateResearchOfferCaptureManifest(value: ResearchOfferCaptureManifest) {
  if (
    value.schemaVersion !== researchOfferCaptureSchemaVersion
    || value.policy !== researchOfferCapturePolicy
    || value.publicationStatus !== researchOfferCapturePublicationStatus
    || value.publicationAuthority !== researchOfferCapturePublicationAuthority
    || !validIso(value.generatedAt)
    || !digestPattern.test(value.source.researchPacketsSha256)
    || !digestPattern.test(value.source.discoverySnapshotSha256)
    || !Number.isSafeInteger(value.selection.packetCount)
    || value.selection.packetCount < 1
    || value.selection.packetCount > maximumResearchOfferCapturePackets
    || !Array.isArray(value.selection.packetIds)
    || value.selection.packetIds.length !== value.selection.packetCount
    || !Array.isArray(value.captures)
    || value.captures.length < 1
    || value.selection.responseCount !== value.captures.length
    || !Array.isArray(value.qualityCautions)
  ) throw new Error('Offer capture manifest is invalid or has publication authority.');

  const packetIds = new Set(value.selection.packetIds);
  if (packetIds.size !== value.selection.packetIds.length
    || value.selection.packetIds.some(id => !shortDigestPattern.test(id))) {
    throw new Error('Offer capture packet selection is invalid.');
  }
  const captureIds = new Set<string>();
  const evidencePaths = new Set<string>();
  for (const capture of value.captures) {
    assertCaptureRecord(capture, packetIds);
    if (captureIds.has(capture.id) || evidencePaths.has(capture.evidencePath)) {
      throw new Error('Offer capture evidence is duplicated.');
    }
    captureIds.add(capture.id);
    evidencePaths.add(capture.evidencePath);
  }
  const capturesById = new Map(value.captures.map(capture => [capture.id, capture]));
  const qualityCautionKeys = new Set<string>();
  for (const caution of value.qualityCautions) {
    const capture = capturesById.get(caution.captureId);
    const expectedDisposition = caution.kind === 'cross-product-visual'
      ? 'exclude-source-visual-from-all-use'
      : caution.kind === 'description-size-conflict'
        ? 'exclude-description-from-identity-care-and-public-copy'
        : null;
    const key = `${caution.captureId}:${caution.kind}`;
    if (
      !capture
      || capture.source.responseSha256 !== caution.responseSha256
      || expectedDisposition == null
      || caution.disposition !== expectedDisposition
      || caution.basis !== 'retained-response-and-live-listing-review'
      || !validIso(caution.reviewedAt)
      || qualityCautionKeys.has(key)
    ) {
      throw new Error('Offer capture source-quality caution is invalid or stale.');
    }
    qualityCautionKeys.add(key);
  }
  if (Array.from(packetIds).some(id => !value.captures.some(capture => capture.packetId === id))) {
    throw new Error('Offer capture selection contains a packet without retained evidence.');
  }
  return value;
}

async function writeAtomically(filename: string, bytes: Buffer) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, bytes);
  await rename(temporary, filename);
}

function resolvedRepositoryFile(repositoryRoot: string, relativePath: string) {
  const root = path.resolve(repositoryRoot);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Offer evidence path escaped the repository.');
  return resolved;
}

async function readCanonicalResearchOfferEvidence(
  repositoryRoot: string,
  relativePath: string,
) {
  const evidenceRoot = path.resolve(
    repositoryRoot,
    researchOfferCaptureEvidenceDirectory,
  );
  const filename = resolvedRepositoryFile(repositoryRoot, relativePath);
  if (path.dirname(filename) !== evidenceRoot) {
    throw new Error(`Retained offer evidence ${relativePath} escaped its canonical directory.`);
  }
  const stats = await lstat(filename);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Retained offer evidence ${relativePath} is not a regular checked-in file.`);
  }
  const [rootRealPath, fileRealPath] = await Promise.all([
    realpath(evidenceRoot),
    realpath(filename),
  ]);
  if (path.dirname(fileRealPath) !== rootRealPath) {
    throw new Error(`Retained offer evidence ${relativePath} resolves outside its canonical directory.`);
  }
  return readFile(filename);
}

export async function writeResearchOfferCaptureBundle(
  repositoryRoot: string,
  manifest: ResearchOfferCaptureManifest,
  captured: CapturedResearchOfferResponse[],
) {
  assertPrivateResearchOfferCaptureManifest(manifest);
  const responses = new Map(captured.map(item => [item.record.id, item]));
  if (responses.size !== manifest.captures.length) throw new Error('Offer response bytes do not match the manifest.');
  for (const record of manifest.captures) {
    const item = responses.get(record.id);
    if (
      !item
      || JSON.stringify(item.record) !== JSON.stringify(record)
      || item.record.evidencePath !== record.evidencePath
      || sha256(item.responseBytes) !== record.source.responseSha256
      || item.responseBytes.byteLength !== record.source.responseByteSize
    ) throw new Error(`Offer response bytes are missing or changed for ${record.id}.`);
  }
  for (const record of manifest.captures) {
    const item = responses.get(record.id)!;
    await writeAtomically(resolvedRepositoryFile(repositoryRoot, record.evidencePath), item.responseBytes);
  }
  await writeAtomically(
    resolvedRepositoryFile(repositoryRoot, researchOfferCaptureManifestPath),
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  );
}

export async function verifyResearchOfferCaptureBundle(
  repositoryRoot: string,
  manifest: ResearchOfferCaptureManifest,
) {
  assertPrivateResearchOfferCaptureManifest(manifest);
  for (const capture of manifest.captures) {
    const bytes = await readCanonicalResearchOfferEvidence(
      repositoryRoot,
      capture.evidencePath,
    );
    if (
      bytes.byteLength !== capture.source.responseByteSize
      || sha256(bytes) !== capture.source.responseSha256
    ) throw new Error(`Retained offer evidence ${capture.evidencePath} does not match its manifest.`);
    let parsed: WooStoreProduct;
    try {
      parsed = JSON.parse(bytes.toString('utf8')) as WooStoreProduct;
    } catch {
      throw new Error(`Retained offer evidence ${capture.evidencePath} is not the manifested product JSON.`);
    }
    const title = decodeHtml(parsed.name ?? '');
    const sku = parsed.sku?.trim()
      ? {
        value: parsed.sku.trim(),
        treatment: 'retailer-local-code-not-manufacturer-identity' as const,
      }
      : null;
    if (
      parsed.id !== capture.source.productId
      || typeof parsed.permalink !== 'string'
      || exactUrl(parsed.permalink) !== exactUrl(capture.source.listingUrl)
      || title !== capture.offer.title
      || measuredSize(title) !== capture.offer.size
      || productPrice(parsed) !== capture.offer.price.amount
      || productStock(parsed) !== capture.offer.stock
      || JSON.stringify(sku) !== JSON.stringify(capture.offer.retailerSku)
    ) throw new Error(`Retained offer evidence ${capture.evidencePath} does not match its manifested offer.`);
  }
  return {
    packetCount: manifest.selection.packetCount,
    responseCount: manifest.selection.responseCount,
  };
}

export function researchOfferDigest(value: string | Buffer) {
  return sha256(value);
}
