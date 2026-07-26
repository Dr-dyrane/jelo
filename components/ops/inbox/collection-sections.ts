export type InboxSectionPresentation =
  | 'feature-shelf'
  | 'compact-rows'
  | 'horizontal-rail';

export interface InboxCollectionSection<T extends { id: string }> {
  id: string;
  label: string;
  presentation: InboxSectionPresentation;
  itemIds: readonly T['id'][];
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
