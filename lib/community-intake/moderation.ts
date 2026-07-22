import type { ContributionDraft } from './schema';
import { normalizeCommunityValue } from './schema';

export type UnknownCommunityValue = {
  kind: 'purpose' | 'product' | 'brand' | 'retailer';
  fieldPath: 'purposes' | 'products' | 'brands' | 'retailers';
  rawValue: string;
  normalizedValue: string;
};

export type CommunityKnowledgeEdge = {
  subjectKind: string;
  subjectRef: string;
  predicate: string;
  objectKind: string;
  objectRef: string;
  metadata: Record<string, string | number>;
};

const selectableFields = [
  ['purposes', 'purpose'],
  ['products', 'product'],
  ['brands', 'brand'],
  ['retailers', 'retailer'],
] as const;

export function unknownCommunityValues(draft: ContributionDraft): UnknownCommunityValue[] {
  return selectableFields.flatMap(([fieldPath, kind]) => draft[fieldPath]
    .filter(value => value.source === 'custom')
    .map(value => ({
      kind,
      fieldPath,
      rawValue: value.label,
      normalizedValue: normalizeCommunityValue(value.label),
    })));
}

export function communityKnowledgeEdges(draft: ContributionDraft, contributionId: string): CommunityKnowledgeEdge[] {
  const subject = { subjectKind: 'anonymous_contribution', subjectRef: contributionId };
  const productRefs = draft.products.map(product => product.id);
  const edges: CommunityKnowledgeEdge[] = [
    ...draft.purposes.map(value => ({ ...subject, predicate: 'reported_for', objectKind: 'purpose', objectRef: value.id, metadata: { label: value.label } })),
    ...draft.products.map(value => ({ ...subject, predicate: draft.kind === 'routine' ? 'included_product' : 'reported_product', objectKind: 'product', objectRef: value.id, metadata: { label: value.label } })),
    ...draft.brands.map(value => ({ ...subject, predicate: 'reported_brand', objectKind: 'brand', objectRef: value.id, metadata: { label: value.label } })),
    ...draft.retailers.map(value => ({ ...subject, predicate: 'reported_retailer', objectKind: 'retailer', objectRef: value.id, metadata: { label: value.label } })),
  ];

  if (draft.outcome) edges.push({ ...subject, predicate: 'reported_outcome', objectKind: 'experience', objectRef: draft.outcome, metadata: {} });
  if (draft.priceNgn != null) edges.push({
    subjectKind: productRefs.length ? 'product' : subject.subjectKind,
    subjectRef: productRefs[0] ?? subject.subjectRef,
    predicate: 'reported_price',
    objectKind: 'amount_ngn',
    objectRef: String(draft.priceNgn),
    metadata: draft.purchaseDate ? { purchaseDate: draft.purchaseDate } : {},
  });

  return edges;
}
