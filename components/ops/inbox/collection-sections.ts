export type InboxSectionPresentation =
  | 'feature-shelf'
  | 'compact-rows'
  | 'horizontal-rail';

export interface InboxSectionPagination {
  /** Small first reveal; the server-owned result set remains unchanged. */
  initialCount: number;
  /** Number of already-fetched records revealed at each threshold. */
  pageSize: number;
}

export interface InboxCollectionSection<T extends { id: string }> {
  id: string;
  label: string;
  presentation: InboxSectionPresentation;
  itemIds: readonly T['id'][];
  pagination?: InboxSectionPagination;
}

export interface InboxItemRenderContext {
  sectionId: string;
  presentation: InboxSectionPresentation;
  isActive: boolean;
  isKeyboardCurrent: boolean;
}

export interface ResolvedInboxCollectionSection<T extends { id: string }>
  extends Omit<InboxCollectionSection<T>, 'itemIds'> {
  items: T[];
}

export function nextInboxPageVisibleCount(
  currentCount: number,
  totalCount: number,
  pageSize: number,
) {
  if (totalCount <= 0) return 0;
  return Math.min(totalCount, Math.max(0, currentCount) + Math.max(1, pageSize));
}

export function visibleInboxCountForSelection(
  currentCount: number,
  selectedIndex: number,
  totalCount: number,
  pageSize: number,
) {
  if (selectedIndex < 0 || selectedIndex < currentCount) {
    return Math.min(totalCount, Math.max(0, currentCount));
  }

  const safePageSize = Math.max(1, pageSize);
  const pageBoundary = Math.ceil((selectedIndex + 1) / safePageSize) * safePageSize;
  return Math.min(totalCount, Math.max(currentCount, pageBoundary));
}

export function normalizeInboxSections<T extends { id: string }>(
  items: T[],
  sections: readonly InboxCollectionSection<T>[],
): ResolvedInboxCollectionSection<T>[] {
  const itemById = new Map(items.map(item => [item.id, item]));
  const assigned = new Set<string>();
  const resolved: ResolvedInboxCollectionSection<T>[] = [];

  sections.forEach(section => {
    const sectionItems = section.itemIds.flatMap(id => {
      if (assigned.has(id)) return [];
      const item = itemById.get(id);
      if (!item) return [];
      assigned.add(id);
      return [item];
    });

    if (sectionItems.length > 0) {
      resolved.push({
        id: section.id,
        label: section.label,
        presentation: section.presentation,
        pagination: section.pagination,
        items: sectionItems,
      });
    }
  });
  const unassigned = items.filter(item => !assigned.has(item.id));

  if (unassigned.length > 0) {
    resolved.push({
      id: 'more',
      label: 'More',
      presentation: 'compact-rows',
      items: unassigned,
    });
  }

  return resolved;
}
