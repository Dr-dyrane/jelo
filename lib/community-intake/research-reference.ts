const canonicalSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const customReferencePattern = /^custom:[^\u0000-\u001f\u007f]+$/;

export type CommunityResearchTaskShape = {
  taskKind: 'product-identity' | 'product-retail-refresh' | 'retailer-identity' | 'retailer-refresh';
  entityKind: 'product' | 'retailer';
  entitySource: 'canonical' | 'custom';
  entityRef: string;
};

export function canonicalResearchEntitySlug(
  entityKind: 'product' | 'retailer',
  entityRef: string,
) {
  const prefix = `${entityKind}:`;
  if (!entityRef.startsWith(prefix)) return null;
  const slug = entityRef.slice(prefix.length);
  return canonicalSlugPattern.test(slug) ? slug : null;
}

export function researchTaskShapeIsValid(task: CommunityResearchTaskShape) {
  const customRef = task.entityRef.length <= 160
    && customReferencePattern.test(task.entityRef);

  return (
    task.taskKind === 'product-identity'
    && task.entityKind === 'product'
    && task.entitySource === 'custom'
    && customRef
  ) || (
    task.taskKind === 'product-retail-refresh'
    && task.entityKind === 'product'
    && task.entitySource === 'canonical'
    && canonicalResearchEntitySlug('product', task.entityRef) !== null
  ) || (
    task.taskKind === 'retailer-identity'
    && task.entityKind === 'retailer'
    && task.entitySource === 'custom'
    && customRef
  ) || (
    task.taskKind === 'retailer-refresh'
    && task.entityKind === 'retailer'
    && task.entitySource === 'canonical'
    && canonicalResearchEntitySlug('retailer', task.entityRef) !== null
  );
}

export function assertCommunityResearchTaskShape(task: CommunityResearchTaskShape) {
  if (!researchTaskShapeIsValid(task)) {
    throw new Error('Community research task has an invalid kind, source, or reference namespace.');
  }
}
