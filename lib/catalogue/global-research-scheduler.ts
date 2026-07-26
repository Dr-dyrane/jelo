import type { CatalogueResearchQueue, CatalogueResearchQueueItem } from './research-priority';

/**
 * A private, read-only projection used to decide what research happens next.
 * It intentionally has no catalogue writer or publication capability.
 */
export const globalResearchSchedulePolicy = 'community-first-private-research-v1' as const;
export const globalResearchPublicationStatus = 'private-research-only' as const;

export type ResearchIdentity = {
  /** The canonical JeloCare product slug, never a retailer SKU. */
  canonicalSlug?: string | null;
  brand?: string | null;
  name?: string | null;
  size?: string | null;
};

export type CommunityResearchPriorityTask = {
  taskKind: 'product-identity' | 'product-retail-refresh' | 'retailer-identity' | 'retailer-refresh';
  entityKind: 'product' | 'retailer';
  entityRef: string;
  entityLabel: string;
  entitySource: 'canonical' | 'custom';
  signalCount: number;
  lastSeenAt: string;
  status: string;
  publicationStatus: typeof globalResearchPublicationStatus;
  identity?: ResearchIdentity;
};

export type StaticResearchPriority = Pick<CatalogueResearchQueueItem,
  'rank' | 'discoveryId' | 'title' | 'brandHint' | 'size' | 'lane' | 'priorityScore' | 'nextAction' | 'publicationStatus'> & {
  /** Present only when a static lead is already bound to a canonical product. */
  canonicalSlug?: string | null;
};

export type GlobalResearchScheduleItem =
  | {
    rank: number;
    source: 'community';
    identity: ResearchIdentity;
    task: CommunityResearchPriorityTask;
    score: { signalCount: number; lastSeenAt: string };
    publicationStatus: typeof globalResearchPublicationStatus;
  }
  | {
    rank: number;
    source: 'static';
    identity: ResearchIdentity;
    task: StaticResearchPriority;
    staticRank: number;
    publicationStatus: typeof globalResearchPublicationStatus;
  };

export type GlobalResearchSchedule = {
  policy: typeof globalResearchSchedulePolicy;
  publicationStatus: typeof globalResearchPublicationStatus;
  generatedFrom: {
    communityTaskCount: number;
    staticTaskCount: number;
    deduplicatedCommunityTaskCount: number;
    deduplicatedStaticTaskCount: number;
  };
  items: GlobalResearchScheduleItem[];
};

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedSlug(value: string) {
  return normalized(value).replace(/\s+/g, '-');
}

function asIsoInstant(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`Research task has an invalid lastSeenAt: ${value}`);
  return time;
}

function assertSignalCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Research task signalCount must be a positive safe integer.');
  }
}

function productSlugFromReference(value: string) {
  const match = /^product:([a-z0-9]+(?:-[a-z0-9]+)*)$/i.exec(value.trim());
  return match?.[1]?.toLowerCase();
}

function identityForCommunity(task: CommunityResearchPriorityTask): ResearchIdentity {
  const fromTask = task.identity ?? {};
  return {
    ...(fromTask.canonicalSlug ? { canonicalSlug: normalizedSlug(fromTask.canonicalSlug) } : {}),
    ...(!fromTask.canonicalSlug && task.entityKind === 'product' && task.entitySource === 'canonical'
      ? { canonicalSlug: productSlugFromReference(task.entityRef) }
      : {}),
    ...(fromTask.brand ? { brand: fromTask.brand } : {}),
    name: fromTask.name ?? task.entityLabel,
    ...(fromTask.size ? { size: fromTask.size } : {}),
  };
}

function identityForStatic(task: StaticResearchPriority): ResearchIdentity {
  return {
    ...(task.canonicalSlug ? { canonicalSlug: normalizedSlug(task.canonicalSlug) } : {}),
    brand: task.brandHint,
    name: task.title,
    size: task.size,
  };
}

/**
 * The keys deliberately require every product identity part. This avoids
 * collapsing two different sizes or variants merely because their titles look
 * alike. Canonical product slugs win whenever they are available.
 */
function identityKeys(identity: ResearchIdentity) {
  const keys: string[] = [];
  if (identity.canonicalSlug) keys.push(`slug:${normalizedSlug(identity.canonicalSlug)}`);
  if (identity.brand && identity.name && identity.size) {
    keys.push(`product:${normalized(identity.brand)}|${normalized(identity.name)}|${normalized(identity.size)}`);
  }
  return keys;
}

function taskKey(task: CommunityResearchPriorityTask) {
  return `task:${task.entityKind}:${normalized(task.entityRef)}:${task.taskKind}`;
}

function compareCommunity(left: CommunityResearchPriorityTask, right: CommunityResearchPriorityTask) {
  return right.signalCount - left.signalCount
    || asIsoInstant(right.lastSeenAt) - asIsoInstant(left.lastSeenAt)
    || left.entityKind.localeCompare(right.entityKind)
    || left.entityLabel.localeCompare(right.entityLabel)
    || left.taskKind.localeCompare(right.taskKind)
    || left.entityRef.localeCompare(right.entityRef);
}

function assertPrivateCommunityTask(task: CommunityResearchPriorityTask) {
  if (task.publicationStatus !== globalResearchPublicationStatus) {
    throw new Error('Community research tasks must remain private-research-only.');
  }
  assertSignalCount(task.signalCount);
  asIsoInstant(task.lastSeenAt);
}

function assertPrivateStaticTask(task: StaticResearchPriority) {
  if (task.publicationStatus !== globalResearchPublicationStatus) {
    throw new Error('Static research priorities must remain private-research-only.');
  }
}

/**
 * Builds the only cross-source priority order. Community material is ordered
 * by independent signal count then recency; unique static discovery priorities
 * retain their checked-in rank after it. The output is deliberately a research
 * projection, never an approval or catalogue input.
 */
export function buildGlobalResearchSchedule(
  communityTasks: readonly CommunityResearchPriorityTask[],
  staticQueue: Pick<CatalogueResearchQueue, 'items'> | readonly StaticResearchPriority[],
): GlobalResearchSchedule {
  const staticTasks: readonly StaticResearchPriority[] = 'items' in staticQueue
    ? staticQueue.items
    : staticQueue;
  const seen = new Set<string>();
  const items: GlobalResearchScheduleItem[] = [];
  let deduplicatedCommunityTaskCount = 0;
  let deduplicatedStaticTaskCount = 0;

  for (const task of [...communityTasks].sort(compareCommunity)) {
    assertPrivateCommunityTask(task);
    const identity = identityForCommunity(task);
    const keys = [taskKey(task), ...identityKeys(identity)];
    if (keys.some(key => seen.has(key))) {
      deduplicatedCommunityTaskCount += 1;
      continue;
    }
    keys.forEach(key => seen.add(key));
    items.push({
      rank: items.length + 1,
      source: 'community',
      identity,
      task,
      score: { signalCount: task.signalCount, lastSeenAt: task.lastSeenAt },
      publicationStatus: globalResearchPublicationStatus,
    });
  }

  for (const task of staticTasks) {
    assertPrivateStaticTask(task);
    const identity = identityForStatic(task);
    const keys = identityKeys(identity);
    if (keys.some(key => seen.has(key))) {
      deduplicatedStaticTaskCount += 1;
      continue;
    }
    keys.forEach(key => seen.add(key));
    items.push({
      rank: items.length + 1,
      source: 'static',
      identity,
      task,
      staticRank: task.rank ?? items.length + 1,
      publicationStatus: globalResearchPublicationStatus,
    });
  }

  return {
    policy: globalResearchSchedulePolicy,
    publicationStatus: globalResearchPublicationStatus,
    generatedFrom: {
      communityTaskCount: communityTasks.length,
      staticTaskCount: staticTasks.length,
      deduplicatedCommunityTaskCount,
      deduplicatedStaticTaskCount,
    },
    items,
  };
}
