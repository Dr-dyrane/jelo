import { money } from '@/lib/format/money';
import { outcomeLabel } from '@/lib/humanize/outcomes';
import { humanizeRef } from '@/lib/humanize/refs';

export type EdgeReviewRecord = {
  id: string;
  contributionId: string;
  contributionKind: 'product' | 'routine' | 'store';
  contributionPayload: Record<string, unknown>;
  subjectKind: string;
  subjectRef: string;
  predicate: string;
  objectKind: string;
  objectRef: string;
  confidenceState: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RelationshipFamily =
  | 'uses'
  | 'products'
  | 'brands'
  | 'stores'
  | 'experiences'
  | 'prices'
  | 'other';

export type RelationshipMatchState =
  | 'linked'
  | 'needs_matching'
  | 'unresolved'
  | 'not_applicable';

export type RelationshipValue = {
  label: string;
  kindLabel: string;
  detail: string | null;
  matchState: RelationshipMatchState;
  matchLabel: string | null;
  image: string | null;
};

export type LinkedRelationshipConsequence = {
  kind: 'separate_observation' | 'vocabulary_matching';
  label: string;
  detail: string;
};

export type EdgeReviewItem = {
  id: string;
  title: string;
  summary: string;
  sentence: string;
  family: RelationshipFamily;
  relationshipLabel: string;
  subject: RelationshipValue;
  object: RelationshipValue;
  matchingState: RelationshipMatchState;
  matchingLabel: string | null;
  contribution: {
    kind: EdgeReviewRecord['contributionKind'];
    kindLabel: string;
    title: string;
    sourceLabel: string;
    confidenceLabel: string;
  };
  image: string | null;
  reportedValue: string | null;
  reportedDate: string | null;
  linkedConsequences: LinkedRelationshipConsequence[];
  decisionScope: {
    approve: string;
    reject: string;
    boundary: string;
  };
  createdAt: string;
  metadata: {
    relationshipId: string;
    contributionId: string;
    raw: {
      contributionKind: EdgeReviewRecord['contributionKind'];
      contributionPayload: Record<string, unknown>;
      subjectKind: string;
      subjectRef: string;
      relationship: string;
      objectKind: string;
      objectRef: string;
      confidenceState: string;
      metadata: Record<string, unknown>;
    };
  };
};

type SubmittedValue = {
  id: string;
  label: string;
  source: 'canonical' | 'custom';
};

type ContributionContext = {
  kind: EdgeReviewRecord['contributionKind'];
  kindLabel: string;
  title: string;
  image: string | null;
  products: SubmittedValue[];
  brands: SubmittedValue[];
  retailers: SubmittedValue[];
  purposes: SubmittedValue[];
};

const outcomeValues = new Set(['love-it', 'helped', 'unsure', 'didnt-help']);

function submittedValues(value: unknown): SubmittedValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string'
      || typeof candidate.label !== 'string'
      || (candidate.source !== 'canonical' && candidate.source !== 'custom')
    ) {
      return [];
    }
    const id = candidate.id.trim();
    const label = candidate.label.trim();
    return id && label ? [{ id, label, source: candidate.source }] : [];
  });
}

function words(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-NG')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function titleWithBrand(product: string, brand: string) {
  if (!brand) return product;
  const productWords = new Set(words(product));
  if (words(brand).every(word => productWords.has(word))) return product;
  return `${brand} ${product}`.trim();
}

function titleCase(value: string) {
  return value
    .replace(/^[^:]+:/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim();
}

function qualifiedRef(kind: string, ref: string) {
  return ref.startsWith(`${kind}:`) ? ref : `${kind}:${ref}`;
}

function canonicalProduct(value: SubmittedValue | undefined) {
  if (!value || value.source !== 'canonical') return null;
  const resolved = humanizeRef(qualifiedRef('product', value.id));
  return resolved.kind === 'product' ? resolved : null;
}

function contributionContext(row: EdgeReviewRecord): ContributionContext {
  const products = submittedValues(row.contributionPayload.products);
  const brands = submittedValues(row.contributionPayload.brands);
  const retailers = submittedValues(row.contributionPayload.retailers);
  const purposes = submittedValues(row.contributionPayload.purposes);
  const product = canonicalProduct(products[0]);
  const productName = product?.name ?? products[0]?.label ?? '';
  const brandName = product?.brand ?? brands[0]?.label ?? '';
  const productTitle = titleWithBrand(productName, brandName);

  if (row.contributionKind === 'routine') {
    const title = products.length === 0
      ? 'Routine contribution'
      : products.length === 1
        ? `Routine with ${productTitle || products[0].label}`
        : `Routine with ${productTitle || products[0].label} + ${products.length - 1} more`;
    return {
      kind: row.contributionKind,
      kindLabel: 'Routine contribution',
      title,
      image: null,
      products,
      brands,
      retailers,
      purposes,
    };
  }

  if (row.contributionKind === 'store') {
    return {
      kind: row.contributionKind,
      kindLabel: 'Store contribution',
      title: retailers[0]?.label ?? 'Store contribution',
      image: null,
      products,
      brands,
      retailers,
      purposes,
    };
  }

  return {
    kind: row.contributionKind,
    kindLabel: 'Product contribution',
    title: productTitle || 'Product contribution',
    image: product?.displayApproved ? product.image ?? null : null,
    products,
    brands,
    retailers,
    purposes,
  };
}

function valuesForKind(context: ContributionContext, kind: string) {
  if (kind === 'product') return context.products;
  if (kind === 'brand') return context.brands;
  if (kind === 'retailer') return context.retailers;
  if (kind === 'purpose') return context.purposes;
  return [];
}

function submittedValue(context: ContributionContext, kind: string, ref: string) {
  return valuesForKind(context, kind).find(value => (
    value.id === ref || qualifiedRef(kind, value.id) === qualifiedRef(kind, ref)
  ));
}

function metadataLabel(metadata: Record<string, unknown>) {
  return typeof metadata.label === 'string' && metadata.label.trim()
    ? metadata.label.trim()
    : null;
}

function matchingPresentation(state: RelationshipMatchState) {
  if (state === 'linked') return 'Existing selection';
  if (state === 'needs_matching') return 'Needs matching';
  if (state === 'unresolved') return 'Check reference';
  return null;
}

function contributionValue(context: ContributionContext): RelationshipValue {
  return {
    label: context.title,
    kindLabel: context.kindLabel,
    detail: null,
    matchState: 'not_applicable',
    matchLabel: null,
    image: context.image,
  };
}

function relationshipValue(
  context: ContributionContext,
  kind: string,
  ref: string,
  metadata: Record<string, unknown>,
): RelationshipValue {
  if (kind === 'anonymous_contribution') return contributionValue(context);

  if (kind === 'amount_ngn') {
    const amount = /^\d+$/.test(ref) ? Number(ref) : Number.NaN;
    const validAmount = Number.isSafeInteger(amount) && amount >= 0;
    return {
      label: validAmount ? money(amount) : 'Amount needs review',
      kindLabel: 'Price',
      detail: null,
      matchState: validAmount ? 'not_applicable' : 'unresolved',
      matchLabel: validAmount ? null : 'Check value',
      image: null,
    };
  }

  if (kind === 'experience') {
    const known = outcomeValues.has(ref);
    return {
      label: known ? outcomeLabel(ref) : metadataLabel(metadata) ?? 'Result needs review',
      kindLabel: 'Result',
      detail: null,
      matchState: known ? 'not_applicable' : 'unresolved',
      matchLabel: known ? null : 'Check value',
      image: null,
    };
  }

  const kindLabels: Record<string, string> = {
    product: 'Product',
    brand: 'Brand',
    retailer: 'Store',
    purpose: 'Use',
  };
  const kindLabel = kindLabels[kind];
  if (!kindLabel) {
    return {
      label: metadataLabel(metadata) ?? 'Value needs review',
      kindLabel: 'Value',
      detail: null,
      matchState: 'unresolved',
      matchLabel: 'Check reference',
      image: null,
    };
  }

  const submitted = submittedValue(context, kind, ref);
  const inferredCustom = ref.startsWith('custom:');
  const matchState: RelationshipMatchState = submitted?.source === 'canonical'
    ? 'linked'
    : submitted?.source === 'custom' || inferredCustom
      ? 'needs_matching'
      : 'unresolved';

  if (kind === 'product' && submitted?.source === 'canonical') {
    const resolved = humanizeRef(qualifiedRef(kind, submitted.id));
    if (resolved.kind === 'product') {
      return {
        label: titleWithBrand(resolved.name, resolved.brand ?? ''),
        kindLabel,
        detail: null,
        matchState,
        matchLabel: matchingPresentation(matchState),
        image: resolved.displayApproved ? resolved.image ?? null : null,
      };
    }
  }

  const fallback = ref.startsWith('custom:') || ref.includes(':')
    ? titleCase(ref)
    : '';
  return {
    label: (metadataLabel(metadata) ?? submitted?.label ?? fallback) || 'Value needs review',
    kindLabel,
    detail: null,
    matchState,
    matchLabel: matchingPresentation(matchState),
    image: null,
  };
}

function relationshipPresentation(
  predicate: string,
  contributionKind: EdgeReviewRecord['contributionKind'],
): { family: RelationshipFamily; label: string } {
  if (predicate === 'reported_for') return { family: 'uses', label: 'Used for' };
  if (predicate === 'included_product') return { family: 'products', label: 'Includes' };
  if (predicate === 'reported_product') return { family: 'products', label: 'Product named' };
  if (predicate === 'reported_brand') return { family: 'brands', label: 'Brand named' };
  if (predicate === 'reported_retailer') {
    return contributionKind === 'product'
      ? { family: 'stores', label: 'Bought from' }
      : { family: 'stores', label: 'Store named' };
  }
  if (predicate === 'reported_outcome') return { family: 'experiences', label: 'Reported result' };
  if (predicate === 'reported_price') return { family: 'prices', label: 'Reported price' };
  return { family: 'other', label: 'Relationship needs review' };
}

function aggregateMatchingState(subject: RelationshipValue, object: RelationshipValue) {
  const states = [subject.matchState, object.matchState];
  if (states.includes('needs_matching')) return 'needs_matching';
  if (states.includes('unresolved')) return 'unresolved';
  if (states.includes('linked')) return 'linked';
  return 'not_applicable';
}

function formattedPurchaseDate(metadata: Record<string, unknown>) {
  if (
    typeof metadata.purchaseDate !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.purchaseDate)
  ) {
    return null;
  }
  const date = new Date(`${metadata.purchaseDate}T12:00:00Z`);
  if (!Number.isFinite(date.valueOf())) return null;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function linkedConsequences(
  family: RelationshipFamily,
  matchingState: RelationshipMatchState,
): LinkedRelationshipConsequence[] {
  const consequences: LinkedRelationshipConsequence[] = [];
  if (family === 'prices') {
    consequences.push({
      kind: 'separate_observation',
      label: 'Price report stays separate',
      detail: 'This decision does not approve the related price report.',
    });
  } else if (family === 'experiences') {
    consequences.push({
      kind: 'separate_observation',
      label: 'Experience report stays separate',
      detail: 'This decision does not approve the related experience report.',
    });
  }
  if (matchingState === 'needs_matching') {
    consequences.push({
      kind: 'vocabulary_matching',
      label: 'Name still needs matching',
      detail: 'This decision does not add the submitted name to the catalogue.',
    });
  }
  return consequences;
}

export function edgeReviewItem(row: EdgeReviewRecord): EdgeReviewItem {
  const context = contributionContext(row);
  const subject = row.subjectKind === 'anonymous_contribution'
    ? contributionValue(context)
    : relationshipValue(context, row.subjectKind, row.subjectRef, row.metadata);
  const object = relationshipValue(context, row.objectKind, row.objectRef, row.metadata);
  const relationship = relationshipPresentation(row.predicate, row.contributionKind);
  const matchingState = aggregateMatchingState(subject, object);
  const reportedValue = relationship.family === 'prices' || relationship.family === 'experiences'
    ? object.label
    : null;

  return {
    id: row.id,
    title: subject.label,
    summary: `${relationship.label} · ${object.label}`,
    sentence: `${subject.label} — ${relationship.label.toLocaleLowerCase('en-NG')} — ${object.label}`,
    family: relationship.family,
    relationshipLabel: relationship.label,
    subject,
    object,
    matchingState,
    matchingLabel: matchingPresentation(matchingState),
    contribution: {
      kind: context.kind,
      kindLabel: context.kindLabel,
      title: context.title,
      sourceLabel: 'Community',
      confidenceLabel: row.confidenceState === 'community_reported'
        ? 'Community reported'
        : 'Confidence not recorded',
    },
    image: subject.image ?? object.image ?? context.image,
    reportedValue,
    reportedDate: formattedPurchaseDate(row.metadata),
    linkedConsequences: linkedConsequences(relationship.family, matchingState),
    decisionScope: {
      approve: 'Approve this relationship only.',
      reject: 'Reject this relationship only.',
      boundary: 'Neither action publishes or verifies catalogue or clinical data.',
    },
    createdAt: row.createdAt,
    metadata: {
      relationshipId: row.id,
      contributionId: row.contributionId,
      raw: {
        contributionKind: row.contributionKind,
        contributionPayload: row.contributionPayload,
        subjectKind: row.subjectKind,
        subjectRef: row.subjectRef,
        relationship: row.predicate,
        objectKind: row.objectKind,
        objectRef: row.objectRef,
        confidenceState: row.confidenceState,
        metadata: row.metadata,
      },
    },
  };
}
