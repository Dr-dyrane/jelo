export type OverviewQueueKind =
  | "orders"
  | "contributions"
  | "edges"
  | "observations"
  | "vocabulary"
  | "retailers";

export type OverviewQueueDefinition = {
  kind: OverviewQueueKind;
  label: string;
  href: string;
};

// This order is the documented deterministic tie-break for equal oldest
// timestamps. It follows the queue topology, never a hidden priority order.
export const OVERVIEW_QUEUE_ORDER: readonly OverviewQueueKind[] = [
  "orders",
  "contributions",
  "edges",
  "observations",
  "vocabulary",
  "retailers",
];

export const OVERVIEW_QUEUES: readonly OverviewQueueDefinition[] = [
  { kind: "orders", label: "Assisted orders", href: "/ops/orders" },
  { kind: "contributions", label: "Contributions", href: "/ops/contributions" },
  { kind: "edges", label: "Relationships", href: "/ops/edges" },
  { kind: "observations", label: "Observations", href: "/ops/observations" },
  { kind: "vocabulary", label: "Vocabulary", href: "/ops/vocabulary" },
  { kind: "retailers", label: "Retailer applications", href: "/ops/retailers" },
];

export type OverviewQueue = OverviewQueueDefinition & {
  pendingCount: number;
  oldestPendingAt: string | null;
  operatorCanAct: boolean;
  recentDecisions: OverviewRecentDecision[];
};

export type OverviewFeaturedItem = {
  id: string;
  queueKind: OverviewQueueKind;
  queueLabel: string;
  title: string;
  summary: string;
  createdAt: string;
  href: string;
  image: string | null;
};

export type OverviewFeaturedItemFact = {
  id: string;
  queueKind: OverviewQueueKind;
  title: string;
  summary: string;
  createdAt: string;
  image?: string | null;
};

export type OverviewRecentDecision = {
  id: string;
  queueKind: OverviewQueueKind | null;
  description: string;
  targetLabel: string;
  operatorName: string;
  createdAt: string;
  image: string | null;
};

export type OverviewAttentionItem = {
  id: string;
  queueKind: OverviewQueueKind | null;
  title: string;
  summary: string;
  observedAt: string;
  reasonCode: "waiting-time-unavailable" | "market-truth-exception";
  threshold: string;
  owner: string;
  runbook: string;
  actionLabel: string;
  actionHref: string;
};

export type OverviewBriefingReadModel = {
  generatedAt: string;
  pendingTotal: number;
  queues: OverviewQueue[];
  nextAction: {
    queueKind: OverviewQueueKind;
    href: string;
    label: string;
    reasonCode: "oldest-actionable-pending";
    reasonText: string;
  } | null;
  recentDecisions: OverviewRecentDecision[];
  recentDecisionsUnavailable: boolean;
  upNext: OverviewFeaturedItem[];
  upNextUnavailable: boolean;
  attentionItems: OverviewAttentionItem[];
};

export type OverviewQueueFact = Pick<
  OverviewQueue,
  "kind" | "pendingCount" | "oldestPendingAt"
>;

export type OverviewAuditEntry = {
  id: string;
  operatorName: string;
  queue:
    | "community_contribution"
    | "community_edge"
    | "community_observation"
    | "community_moderation_value"
    | "community_research_task"
    | "retailer_application"
    | "market_finder_report"
    | "retailer_location"
    | "physical_product_observation"
    | "commerce_signal";
  action:
    | "claim"
    | "assign"
    | "unassign"
    | "approve"
    | "reject"
    | "map"
    | "promote"
    | "reconcile"
    | "defer"
    | "retry"
    | "note";
  targetLabel?: string;
  createdAt: string;
  image?: string | null;
};

const ACTION_LABELS: Record<OverviewAuditEntry["action"], string> = {
  claim: "Claimed",
  assign: "Assigned",
  unassign: "Unassigned",
  approve: "Approved",
  reject: "Rejected",
  map: "Mapped",
  promote: "Promoted",
  reconcile: "Reconciled",
  defer: "Deferred",
  retry: "Retried",
  note: "Noted",
};

const AUDIT_QUEUE_LABELS: Record<OverviewAuditEntry["queue"], string> = {
  community_contribution: "contribution",
  community_edge: "relationship",
  community_observation: "observation",
  community_moderation_value: "vocabulary item",
  community_research_task: "research task",
  retailer_application: "retailer application",
  market_finder_report: "market report",
  retailer_location: "retailer location",
  physical_product_observation: "market evidence",
  commerce_signal: "commerce signal",
};

const AUDIT_QUEUE_KINDS: Record<
  OverviewAuditEntry["queue"],
  OverviewQueueKind | null
> = {
  community_contribution: "contributions",
  community_edge: "edges",
  community_observation: "observations",
  community_moderation_value: "vocabulary",
  community_research_task: null,
  retailer_application: "retailers",
  market_finder_report: "contributions",
  retailer_location: "contributions",
  physical_product_observation: "contributions",
  commerce_signal: null,
};

export function overviewQueueKindForAuditQueue(
  queue: OverviewAuditEntry["queue"],
): OverviewQueueKind | null {
  return AUDIT_QUEUE_KINDS[queue];
}

function isEarlier(left: string, right: string): boolean {
  return new Date(left).getTime() < new Date(right).getTime();
}

function projectDecision(decision: OverviewAuditEntry): OverviewRecentDecision {
  return {
    id: decision.id,
    queueKind: AUDIT_QUEUE_KINDS[decision.queue],
    description: `${ACTION_LABELS[decision.action]} ${AUDIT_QUEUE_LABELS[decision.queue]}`,
    targetLabel: decision.targetLabel ?? AUDIT_QUEUE_LABELS[decision.queue],
    operatorName: decision.operatorName,
    createdAt: decision.createdAt,
    image: decision.image ?? null,
  };
}

export function buildOverviewBriefing({
  queueFacts,
  actionableQueueKinds,
  oldestItems = [],
  upNextUnavailable = false,
  recentDecisions = [],
  recentDecisionsByQueue = {},
  recentDecisionsUnavailable = false,
  systemAttentionItems = [],
  generatedAt = new Date().toISOString(),
}: {
  queueFacts: readonly OverviewQueueFact[];
  actionableQueueKinds: readonly OverviewQueueKind[];
  oldestItems?: readonly OverviewFeaturedItemFact[];
  upNextUnavailable?: boolean;
  recentDecisions?: readonly OverviewAuditEntry[];
  recentDecisionsByQueue?: Partial<
    Record<OverviewQueueKind, readonly OverviewAuditEntry[]>
  >;
  recentDecisionsUnavailable?: boolean;
  systemAttentionItems?: readonly OverviewAttentionItem[];
  generatedAt?: string;
}): OverviewBriefingReadModel {
  const facts = new Map(queueFacts.map((fact) => [fact.kind, fact]));
  const actionableKinds = new Set(actionableQueueKinds);
  const queues = OVERVIEW_QUEUES.map((definition) => {
    const fact = facts.get(definition.kind);
    return {
      ...definition,
      pendingCount: fact?.pendingCount ?? 0,
      oldestPendingAt: fact?.oldestPendingAt ?? null,
      operatorCanAct: actionableKinds.has(definition.kind),
      recentDecisions: (recentDecisionsByQueue[definition.kind] ?? [])
        .slice(0, 3)
        .map(projectDecision),
    };
  });
  const pendingTotal = queues.reduce(
    (total, queue) => total + queue.pendingCount,
    0,
  );
  const actionable = queues.filter(
    (queue) =>
      queue.operatorCanAct && queue.pendingCount > 0 && queue.oldestPendingAt,
  );
  const nextQueue = actionable.reduce<OverviewQueue | null>(
    (earliest, queue) => {
      if (
        !earliest ||
        isEarlier(queue.oldestPendingAt!, earliest.oldestPendingAt!)
      )
        return queue;
      // Equal dates intentionally retain the first queue in OVERVIEW_QUEUE_ORDER.
      return earliest;
    },
    null,
  );

  return {
    generatedAt,
    pendingTotal,
    queues,
    nextAction: nextQueue
      ? {
          queueKind: nextQueue.kind,
          href: nextQueue.href,
          label: nextQueue.label,
          reasonCode: "oldest-actionable-pending",
          reasonText: "Oldest item waiting",
        }
      : null,
    recentDecisions: recentDecisions.slice(0, 5).map(projectDecision),
    recentDecisionsUnavailable,
    upNext: oldestItems
      // The Overview read model exposes aggregate order facts, not private
      // order records, so keep order recommendations at the canonical queue.
      .filter(
        (item) =>
          item.queueKind === nextQueue?.kind && item.queueKind !== "orders",
      )
      .sort((left, right) => {
        const timeDifference =
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime();
        return timeDifference || left.id.localeCompare(right.id);
      })
      .slice(0, 2)
      .map((item) => {
        const definition = OVERVIEW_QUEUES.find(
          (queue) => queue.kind === item.queueKind,
        )!;
        return {
          id: item.id,
          queueKind: item.queueKind,
          queueLabel: definition.label,
          title: item.title,
          summary: item.summary,
          createdAt: item.createdAt,
          href: `${definition.href}?id=${encodeURIComponent(item.id)}`,
          image: item.image ?? null,
        };
      }),
    upNextUnavailable,
    attentionItems: [
      ...systemAttentionItems,
      ...queues
        .filter((queue) => queue.pendingCount > 0 && !queue.oldestPendingAt)
        .map((queue) => ({
          id: `waiting-time-unavailable:${queue.kind}`,
          queueKind: queue.kind,
          title: `${queue.label} waiting time unavailable`,
          summary: `${queue.pendingCount} ${queue.pendingCount === 1 ? "item is" : "items are"} waiting, but age could not be read.`,
          observedAt: generatedAt,
          reasonCode: "waiting-time-unavailable" as const,
          threshold: "Every waiting item has an immutable queue time",
          owner: "Queue operations",
          runbook: "Operations overview · Queue age recovery",
          actionLabel: queue.operatorCanAct
            ? `Review ${queue.label.toLowerCase()}`
            : `View ${queue.label.toLowerCase()}`,
          actionHref: queue.href,
        })),
    ],
  };
}
