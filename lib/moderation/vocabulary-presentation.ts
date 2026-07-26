export type VocabularyValueKind = 'purpose' | 'product' | 'brand' | 'retailer';
export type VocabularyContributionKind = 'product' | 'routine' | 'store';

export type VocabularyReviewContextRecord = {
  contributionKind: VocabularyContributionKind;
  contributionPayload: Record<string, unknown>;
  submittedAt: string;
};

export type VocabularyReviewRecord = {
  id: string;
  valueKind: VocabularyValueKind;
  rawValue: string;
  activeMentionCount: number;
  contributionKinds: VocabularyContributionKind[];
  recentContexts: VocabularyReviewContextRecord[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type VocabularyReportContext = {
  title: string;
  detail: string | null;
  submittedAt: string;
};

export type VocabularyReviewItem = {
  id: string;
  valueKind: VocabularyValueKind;
  kindLabel: string;
  title: string;
  summary: string;
  activeMentionCount: number;
  contextLabels: string[];
  recentContexts: VocabularyReportContext[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type VocabularyTarget = {
  kind: VocabularyValueKind;
  ref: string;
  label: string;
  detail: string | null;
};

const kindLabels: Record<VocabularyValueKind, string> = {
  purpose: 'Use',
  product: 'Product',
  brand: 'Brand',
  retailer: 'Store',
};

const kindGroupLabels: Record<VocabularyValueKind, string> = {
  purpose: 'Uses',
  product: 'Products',
  brand: 'Brands',
  retailer: 'Stores',
};

const contributionLabels: Record<VocabularyContributionKind, string> = {
  product: 'Product notes',
  routine: 'Routine notes',
  store: 'Store listings',
};

export function vocabularyKindLabel(kind: VocabularyValueKind) {
  return kindLabels[kind];
}

export function vocabularyKindGroupLabel(kind: VocabularyValueKind) {
  return kindGroupLabels[kind];
}

/**
 * Community language is preserved in storage. Display text is a separate,
 * defensive projection: invisible controls and replacement glyphs should
 * never leak into the operator interface.
 */
export function vocabularyDisplayText(value: string) {
  return value
    .replace(/[\p{Cc}\p{Cf}\uFFFD]/gu, ' ')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical target labels can originate outside the moderation UI. Return a
 * display-safe projection so callers never have to render source text raw.
 * A target with no visible name cannot be an intelligible match, so it is
 * omitted rather than presented as a blank choice.
 */
export function vocabularyDisplayTarget(target: VocabularyTarget): VocabularyTarget | null {
  const label = vocabularyDisplayText(target.label);
  if (!label) return null;
  const detail = target.detail ? vocabularyDisplayText(target.detail) || null : null;
  return { ...target, label, detail };
}

function vocabularySearchText(value: string) {
  return vocabularyDisplayText(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en-NG')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function searchTokens(value: string) {
  return new Set(vocabularySearchText(value).split(' ').filter(Boolean));
}

function matchScore(needle: string, candidate: string) {
  if (!needle || !candidate) return 0;
  if (candidate === needle) return 1_000;
  if (candidate.startsWith(needle)) return 760;
  if (candidate.includes(needle)) return 680;
  if (needle.includes(candidate) && candidate.length >= 4) return 610;

  const needleTokens = searchTokens(needle);
  const candidateTokens = searchTokens(candidate);
  if (needleTokens.size === 0 || candidateTokens.size === 0) return 0;
  const overlap = [...needleTokens].filter(token => candidateTokens.has(token)).length;
  if (overlap === 0) return 0;
  const union = new Set([...needleTokens, ...candidateTokens]).size;
  return 240 + Math.round((overlap / union) * 300) + (overlap === needleTokens.size ? 80 : 0);
}

/**
 * Suggestions are deterministic, bounded by the caller, and always scoped to
 * the source term's kind. The server repeats the kind check at settlement.
 */
export function rankVocabularyTargets(
  term: string,
  kind: VocabularyValueKind,
  targets: readonly VocabularyTarget[],
  query = '',
) {
  const querySearch = vocabularySearchText(query);
  const hasSearch = querySearch.length > 0;
  const source = hasSearch ? querySearch : vocabularySearchText(term);
  return targets
    .filter(target => target.kind === kind)
    .flatMap(target => {
      const displayTarget = vocabularyDisplayTarget(target);
      if (!displayTarget) return [];
      const { label, detail } = displayTarget;
      const labelScore = matchScore(source, vocabularySearchText(label));
      const combinedScore = matchScore(source, vocabularySearchText(`${label} ${detail ?? ''}`));
      return [{
        target: displayTarget,
        score: Math.max(labelScore, combinedScore),
        sortLabel: vocabularySearchText(`${label} ${detail ?? ''}`),
      }];
    })
    .filter(candidate => (
      hasSearch
        ? candidate.score > 0
        : candidate.score >= 500
    ))
    .sort((left, right) => (
      right.score - left.score
      || left.sortLabel.localeCompare(right.sortLabel, 'en-NG')
      || left.target.ref.localeCompare(right.target.ref, 'en-NG')
    ))
    .map(candidate => candidate.target);
}

function labels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const label = (item as Record<string, unknown>).label;
    if (typeof label !== 'string') return [];
    const display = vocabularyDisplayText(label);
    return display ? [display] : [];
  });
}

function reportContext(context: VocabularyReviewContextRecord): VocabularyReportContext {
  const products = labels(context.contributionPayload.products);
  const brands = labels(context.contributionPayload.brands);
  const retailers = labels(context.contributionPayload.retailers);
  const purposes = labels(context.contributionPayload.purposes);

  if (context.contributionKind === 'routine') {
    return {
      title: products.join(', ') || 'Routine submission',
      detail: purposes.join(', ') || null,
      submittedAt: context.submittedAt,
    };
  }
  if (context.contributionKind === 'store') {
    return {
      title: retailers.join(', ') || 'Store submission',
      detail: purposes.join(', ') || null,
      submittedAt: context.submittedAt,
    };
  }
  return {
    title: products.join(', ') || brands.join(', ') || 'Product submission',
    detail: [brands.join(', '), retailers.join(', ')].filter(Boolean).join(' · ') || null,
    submittedAt: context.submittedAt,
  };
}

export function vocabularyReviewItem(row: VocabularyReviewRecord): VocabularyReviewItem {
  const reports = `${row.activeMentionCount} ${row.activeMentionCount === 1 ? 'report' : 'reports'}`;
  return {
    id: row.id,
    valueKind: row.valueKind,
    kindLabel: vocabularyKindLabel(row.valueKind),
    title: vocabularyDisplayText(row.rawValue) || 'Untitled term',
    summary: reports,
    activeMentionCount: row.activeMentionCount,
    contextLabels: row.contributionKinds.map(kind => contributionLabels[kind]),
    recentContexts: row.recentContexts.map(reportContext),
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
  };
}
