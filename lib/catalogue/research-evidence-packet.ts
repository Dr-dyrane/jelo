import { createHash } from 'node:crypto';
import {
  auditCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
  type DiscoveryResponseEvidence,
  type ScreenedDiscoveryCandidate,
} from './discovery-screening';
import {
  catalogueResearchQueuePolicy,
  type CatalogueResearchQueue,
  type CatalogueResearchQueueItem,
} from './research-priority';

/**
 * A research evidence packet is deliberately not a catalogue record. It is a
 * bounded, private checklist which makes the next evidence capture explicit
 * without giving a discovery lead a route into a public surface.
 */
export const catalogueResearchEvidencePacketSchemaVersion = 1 as const;
export const catalogueResearchEvidencePacketPolicy = 'private-evidence-packet-only' as const;
export const catalogueResearchEvidencePacketPublicationStatus = 'not-a-catalogue-candidate' as const;
export const maximumCatalogueResearchPacketBatch = 12;

const hashPattern = /^[0-9a-f]{64}$/;
const discoveryIdPattern = /^[0-9a-f]{24}$/;

type EmptyEvidenceSlot = {
  status: 'uncollected';
  requiredFor: 'candidate-intake-only';
};

export type ResearchEvidenceProofSlots = {
  officialIdentity: EmptyEvidenceSlot & {
    officialProductUrl: null;
    manufacturerGtin: null;
    exactVariant: null;
    exactSize: null;
    sourceResponseSha256: null;
    reviewedAt: null;
  };
  care: EmptyEvidenceSlot & {
    manufacturerFormulaUrl: null;
    independentGuidanceUrl: null;
    reviewedAt: null;
  };
  exactNigeriaOffers: EmptyEvidenceSlot & {
    offers: [];
  };
  rightsAndSourceBytes: EmptyEvidenceSlot & {
    rightsStatus: null;
    rightsSourceUrl: null;
    sourceAssetUrl: null;
    sourceResponseSha256: null;
    sourceResponseByteSize: null;
  };
  finalImage: EmptyEvidenceSlot & {
    publicImageUrl: null;
    imageSha256: null;
    imageWidth: null;
    imageHeight: null;
    imageHasAlpha: null;
    packaging: null;
    presentationQuality: null;
  };
  generation: EmptyEvidenceSlot & {
    provider: null;
    model: null;
    prompt: null;
    outputSha256: null;
    generatedAt: null;
  };
};

export type RetailerCodeLead = {
  retailer: string;
  value: string;
  responseEvidenceId: string;
  treatment: 'retailer-local-code-not-manufacturer-identity';
};

export type StaticResearchEvidencePacket = {
  id: string;
  source: 'static-priority';
  publicationStatus: typeof catalogueResearchEvidencePacketPublicationStatus;
  research: {
    rank: number;
    lane: CatalogueResearchQueueItem['lane'];
    priorityScore: number;
    reasons: CatalogueResearchQueueItem['reasons'];
    cautions: CatalogueResearchQueueItem['cautions'];
    nextAction: CatalogueResearchQueueItem['nextAction'];
  };
  productLead: {
    discoveryId: string;
    title: string;
    brandHint: string;
    size: string;
    categoryHint: ScreenedDiscoveryCandidate['categoryHint'];
    identityStatus: 'unverified-retailer-lead';
    careStatus: 'not-reviewed';
    imageStatus: ScreenedDiscoveryCandidate['imageStatus'];
  };
  discoveryEvidence: {
    sourceSnapshotSha256: string;
    observations: Array<{
      retailer: string;
      retailerStatus: 'directory-listed' | 'provisional';
      listingUrl: string;
      sourceProductId: number;
      sourceProductApiUrl: string;
      observedAt: string;
      observedTitle: string;
      observedSize: string;
      priceNgn: number;
      stock: 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown';
      imageUrl?: string;
      response: Pick<DiscoveryResponseEvidence,
        'id' | 'retailer' | 'requestedUrl' | 'responseUrl' | 'retrievedAt' | 'responseSha256' | 'responseByteSize' | 'responseMimeType'>;
    }>;
    retailerCodeLeads: RetailerCodeLead[];
  };
  proofSlots: ResearchEvidenceProofSlots;
};

export type CommunityAggregateResearchTask = {
  taskKind: 'product-identity' | 'product-retail-refresh';
  entityKind: 'product';
  entityLabel: string;
  entitySource: 'canonical' | 'custom';
  priorityLane: 'community-first';
  signalCount: number;
  status: string;
  lastSeenAt: string;
  publicationStatus: 'private-research-only';
  identity?: {
    canonicalSlug?: string | null;
    brand?: string | null;
    name?: string | null;
    size?: string | null;
  };
};

export type CommunityAggregateResearchReport = {
  generatedAt: string;
  researchQueue: CommunityAggregateResearchTask[];
};

export type CommunityResearchEvidencePacket = {
  id: string;
  source: 'community-aggregate';
  publicationStatus: typeof catalogueResearchEvidencePacketPublicationStatus;
  research: {
    taskKind: CommunityAggregateResearchTask['taskKind'];
    entitySource: CommunityAggregateResearchTask['entitySource'];
    signalCount: number;
    lastSeenAt: string;
    status: string;
  };
  productLead: {
    title: string;
    brandHint: string | null;
    size: string | null;
    canonicalSlug: string | null;
    identityStatus: 'community-reported-unverified';
    careStatus: 'not-reviewed';
    imageStatus: 'not-collected';
  };
  aggregateEvidence: {
    reportGeneratedAt: string;
    reportSha256: string;
    /** No contributor, draft, or submission identifier is retained here. */
    privacy: 'aggregate-task-only-no-contributor-identifiers';
  };
  proofSlots: ResearchEvidenceProofSlots;
};

export type ResearchEvidencePacket = StaticResearchEvidencePacket | CommunityResearchEvidencePacket;

export type CatalogueResearchEvidencePacketManifest = {
  schemaVersion: typeof catalogueResearchEvidencePacketSchemaVersion;
  policy: typeof catalogueResearchEvidencePacketPolicy;
  publicationStatus: typeof catalogueResearchEvidencePacketPublicationStatus;
  generatedAt: string;
  selection: {
    source: 'static-priority' | 'community-aggregate';
    mode: 'single' | 'batch';
    requestedCount: number;
  };
  source: {
    staticQueueSha256?: string;
    discoverySnapshotSha256?: string;
    communityReportSha256?: string;
  };
  packets: ResearchEvidencePacket[];
};

export type StaticResearchPacketRequest =
  | { mode: 'single'; discoveryId: string }
  | { mode: 'batch'; count: number };

export type CommunityResearchPacketRequest =
  | { mode: 'single'; label: string }
  | { mode: 'batch'; count: number };

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function packetId(source: string, identity: string) {
  return sha256(`jelocare-private-research-evidence-packet-v1\n${source}\n${identity}\n`).slice(0, 24);
}

function validIso(value: string) {
  return Number.isFinite(Date.parse(value));
}

function validHttps(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function assertHash(value: string | undefined, label: string) {
  if (!value || !hashPattern.test(value)) throw new Error(`${label} must be a SHA-256 digest.`);
}

function assertRequestedCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximumCatalogueResearchPacketBatch) {
    throw new Error(`Research packet batch must be between 1 and ${maximumCatalogueResearchPacketBatch}.`);
  }
}

function emptyProofSlots(): ResearchEvidenceProofSlots {
  return {
    officialIdentity: {
      status: 'uncollected', requiredFor: 'candidate-intake-only', officialProductUrl: null,
      manufacturerGtin: null, exactVariant: null, exactSize: null, sourceResponseSha256: null, reviewedAt: null,
    },
    care: {
      status: 'uncollected', requiredFor: 'candidate-intake-only', manufacturerFormulaUrl: null,
      independentGuidanceUrl: null, reviewedAt: null,
    },
    exactNigeriaOffers: { status: 'uncollected', requiredFor: 'candidate-intake-only', offers: [] },
    rightsAndSourceBytes: {
      status: 'uncollected', requiredFor: 'candidate-intake-only', rightsStatus: null,
      rightsSourceUrl: null, sourceAssetUrl: null, sourceResponseSha256: null, sourceResponseByteSize: null,
    },
    finalImage: {
      status: 'uncollected', requiredFor: 'candidate-intake-only', publicImageUrl: null,
      imageSha256: null, imageWidth: null, imageHeight: null, imageHasAlpha: null,
      packaging: null, presentationQuality: null,
    },
    generation: {
      status: 'uncollected', requiredFor: 'candidate-intake-only', provider: null,
      model: null, prompt: null, outputSha256: null, generatedAt: null,
    },
  };
}

function staticQueueItem(queue: CatalogueResearchQueue, request: StaticResearchPacketRequest) {
  if (queue.policy !== catalogueResearchQueuePolicy) throw new Error('Static research queue is not private research only.');
  if (request.mode === 'single') {
    if (!discoveryIdPattern.test(request.discoveryId)) throw new Error('Static packet discovery id is invalid.');
    const item = queue.items.find(candidate => candidate.discoveryId === request.discoveryId);
    if (!item) throw new Error(`Static research priority ${request.discoveryId} was not found.`);
    return [item];
  }
  assertRequestedCount(request.count);
  return queue.items.slice(0, request.count);
}

function sourceResponse(snapshot: CatalogueDiscoverySnapshot, id: string) {
  const response = snapshot.sourceResponses.find(item => item.id === id);
  if (!response) throw new Error(`Discovery observation references unknown response ${id}.`);
  if (!validHttps(response.requestedUrl) || !validHttps(response.responseUrl)) {
    throw new Error(`Discovery response ${id} has an invalid URL.`);
  }
  assertHash(response.responseSha256, `Discovery response ${id}`);
  if (!validIso(response.retrievedAt) || response.responseByteSize <= 0 || response.responseMimeType !== 'application/json') {
    throw new Error(`Discovery response ${id} is not traceable.`);
  }
  return response;
}

function staticPacket(
  item: CatalogueResearchQueueItem,
  candidate: ScreenedDiscoveryCandidate,
  snapshot: CatalogueDiscoverySnapshot,
  sourceSnapshotSha256: string,
): StaticResearchEvidencePacket {
  if (candidate.publicationStatus !== 'private-discovery-only' || candidate.identityStatus !== 'unverified-retailer-lead') {
    throw new Error(`${candidate.discoveryId} is not a private discovery lead.`);
  }
  if (candidate.careStatus !== 'not-reviewed' || !['source-url-unreviewed', 'missing'].includes(candidate.imageStatus)) {
    throw new Error(`${candidate.discoveryId} has an unexpected research state.`);
  }
  const observations = candidate.retailerObservations.map(observation => {
    const response = sourceResponse(snapshot, observation.responseEvidenceId);
    if (
      !validHttps(observation.listingUrl)
      || !Number.isSafeInteger(observation.sourceProductId)
      || (observation.sourceProductId ?? 0) <= 0
      || !validHttps(observation.sourceProductApiUrl ?? '')
      || !validIso(observation.observedAt)
      || observation.priceNgn <= 0
    ) {
      throw new Error(`${candidate.discoveryId} has an untraceable retailer observation.`);
    }
    return {
      retailer: observation.retailer,
      retailerStatus: observation.retailerStatus,
      listingUrl: observation.listingUrl,
      sourceProductId: observation.sourceProductId!,
      sourceProductApiUrl: observation.sourceProductApiUrl!,
      observedAt: observation.observedAt,
      observedTitle: observation.observedTitle,
      observedSize: observation.observedSize,
      priceNgn: observation.priceNgn,
      stock: observation.stock,
      ...(observation.imageUrl ? { imageUrl: observation.imageUrl } : {}),
      response: {
        id: response.id,
        retailer: response.retailer,
        requestedUrl: response.requestedUrl,
        responseUrl: response.responseUrl,
        retrievedAt: response.retrievedAt,
        responseSha256: response.responseSha256,
        responseByteSize: response.responseByteSize,
        responseMimeType: response.responseMimeType,
      },
    };
  });
  const retailerCodeLeads = candidate.retailerObservations.flatMap(observation => observation.retailerSku
    ? [{
      retailer: observation.retailer,
      value: observation.retailerSku,
      responseEvidenceId: observation.responseEvidenceId,
      treatment: 'retailer-local-code-not-manufacturer-identity' as const,
    }]
    : []);
  return {
    id: packetId('static', candidate.discoveryId),
    source: 'static-priority',
    publicationStatus: catalogueResearchEvidencePacketPublicationStatus,
    research: {
      rank: item.rank,
      lane: item.lane,
      priorityScore: item.priorityScore,
      reasons: [...item.reasons],
      cautions: [...item.cautions],
      nextAction: item.nextAction,
    },
    productLead: {
      discoveryId: candidate.discoveryId,
      title: candidate.title,
      brandHint: candidate.brandHint,
      size: candidate.size,
      categoryHint: candidate.categoryHint,
      identityStatus: candidate.identityStatus,
      careStatus: candidate.careStatus,
      imageStatus: candidate.imageStatus,
    },
    discoveryEvidence: {
      sourceSnapshotSha256,
      observations,
      retailerCodeLeads,
    },
    proofSlots: emptyProofSlots(),
  };
}

function sourceSnapshotDigestFromQueue(queue: CatalogueResearchQueue) {
  assertHash(queue.sourceSnapshot.sha256, 'Static research queue snapshot');
  return queue.sourceSnapshot.sha256;
}

export function buildStaticResearchEvidencePacketManifest(
  queue: CatalogueResearchQueue,
  snapshot: CatalogueDiscoverySnapshot,
  queueSha256: string,
  snapshotSha256: string,
  request: StaticResearchPacketRequest,
): CatalogueResearchEvidencePacketManifest {
  auditCatalogueDiscoverySnapshot(snapshot);
  assertHash(queueSha256, 'Static research queue');
  assertHash(snapshotSha256, 'Discovery snapshot');
  const sourceSnapshotSha256 = sourceSnapshotDigestFromQueue(queue);
  // The queue is bound to raw snapshot bytes. JSON object serialization cannot replace that
  // binding, so callers must provide the exact raw snapshot digest.
  if (sourceSnapshotSha256 !== snapshotSha256) {
    throw new Error('Static research queue does not match the supplied discovery snapshot bytes.');
  }
  const packets = staticQueueItem(queue, request).map(item => {
    const candidate = snapshot.candidates.find(value => value.discoveryId === item.discoveryId);
    if (!candidate) throw new Error(`Research priority ${item.discoveryId} is absent from discovery evidence.`);
    return staticPacket(item, candidate, snapshot, sourceSnapshotSha256);
  });
  return {
    schemaVersion: catalogueResearchEvidencePacketSchemaVersion,
    policy: catalogueResearchEvidencePacketPolicy,
    publicationStatus: catalogueResearchEvidencePacketPublicationStatus,
    generatedAt: queue.generatedAt,
    selection: {
      source: 'static-priority',
      mode: request.mode,
      requestedCount: request.mode === 'single' ? 1 : request.count,
    },
    source: { staticQueueSha256: queueSha256, discoverySnapshotSha256: sourceSnapshotSha256 },
    packets,
  };
}

function communityTaskIdentity(task: CommunityAggregateResearchTask) {
  return [task.taskKind, task.entitySource, task.identity?.canonicalSlug ?? '', task.identity?.brand ?? '', task.identity?.name ?? task.entityLabel, task.identity?.size ?? '']
    .join('|');
}

function hasForbiddenCommunityIdentifier(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenCommunityIdentifier);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) => (
    /^(?:contributor|contribution|submission|draft|email|phone|contact|user|session)/i.test(key)
    || hasForbiddenCommunityIdentifier(nested)
  ));
}

function assertCommunityTask(task: CommunityAggregateResearchTask) {
  if (hasForbiddenCommunityIdentifier(task)) throw new Error('Community report task contains a contributor identifier.');
  if (!['product-identity', 'product-retail-refresh'].includes(task.taskKind) || task.entityKind !== 'product') {
    throw new Error('Community report task is not a product research task.');
  }
  if (!['canonical', 'custom'].includes(task.entitySource) || task.priorityLane !== 'community-first') {
    throw new Error('Community report task has an invalid research source.');
  }
  if (task.publicationStatus !== 'private-research-only' || !Number.isSafeInteger(task.signalCount) || task.signalCount < 1) {
    throw new Error('Community report task is not a private aggregate research signal.');
  }
  if (!task.entityLabel.trim() || !validIso(task.lastSeenAt)) throw new Error('Community report task is malformed.');
}

function communityTasks(report: CommunityAggregateResearchReport, request: CommunityResearchPacketRequest) {
  if (!validIso(report.generatedAt) || !Array.isArray(report.researchQueue)) throw new Error('Community aggregate report is invalid.');
  const tasks = report.researchQueue.filter(task => task.entityKind === 'product');
  tasks.forEach(assertCommunityTask);
  const ordered = [...tasks].sort((left, right) => right.signalCount - left.signalCount
    || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
    || left.entityLabel.localeCompare(right.entityLabel));
  if (request.mode === 'single') {
    const task = ordered.find(value => value.entityLabel === request.label);
    if (!task) throw new Error(`Community aggregate research task ${request.label} was not found.`);
    return [task];
  }
  assertRequestedCount(request.count);
  return ordered.slice(0, request.count);
}

export function buildCommunityResearchEvidencePacketManifest(
  report: CommunityAggregateResearchReport,
  rawReport: string | Buffer,
  request: CommunityResearchPacketRequest,
): CatalogueResearchEvidencePacketManifest {
  const reportSha256 = sha256(rawReport);
  const packets = communityTasks(report, request).map((task): CommunityResearchEvidencePacket => ({
    id: packetId('community', communityTaskIdentity(task)),
    source: 'community-aggregate',
    publicationStatus: catalogueResearchEvidencePacketPublicationStatus,
    research: {
      taskKind: task.taskKind,
      entitySource: task.entitySource,
      signalCount: task.signalCount,
      lastSeenAt: task.lastSeenAt,
      status: task.status,
    },
    productLead: {
      title: task.identity?.name ?? task.entityLabel,
      brandHint: task.identity?.brand ?? null,
      size: task.identity?.size ?? null,
      canonicalSlug: task.identity?.canonicalSlug ?? null,
      identityStatus: 'community-reported-unverified',
      careStatus: 'not-reviewed',
      imageStatus: 'not-collected',
    },
    aggregateEvidence: {
      reportGeneratedAt: report.generatedAt,
      reportSha256,
      privacy: 'aggregate-task-only-no-contributor-identifiers',
    },
    proofSlots: emptyProofSlots(),
  }));
  return {
    schemaVersion: catalogueResearchEvidencePacketSchemaVersion,
    policy: catalogueResearchEvidencePacketPolicy,
    publicationStatus: catalogueResearchEvidencePacketPublicationStatus,
    generatedAt: report.generatedAt,
    selection: {
      source: 'community-aggregate',
      mode: request.mode,
      requestedCount: request.mode === 'single' ? 1 : request.count,
    },
    source: { communityReportSha256: reportSha256 },
    packets,
  };
}

function allProofSlotsUncollected(slots: ResearchEvidenceProofSlots) {
  return slots.officialIdentity.status === 'uncollected'
    && slots.officialIdentity.requiredFor === 'candidate-intake-only'
    && slots.officialIdentity.officialProductUrl === null
    && slots.officialIdentity.manufacturerGtin === null
    && slots.officialIdentity.exactVariant === null
    && slots.officialIdentity.exactSize === null
    && slots.officialIdentity.sourceResponseSha256 === null
    && slots.officialIdentity.reviewedAt === null
    && slots.care.status === 'uncollected'
    && slots.care.requiredFor === 'candidate-intake-only'
    && slots.care.manufacturerFormulaUrl === null
    && slots.care.independentGuidanceUrl === null
    && slots.care.reviewedAt === null
    && slots.exactNigeriaOffers.status === 'uncollected'
    && slots.exactNigeriaOffers.requiredFor === 'candidate-intake-only'
    && slots.exactNigeriaOffers.offers.length === 0
    && slots.rightsAndSourceBytes.status === 'uncollected'
    && slots.rightsAndSourceBytes.requiredFor === 'candidate-intake-only'
    && slots.rightsAndSourceBytes.rightsStatus === null
    && slots.rightsAndSourceBytes.rightsSourceUrl === null
    && slots.rightsAndSourceBytes.sourceAssetUrl === null
    && slots.rightsAndSourceBytes.sourceResponseSha256 === null
    && slots.rightsAndSourceBytes.sourceResponseByteSize === null
    && slots.finalImage.status === 'uncollected'
    && slots.finalImage.requiredFor === 'candidate-intake-only'
    && slots.finalImage.publicImageUrl === null
    && slots.finalImage.imageSha256 === null
    && slots.finalImage.imageWidth === null
    && slots.finalImage.imageHeight === null
    && slots.finalImage.imageHasAlpha === null
    && slots.finalImage.packaging === null
    && slots.finalImage.presentationQuality === null
    && slots.generation.status === 'uncollected'
    && slots.generation.requiredFor === 'candidate-intake-only'
    && slots.generation.provider === null
    && slots.generation.model === null
    && slots.generation.prompt === null
    && slots.generation.outputSha256 === null
    && slots.generation.generatedAt === null;
}

/** Ensures a checked-in packet cannot be mistaken for a catalogue intake or a release. */
export function assertPrivateResearchEvidencePacketManifest(manifest: CatalogueResearchEvidencePacketManifest) {
  if (
    manifest.schemaVersion !== catalogueResearchEvidencePacketSchemaVersion
    || manifest.policy !== catalogueResearchEvidencePacketPolicy
    || manifest.publicationStatus !== catalogueResearchEvidencePacketPublicationStatus
    || !validIso(manifest.generatedAt)
    || !Array.isArray(manifest.packets)
    || manifest.packets.length < 1
    || manifest.packets.length > maximumCatalogueResearchPacketBatch
  ) throw new Error('Research evidence packet manifest is invalid or publishable.');
  if (manifest.selection.requestedCount !== manifest.packets.length) {
    throw new Error('Research evidence packet manifest count does not match its packets.');
  }
  if (manifest.selection.source === 'static-priority') {
    assertHash(manifest.source.staticQueueSha256, 'Static packet queue');
    assertHash(manifest.source.discoverySnapshotSha256, 'Static packet discovery snapshot');
  } else assertHash(manifest.source.communityReportSha256, 'Community packet report');

  const ids = new Set<string>();
  for (const packet of manifest.packets) {
    if (!discoveryIdPattern.test(packet.id) || ids.has(packet.id)) throw new Error('Research packet id is invalid or duplicated.');
    ids.add(packet.id);
    if (packet.publicationStatus !== catalogueResearchEvidencePacketPublicationStatus || !allProofSlotsUncollected(packet.proofSlots)) {
      throw new Error('Research evidence packets must remain uncollected and non-publishable.');
    }
    if (packet.source === 'static-priority') {
      if (manifest.selection.source !== 'static-priority' || !discoveryIdPattern.test(packet.productLead.discoveryId)) {
        throw new Error('Static research packet source is invalid.');
      }
      if (!packet.discoveryEvidence.observations.length) throw new Error('Static research packet lacks source observations.');
      for (const observation of packet.discoveryEvidence.observations) {
        if (
          !validHttps(observation.listingUrl)
          || !Number.isSafeInteger(observation.sourceProductId)
          || observation.sourceProductId <= 0
          || !validHttps(observation.sourceProductApiUrl)
          || !validIso(observation.observedAt)
          || !Number.isSafeInteger(observation.priceNgn)
          || observation.priceNgn <= 0
        ) {
          throw new Error('Static research packet contains an invalid exact retailer retrieval locator.');
        }
        const listing = new URL(observation.listingUrl);
        const api = new URL(observation.sourceProductApiUrl);
        if (
          listing.hostname.replace(/^www\./, '').toLowerCase()
            !== api.hostname.replace(/^www\./, '').toLowerCase()
          || api.search
          || api.hash
          || !api.pathname.endsWith(`/wp-json/wc/store/v1/products/${observation.sourceProductId}`)
        ) {
          throw new Error('Static research packet exact retailer retrieval locator is not scoped to its listing.');
        }
      }
      for (const lead of packet.discoveryEvidence.retailerCodeLeads) {
        if (lead.treatment !== 'retailer-local-code-not-manufacturer-identity') {
          throw new Error('Retailer code lead was promoted to product identity.');
        }
      }
    } else if (manifest.selection.source !== 'community-aggregate'
      || packet.aggregateEvidence.privacy !== 'aggregate-task-only-no-contributor-identifiers') {
      throw new Error('Community research packet is not aggregate-only.');
    }
  }
  return manifest;
}
