import { humanizeRef, type HumanRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { outcomeLabel } from '@/lib/humanize/outcomes';

type AdaptiveItem = {
  id: string;
  label: string;
  source: 'canonical' | 'custom' | null;
};

export type ContributionAttribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
};

export type ContributionReviewRecord = {
  id: string;
  kind: 'product' | 'routine' | 'store';
  payload: Record<string, unknown>;
  submittedAt: string;
  retainUntil: string;
  pendingEdgeCount: number;
  pendingObservationCount: number;
  attribution: ContributionAttribution | null;
};

export type ContributionDisplayValue = {
  label: string;
  match: 'known' | 'new';
};

export type ContributionReviewItem = {
  id: string;
  kind: ContributionReviewRecord['kind'];
  kindLabel: string;
  title: string;
  summary: string;
  brandValues: ContributionDisplayValue[];
  productValues: ContributionDisplayValue[];
  storeValues: ContributionDisplayValue[];
  purposeValues: ContributionDisplayValue[];
  brandNames: string[];
  productNames: string[];
  storeNames: string[];
  purposeNames: string[];
  priceNgn: number | null;
  outcome: string | null;
  purchaseDate: string | null;
  productCount: number;
  image: string | null;
  needsMatching: boolean;
  pendingLinkedReportCount: number;
  submittedAt: string;
  retainUntil: string;
  sourceLabel: string;
  campaignLabel: string | null;
};

function adaptiveItems(value: unknown): AdaptiveItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string') return [];
    const source: AdaptiveItem['source'] = candidate.source === 'canonical' || candidate.source === 'custom'
      ? candidate.source
      : null;
    return [{
      id: candidate.id.trim(),
      label: candidate.label.trim(),
      source,
    }];
  }).filter(item => item.id && item.label);
}

function normalizedWords(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-NG')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function productNameIncludesBrand(productName: string, brandName: string) {
  const productWords = new Set(normalizedWords(productName));
  const brandWords = normalizedWords(brandName);
  return brandWords.length > 0 && brandWords.every(word => productWords.has(word));
}

export function contributionProductRef(id: string) {
  return id.startsWith('product:') ? id : `product:${id}`;
}

function canonicalProduct(item: AdaptiveItem | null): HumanRef | null {
  if (!item || item.source !== 'canonical') return null;
  const resolved = humanizeRef(contributionProductRef(item.id));
  return resolved.kind === 'product' ? resolved : null;
}

function kindLabel(kind: ContributionReviewRecord['kind']) {
  if (kind === 'routine') return 'Routine submission';
  if (kind === 'store') return 'Store submission';
  return 'Product submission';
}

function titleWithBrand(productName: string, brandName: string) {
  if (!brandName || productNameIncludesBrand(productName, brandName)) return productName;
  return `${brandName} ${productName}`.trim();
}

function displayValue(label: string, source: AdaptiveItem['source']): ContributionDisplayValue {
  return {
    label,
    match: source === 'custom' ? 'new' : 'known',
  };
}

function routineTitle(productNames: string[]) {
  const first = productNames[0];
  if (!first || productNames.length === 1) return first ?? '';
  return `${first} + ${productNames.length - 1} more`;
}

function titleCaseToken(value: string) {
  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim();
}

function sourceName(value: string) {
  const known: Record<string, string> = {
    direct: 'Direct',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
  };
  return known[value] ?? titleCaseToken(value);
}

function mediumName(value: string | null) {
  if (!value) return null;
  const known: Record<string, string> = {
    'organic-social': 'Organic',
    'paid-social': 'Paid',
    referral: 'Referral',
  };
  return known[value] ?? titleCaseToken(value);
}

function campaignName(value: string | null) {
  if (!value) return null;
  const dated = value.match(/^(.*?)-(\d{4})-(\d{2})$/);
  if (!dated) return titleCaseToken(value);
  const month = new Intl.DateTimeFormat('en-NG', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dated[2]}-${dated[3]}-01T00:00:00Z`));
  return `${titleCaseToken(dated[1])} · ${month} ${dated[2]}`;
}

function attributionLabels(attribution: ContributionAttribution | null) {
  if (!attribution) return { sourceLabel: 'Not recorded', campaignLabel: null };
  const medium = mediumName(attribution.medium);
  return {
    sourceLabel: medium ? `${sourceName(attribution.source)} · ${medium}` : sourceName(attribution.source),
    campaignLabel: campaignName(attribution.campaign),
  };
}

function summaryFor(input: {
  kind: ContributionReviewRecord['kind'];
  productCount: number;
  purposeNames: string[];
  priceNgn: number | null;
  outcome: string | null;
  storeNames: string[];
}) {
  if (input.kind === 'routine') {
    const products = `${input.productCount} ${input.productCount === 1 ? 'product' : 'products'}`;
    return input.outcome ? `${products} · ${outcomeLabel(input.outcome)}` : products;
  }
  if (input.kind === 'store') {
    return input.purposeNames.join(', ');
  }
  if (input.priceNgn != null) return money(input.priceNgn);
  if (input.outcome) return outcomeLabel(input.outcome);
  return input.storeNames.join(', ');
}

export function contributionReviewItem(row: ContributionReviewRecord): ContributionReviewItem {
  const products = adaptiveItems(row.payload.products);
  const brands = adaptiveItems(row.payload.brands);
  const retailers = adaptiveItems(row.payload.retailers);
  const purposes = adaptiveItems(row.payload.purposes);
  const primaryProduct = canonicalProduct(products[0] ?? null);
  const brandValues = primaryProduct?.brand
    ? [
        displayValue(primaryProduct.brand, 'canonical'),
        ...brands
          .filter(item => item.label !== primaryProduct.brand)
          .map(item => displayValue(item.label, item.source)),
      ]
    : brands.map(item => displayValue(item.label, item.source));
  const productValues = primaryProduct
    ? [
        displayValue(primaryProduct.name, 'canonical'),
        ...products.slice(1).map(item => displayValue(item.label, item.source)),
      ]
    : products.map(item => displayValue(item.label, item.source));
  const storeValues = retailers.map(item => displayValue(item.label, item.source));
  const purposeValues = purposes.map(item => displayValue(item.label, item.source));
  const brandNames = brandValues.map(item => item.label);
  const productNames = productValues.map(item => item.label);
  const storeNames = storeValues.map(item => item.label);
  const purposeNames = purposeValues.map(item => item.label);
  const priceNgn = typeof row.payload.priceNgn === 'number' ? row.payload.priceNgn : null;
  const outcome = typeof row.payload.outcome === 'string' ? row.payload.outcome : null;
  const purchaseDate = typeof row.payload.purchaseDate === 'string' ? row.payload.purchaseDate : null;
  const productTitle = row.kind === 'routine'
    ? routineTitle(productNames)
    : productNames.join(', ');
  const title = productTitle
    ? titleWithBrand(productTitle, brandNames[0] ?? '')
    : storeNames.join(', ') || purposeNames.join(', ') || 'Community submission';
  const attribution = attributionLabels(row.attribution);

  return {
    id: row.id,
    kind: row.kind,
    kindLabel: kindLabel(row.kind),
    title,
    summary: summaryFor({
      kind: row.kind,
      productCount: products.length,
      purposeNames,
      priceNgn,
      outcome,
      storeNames,
    }),
    brandValues,
    productValues,
    storeValues,
    purposeValues,
    brandNames,
    productNames,
    storeNames,
    purposeNames,
    priceNgn,
    outcome,
    purchaseDate,
    productCount: products.length,
    image: row.kind === 'product' && primaryProduct?.displayApproved
      ? primaryProduct.image ?? null
      : null,
    needsMatching: [
      ...brandValues,
      ...productValues,
      ...storeValues,
      ...purposeValues,
    ].some(item => item.match === 'new'),
    pendingLinkedReportCount: row.pendingEdgeCount + row.pendingObservationCount,
    submittedAt: row.submittedAt,
    retainUntil: row.retainUntil,
    sourceLabel: attribution.sourceLabel,
    campaignLabel: attribution.campaignLabel,
  };
}
