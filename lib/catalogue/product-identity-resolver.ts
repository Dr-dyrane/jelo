import { createHash } from 'node:crypto';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const catalogueIdentityProvenances = [
  'jelocare_reviewed',
  'community_sourced_public',
] as const;

export const cataloguePublicEligibilityBases = [
  'reviewed_catalogue_projection',
  'community_publication_release',
] as const;

export const catalogueIdentityLifecycleStates = [
  'active',
  'merged',
  'retired',
  'superseded',
] as const;

export type CatalogueIdentityProvenance = typeof catalogueIdentityProvenances[number];
export type CataloguePublicEligibilityBasis = typeof cataloguePublicEligibilityBases[number];
export type CatalogueIdentityLifecycleState = typeof catalogueIdentityLifecycleStates[number];
export type CatalogueIdentityTransitionKind = 'alias' | 'successor';

export type CatalogueIdentityVersionRecord = {
  identityId: string;
  identityVersionId: string;
  productId: string;
  versionNumber: number;
  provenance: string;
  publicEligibilityBasis: string;
  publicEligibleAt: string;
  slugAtReview: string;
  brandAtReview: string;
  variantAtReview: string;
  sizeAtReview: string;
  packageVersionAtReview: string;
  formulaVersionAtReview: string;
  lifecycleState: string;
  retiredAt: string | null;
  retirementReasonCategory: string | null;
};

export type CatalogueIdentityTransitionRecord = {
  fromIdentityVersionId: string;
  toIdentityVersionId: string;
  kind: string;
  reasonCategory: string;
};

export type CatalogueIdentitySnapshot = {
  identityId: string;
  identityVersionId: string;
  versionNumber: number;
  provenance: CatalogueIdentityProvenance;
  publicEligibilityBasis: CataloguePublicEligibilityBasis;
  slugAtReview: string;
  brandAtReview: string;
  variantAtReview: string;
  sizeAtReview: string;
  packageVersionAtReview: string;
  formulaVersionAtReview: string;
  lifecycleState: CatalogueIdentityLifecycleState;
  purchasable: boolean;
  retiredAt: string | null;
  retirementReasonCategory: string | null;
};

export type CatalogueIdentityTransitionState =
  | 'current'
  | 'merged'
  | 'merged_to_retired'
  | 'merged_with_successor'
  | 'retired'
  | 'successor_available';

export type CatalogueIdentityResolution =
  | {
    status: 'resolved';
    original: CatalogueIdentitySnapshot;
    current: CatalogueIdentitySnapshot;
    successor: CatalogueIdentitySnapshot | null;
    transitionState: CatalogueIdentityTransitionState;
    transitions: Array<{
      kind: CatalogueIdentityTransitionKind;
      fromIdentityVersionId: string;
      toIdentityVersionId: string;
      reasonCategory: string;
    }>;
  }
  | {
    status: 'unresolvable';
    reason:
      | 'not-public-or-missing'
      | 'invalid-record'
      | 'invalid-transition'
      | 'ambiguous-transition'
      | 'transition-cycle'
      | 'repository-unavailable';
  };

const identityNamespace = 'jelocare:catalogue-product-identity:v1:';
const identityVersionNamespace = 'jelocare:catalogue-product-identity-version:v1:';

function deterministicUuid(namespace: string, productId: string) {
  if (!uuidPattern.test(productId)) {
    throw new Error('Catalogue product identity requires a UUID product id.');
  }
  const hex = createHash('sha256')
    .update(`${namespace}${productId.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function catalogueIdentityIdForProductId(productId: string) {
  return deterministicUuid(identityNamespace, productId);
}

export function catalogueIdentityVersionIdForProductId(productId: string) {
  return deterministicUuid(identityVersionNamespace, productId);
}

function validDate(value: string | null) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function nonEmpty(value: string) {
  return value.trim().length > 0;
}

function provenanceAndEligibility(
  record: CatalogueIdentityVersionRecord,
): {
  provenance: CatalogueIdentityProvenance;
  publicEligibilityBasis: CataloguePublicEligibilityBasis;
} | undefined {
  if (
    record.provenance === 'jelocare_reviewed'
    && record.publicEligibilityBasis === 'reviewed_catalogue_projection'
  ) {
    return {
      provenance: record.provenance,
      publicEligibilityBasis: record.publicEligibilityBasis,
    };
  }
  if (
    record.provenance === 'community_sourced_public'
    && record.publicEligibilityBasis === 'community_publication_release'
  ) {
    return {
      provenance: record.provenance,
      publicEligibilityBasis: record.publicEligibilityBasis,
    };
  }
  return undefined;
}

function snapshot(record: CatalogueIdentityVersionRecord): CatalogueIdentitySnapshot | undefined {
  const authority = provenanceAndEligibility(record);
  if (
    !authority
    || !uuidPattern.test(record.identityId)
    || !uuidPattern.test(record.identityVersionId)
    || !uuidPattern.test(record.productId)
    || !Number.isInteger(record.versionNumber)
    || record.versionNumber < 1
    || !validDate(record.publicEligibleAt)
    || !nonEmpty(record.slugAtReview)
    || !nonEmpty(record.brandAtReview)
    || !nonEmpty(record.variantAtReview)
    || !nonEmpty(record.sizeAtReview)
    || !nonEmpty(record.packageVersionAtReview)
    || !nonEmpty(record.formulaVersionAtReview)
    || !(catalogueIdentityLifecycleStates as readonly string[]).includes(record.lifecycleState)
  ) return undefined;

  const lifecycleState = record.lifecycleState as CatalogueIdentityLifecycleState;
  if (
    lifecycleState === 'retired'
      ? !validDate(record.retiredAt) || !nonEmpty(record.retirementReasonCategory ?? '')
      : record.retiredAt !== null || record.retirementReasonCategory !== null
  ) return undefined;

  return {
    identityId: record.identityId.toLowerCase(),
    identityVersionId: record.identityVersionId.toLowerCase(),
    versionNumber: record.versionNumber,
    ...authority,
    slugAtReview: record.slugAtReview,
    brandAtReview: record.brandAtReview,
    variantAtReview: record.variantAtReview,
    sizeAtReview: record.sizeAtReview,
    packageVersionAtReview: record.packageVersionAtReview,
    formulaVersionAtReview: record.formulaVersionAtReview,
    lifecycleState,
    purchasable: lifecycleState === 'active',
    retiredAt: record.retiredAt,
    retirementReasonCategory: record.retirementReasonCategory,
  };
}

function transitionState(
  aliasCount: number,
  current: CatalogueIdentitySnapshot,
  successor: CatalogueIdentitySnapshot | null,
): CatalogueIdentityTransitionState {
  if (aliasCount > 0 && successor) return 'merged_with_successor';
  if (aliasCount > 0 && current.lifecycleState === 'retired') return 'merged_to_retired';
  if (aliasCount > 0) return 'merged';
  if (successor) return 'successor_available';
  if (current.lifecycleState === 'retired') return 'retired';
  return 'current';
}

/**
 * Resolves only entries admitted to the public identity ledger. Successors are
 * returned as an explicit option and are never substituted for the saved
 * identity. Any missing target, ambiguous edge, invalid authority, or cycle
 * makes the complete resolution fail closed.
 */
export function resolveCatalogueIdentityVersion(
  requestedIdentityVersionId: string,
  records: readonly CatalogueIdentityVersionRecord[],
  transitionRecords: readonly CatalogueIdentityTransitionRecord[],
): CatalogueIdentityResolution {
  if (!uuidPattern.test(requestedIdentityVersionId)) {
    return { status: 'unresolvable', reason: 'not-public-or-missing' };
  }

  const recordsById = new Map<string, CatalogueIdentityVersionRecord>();
  for (const record of records) {
    const key = record.identityVersionId.toLowerCase();
    if (recordsById.has(key)) {
      return { status: 'unresolvable', reason: 'invalid-record' };
    }
    recordsById.set(key, record);
  }

  const requestedId = requestedIdentityVersionId.toLowerCase();
  if (!recordsById.has(requestedId)) {
    return { status: 'unresolvable', reason: 'not-public-or-missing' };
  }

  const outgoing = new Map<string, CatalogueIdentityTransitionRecord[]>();
  for (const transition of transitionRecords) {
    const key = transition.fromIdentityVersionId.toLowerCase();
    outgoing.set(key, [...(outgoing.get(key) ?? []), transition]);
  }

  const visited = new Set<string>();
  const path: Array<{
    kind: CatalogueIdentityTransitionKind;
    fromIdentityVersionId: string;
    toIdentityVersionId: string;
    reasonCategory: string;
  }> = [];
  let currentId = requestedId;
  let resolvedCurrentId = requestedId;
  let aliasCount = 0;
  let successor: CatalogueIdentitySnapshot | null = null;

  while (true) {
    if (visited.has(currentId)) {
      return { status: 'unresolvable', reason: 'transition-cycle' };
    }
    visited.add(currentId);

    const currentRecord = recordsById.get(currentId);
    const currentSnapshot = currentRecord ? snapshot(currentRecord) : undefined;
    if (!currentSnapshot) {
      return { status: 'unresolvable', reason: currentRecord ? 'invalid-record' : 'invalid-transition' };
    }

    const currentOutgoing = outgoing.get(currentId) ?? [];
    if (currentOutgoing.length > 1) {
      return { status: 'unresolvable', reason: 'ambiguous-transition' };
    }
    const [edge] = currentOutgoing;
    if (!edge) {
      if (['merged', 'superseded'].includes(currentSnapshot.lifecycleState)) {
        return { status: 'unresolvable', reason: 'invalid-transition' };
      }
      break;
    }
    if (
      !['alias', 'successor'].includes(edge.kind)
      || !uuidPattern.test(edge.toIdentityVersionId)
      || !nonEmpty(edge.reasonCategory)
      || edge.fromIdentityVersionId.toLowerCase() !== currentId
      || edge.toIdentityVersionId.toLowerCase() === currentId
      || (edge.kind === 'alias' && currentSnapshot.lifecycleState !== 'merged')
      || (edge.kind === 'successor' && currentSnapshot.lifecycleState !== 'superseded')
    ) {
      return { status: 'unresolvable', reason: 'invalid-transition' };
    }

    const targetId = edge.toIdentityVersionId.toLowerCase();
    const targetRecord = recordsById.get(targetId);
    const targetSnapshot = targetRecord ? snapshot(targetRecord) : undefined;
    if (!targetSnapshot) {
      return { status: 'unresolvable', reason: 'invalid-transition' };
    }
    path.push({
      kind: edge.kind as CatalogueIdentityTransitionKind,
      fromIdentityVersionId: currentId,
      toIdentityVersionId: targetId,
      reasonCategory: edge.reasonCategory,
    });

    if (edge.kind === 'successor') {
      successor ??= targetSnapshot;
      currentId = targetId;
      continue;
    }
    if (!successor) {
      aliasCount += 1;
      resolvedCurrentId = targetId;
    }
    currentId = targetId;
  }

  const originalRecord = recordsById.get(requestedId);
  const original = originalRecord ? snapshot(originalRecord) : undefined;
  if (!original) return { status: 'unresolvable', reason: 'invalid-record' };

  const currentRecord = recordsById.get(resolvedCurrentId);
  const current = currentRecord ? snapshot(currentRecord) : undefined;
  if (!current) return { status: 'unresolvable', reason: 'invalid-transition' };

  return {
    status: 'resolved',
    original,
    current,
    successor,
    transitionState: transitionState(aliasCount, current, successor),
    transitions: path,
  };
}
