import type {
  CommercePriceChoice,
  CommerceSignalMonitor,
  ContributionAttributionMonitor,
} from '@/lib/moderation/queues';

export type CommerceSignalProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  image: string;
};

export type CommerceSignalView = {
  asOf: string;
  last7DaysCount: number;
  previous7DaysCount: number;
  last30DaysCount: number;
  lastRecordedAt: string | null;
  priceChoices: {
    choice: CommercePriceChoice;
    label: string;
    count: number;
    share: number;
  }[];
  topProducts: {
    slug: string;
    title: string;
    detail: string | null;
    image: string | null;
    visitCount: number;
    storeCount: number;
    lastVisitedAt: string;
  }[];
  topRetailers: CommerceSignalMonitor['topRetailers'];
  recentVisits: {
    id: string;
    productTitle: string;
    retailer: string;
    marketLabel: string;
    priceNgn: number | null;
    priceChoiceLabel: string;
    positionLabel: string;
    freshnessLabel: string | null;
    createdAt: string;
  }[];
};

export type ContributionSignalView = {
  asOf: string;
  last7DaysStarts: number;
  last7DaysCompletions: number;
  previous7DaysStarts: number;
  previous7DaysCompletions: number;
  last30DaysStarts: number;
  last30DaysCompletions: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  campaigns: {
    key: string;
    sourceLabel: string;
    detailLabel: string | null;
    starts: number;
    completions: number;
    lastActivityAt: string | null;
  }[];
};

const priceChoiceOrder: CommercePriceChoice[] = [
  'lowest',
  'median',
  'higher',
  'only',
  'marketplace',
];

const priceChoiceLabels: Record<CommercePriceChoice, string> = {
  lowest: 'Lowest-priced option',
  median: 'Mid-priced option',
  higher: 'Higher-priced option',
  only: 'Only priced option',
  marketplace: 'Marketplace option',
};

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
    'not-recorded': 'Not recorded',
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

function latest(first: string | null, second: string | null) {
  if (!first) return second;
  if (!second) return first;
  return new Date(first).getTime() > new Date(second).getTime() ? first : second;
}

function fallbackProductTitle(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function commercePriceChoiceLabel(choice: CommercePriceChoice) {
  return priceChoiceLabels[choice];
}

export function contributionSignalView(
  monitor: ContributionAttributionMonitor,
): ContributionSignalView {
  return {
    asOf: monitor.asOf,
    last7DaysStarts: monitor.last7DaysStarts,
    last7DaysCompletions: monitor.last7DaysCompletions,
    previous7DaysStarts: monitor.previous7DaysStarts,
    previous7DaysCompletions: monitor.previous7DaysCompletions,
    last30DaysStarts: monitor.last30DaysStarts,
    last30DaysCompletions: monitor.last30DaysCompletions,
    lastStartedAt: monitor.lastStartedAt,
    lastCompletedAt: monitor.lastCompletedAt,
    campaigns: monitor.campaigns.map(item => {
      const details = [
        campaignName(item.campaign),
        mediumName(item.medium),
        item.content ? titleCaseToken(item.content) : null,
      ].filter((value): value is string => Boolean(value));
      return {
        key: [item.source, item.medium, item.campaign, item.content]
          .map(value => value ?? '')
          .join(':'),
        sourceLabel: sourceName(item.source),
        detailLabel: details.length > 0
          ? details.join(' · ')
          : item.source === 'not-recorded'
            ? 'Earlier submissions'
            : null,
        starts: item.starts,
        completions: item.completions,
        lastActivityAt: latest(item.lastStartedAt, item.lastCompletedAt),
      };
    }),
  };
}

export function commerceSignalView(
  monitor: CommerceSignalMonitor,
  products: CommerceSignalProduct[],
): CommerceSignalView {
  const productsBySlug = new Map(products.map(product => [product.slug, product]));
  const counts = new Map(monitor.priceChoices.map(item => [item.choice, item.count]));

  return {
    asOf: monitor.asOf,
    last7DaysCount: monitor.last7DaysCount,
    previous7DaysCount: monitor.previous7DaysCount,
    last30DaysCount: monitor.last30DaysCount,
    lastRecordedAt: monitor.lastRecordedAt,
    priceChoices: priceChoiceOrder.map(choice => {
      const count = counts.get(choice) ?? 0;
      return {
        choice,
        label: priceChoiceLabels[choice],
        count,
        share: monitor.last30DaysCount > 0 ? count / monitor.last30DaysCount : 0,
      };
    }),
    topProducts: monitor.topProducts.map(item => {
      const product = productsBySlug.get(item.productSlug);
      return {
        slug: item.productSlug,
        title: product ? `${product.brand} ${product.name}` : fallbackProductTitle(item.productSlug),
        detail: product?.size ?? null,
        image: product?.image ?? null,
        visitCount: item.visitCount,
        storeCount: item.storeCount,
        lastVisitedAt: item.lastVisitedAt,
      };
    }),
    topRetailers: monitor.topRetailers,
    recentVisits: monitor.recentVisits.map(item => {
      const product = productsBySlug.get(item.productSlug);
      return {
        id: item.id,
        productTitle: product ? `${product.brand} ${product.name}` : fallbackProductTitle(item.productSlug),
        retailer: item.retailer,
        marketLabel: item.market === 'NG' ? 'Nigeria' : 'United States',
        priceNgn: item.priceNgn,
        priceChoiceLabel: priceChoiceLabels[item.priceChoice],
        positionLabel: `Shown ${ordinal(item.position)}`,
        freshnessLabel: item.freshnessDays == null
          ? null
          : item.freshnessDays === 0
            ? 'Price checked that day'
            : `Price checked ${item.freshnessDays} ${item.freshnessDays === 1 ? 'day' : 'days'} earlier`,
        createdAt: item.createdAt,
      };
    }),
  };
}
