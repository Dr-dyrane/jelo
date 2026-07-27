import type { InventoryResult } from './inventory-query';

export const inventoryRefinementGroups = [
  'category',
  'routine',
  'company',
  'concern',
  'source',
  'availability',
  'price',
  'order',
] as const;

export type InventoryRefinementGroup = typeof inventoryRefinementGroups[number];
export type InventoryBrowseMode = 'category' | 'routine' | 'concern';

export type InventoryRefinementPlan = {
  primary: InventoryRefinementGroup[];
  secondary: InventoryRefinementGroup[];
};

type RefinementContext = {
  filters: InventoryResult['filters'];
  facets: InventoryResult['facets'];
  browse: string;
  total: number;
};

const contextualOrder: Record<InventoryBrowseMode | 'query', InventoryRefinementGroup[]> = {
  query: ['company', 'category', 'availability', 'price', 'source', 'order'],
  category: ['category', 'company', 'availability', 'price'],
  routine: ['routine', 'category', 'company', 'availability'],
  concern: ['concern', 'category', 'company', 'availability'],
};

function browseMode(value: string): InventoryBrowseMode {
  return value === 'routine' || value === 'concern' ? value : 'category';
}

function activeGroups(filters: InventoryResult['filters']) {
  return new Set<InventoryRefinementGroup>([
    ...(filters.category !== 'All' ? ['category' as const] : []),
    ...(filters.step ? ['routine' as const] : []),
    ...(filters.brand ? ['company' as const] : []),
    ...(filters.concern ? ['concern' as const] : []),
    ...(filters.review !== 'all' ? ['source' as const] : []),
    ...(filters.availability !== 'all' ? ['availability' as const] : []),
    ...(filters.price !== 'all' ? ['price' as const] : []),
    ...(filters.sort !== 'featured' ? ['order' as const] : []),
  ]);
}

function usefulGroups({
  filters,
  facets,
  total,
}: Omit<RefinementContext, 'browse'>) {
  const active = activeGroups(filters);
  const positiveCategories = facets.categories.filter(facet => facet.count > 0);
  const positiveSteps = facets.steps.filter(facet => facet.count > 0);
  const positiveCompanies = facets.brands.filter(facet => facet.count > 0);
  const positiveConcerns = facets.concerns.filter(facet => facet.total > 0 && facet.count > 0);
  const positivePriceBands = Object.values(facets.priceBands).filter(count => count > 0);
  const hasMixedSources = facets.reviewed > 0 && facets.community > 0;
  const hasSupportiveSubset = facets.supportive > 0 && facets.supportive < facets.reviewed;
  const routineCanNarrow = positiveSteps.length > 1
    || positiveSteps.some(facet => facet.count < total);
  const concernCanNarrow = positiveConcerns.some(facet => facet.count < total);
  const priceCanNarrow = positivePriceBands.length > 1
    || (facets.priced > 0 && facets.priced < facets.priceScope);

  return new Set<InventoryRefinementGroup>([
    ...(positiveCategories.length > 1 ? ['category' as const] : []),
    ...(routineCanNarrow ? ['routine' as const] : []),
    ...(positiveCompanies.length > 1 ? ['company' as const] : []),
    ...(concernCanNarrow ? ['concern' as const] : []),
    ...(hasMixedSources || hasSupportiveSubset ? ['source' as const] : []),
    ...(facets.priced > 0 && facets.priced < facets.priceScope
      ? ['availability' as const]
      : []),
    ...(priceCanNarrow ? ['price' as const] : []),
    ...(total > 1 ? ['order' as const] : []),
    ...active,
  ]);
}

/**
 * Keeps the first filter view quiet while making its order explainable.
 *
 * Query text changes only the non-clinical group order. It never maps a word
 * to a concern or creates a product relationship. Concern promotion requires
 * the explicit concern browse mode or an already validated active concern.
 */
export function inventoryRefinementPlan(context: RefinementContext): InventoryRefinementPlan {
  const active = activeGroups(context.filters);
  const useful = usefulGroups(context);
  const currentContext = context.filters.q ? 'query' : browseMode(context.browse);
  const priorities = contextualOrder[currentContext];
  const activePriority = [
    ...priorities.filter(group => active.has(group)),
    ...inventoryRefinementGroups.filter(group => active.has(group)),
  ];
  const primary: InventoryRefinementGroup[] = [];

  for (const group of activePriority) {
    if (!primary.includes(group)) primary.push(group);
  }

  let contextualCount = 0;
  for (const group of priorities) {
    if (primary.includes(group) || !useful.has(group) || contextualCount >= 4) continue;
    primary.push(group);
    contextualCount += 1;
  }

  return {
    primary,
    secondary: inventoryRefinementGroups.filter(group => (
      useful.has(group) && !primary.includes(group)
    )),
  };
}

export function withActiveCompanyFacet(
  facets: InventoryResult['facets']['brands'],
  selected: string,
) {
  if (!selected || facets.some(facet => facet.value === selected)) return facets;
  return [{ value: selected, count: 0 }, ...facets];
}
