import type { ContributionDraft } from './schema';

export const communityResearchPriorityLane = 'community-first' as const;
export const communityResearchPublicationStatus = 'private-research-only' as const;

export type CommunityResearchTask = {
  taskKind:
    | 'product-identity'
    | 'product-retail-refresh'
    | 'retailer-identity'
    | 'retailer-refresh';
  entityKind: 'product' | 'retailer';
  entityRef: string;
  entityLabel: string;
  entitySource: 'canonical' | 'custom';
  priorityLane: typeof communityResearchPriorityLane;
  publicationStatus: typeof communityResearchPublicationStatus;
  context: {
    contributionKind: ContributionDraft['kind'];
    brands: string[];
    purposes: string[];
    products: string[];
    retailers: string[];
  };
};

export function communityResearchTasks(draft: ContributionDraft): CommunityResearchTask[] {
  const context = {
    contributionKind: draft.kind,
    brands: draft.brands.map(value => value.label),
    purposes: draft.purposes.map(value => value.label),
    products: draft.products.map(value => value.label),
    retailers: draft.retailers.map(value => value.label),
  };
  const tasks: CommunityResearchTask[] = [
    ...draft.products.map(product => ({
      taskKind: product.source === 'custom' ? 'product-identity' as const : 'product-retail-refresh' as const,
      entityKind: 'product' as const,
      entityRef: product.id,
      entityLabel: product.label,
      entitySource: product.source,
      priorityLane: communityResearchPriorityLane,
      publicationStatus: communityResearchPublicationStatus,
      context,
    })),
    ...draft.retailers.map(retailer => ({
      taskKind: retailer.source === 'custom' ? 'retailer-identity' as const : 'retailer-refresh' as const,
      entityKind: 'retailer' as const,
      entityRef: retailer.id,
      entityLabel: retailer.label,
      entitySource: retailer.source,
      priorityLane: communityResearchPriorityLane,
      publicationStatus: communityResearchPublicationStatus,
      context,
    })),
  ];

  return [...new Map(tasks.map(task => [`${task.taskKind}:${task.entityRef}`, task])).values()];
}
