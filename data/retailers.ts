import type {
  ContentUsePolicy,
  RetailerEvidence,
  RetailerIdentityEvidence,
  RetailerReviewStatus,
  RegulatorMatchEvidence,
} from '@/data/retail-evidence';

export type RetailerReference = {
  name: string;
  homepage: string;
  market: 'NG';
  kind: 'retailer' | 'marketplace';
  trust: number;
  reviewStatus: RetailerReviewStatus;
  contentUse: ContentUsePolicy;
  identityEvidence?: RetailerIdentityEvidence;
  regulatorMatchEvidence?: RegulatorMatchEvidence;
  searchUrl: (query: string) => string;
  note: string;
};

const wordpressSearch = (origin: string) => (query: string) => {
  const url = new URL(origin);
  url.searchParams.set('s', query);
  url.searchParams.set('post_type', 'product');
  return url.toString();
};

export const nigeriaRetailers: RetailerReference[] = [
  {
    name: 'Beauty by Daz',
    homepage: 'https://beautybydaz.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 100,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://beautybydaz.com/'),
    note: 'Lagos store, direct catalogue pages and visible Naira pricing.',
  },
  {
    name: 'Teeka4',
    homepage: 'https://teeka4.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 98,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://teeka4.com/'),
    note: 'Direct catalogue, sourcing guidance and visible stock status.',
  },
  {
    name: 'Lush Hair Nigeria',
    homepage: 'https://nigeria.lushhairafrica.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 98,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: query => `https://nigeria.lushhairafrica.com/search?q=${encodeURIComponent(query)}`,
    note: 'Nigeria brand-domain shop with visible stock and Naira pricing; authorization is only shown when separately evidenced.',
  },
  {
    name: 'Medplus',
    homepage: 'https://medplusnig.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 97,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    identityEvidence: {
      observedAt: '2026-07-22T14:25:00Z',
      sourceUrl: 'https://africa.cerave.com/en/find-your-nearest-store',
      basis: 'brand-source',
      scope: 'independent',
    },
    searchUrl: query => `https://medplusnig.com/search?q=${encodeURIComponent(query)}`,
    note: 'Nigeria pharmacy retailer named by CeraVe; direct catalogue pages expose Naira pricing.',
  },
  {
    name: 'BuyBetter',
    homepage: 'https://buybetter.ng/',
    market: 'NG',
    kind: 'retailer',
    trust: 97,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    identityEvidence: {
      observedAt: '2026-07-22T14:31:54Z',
      sourceUrl: 'https://africa.cerave.com/en/find-your-nearest-store',
      basis: 'brand-source',
      scope: 'independent',
    },
    searchUrl: wordpressSearch('https://buybetter.ng/'),
    note: 'Nigeria retailer named by CeraVe; exact listings can expose manufacturer GTINs and live stock.',
  },
  {
    name: 'Lux Beauty',
    homepage: 'https://www.luxbeautyng.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 96,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://www.luxbeautyng.com/'),
    note: 'Direct catalogue, Lagos pickup and nationwide delivery.',
  },
  {
    name: 'MakeupAlleyNG',
    homepage: 'https://makeupalleyng.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 92,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://makeupalleyng.com/'),
    note: 'Nigeria beauty retailer with direct product listings.',
  },
  {
    name: 'CSi Grocery',
    homepage: 'https://www.csigrocery.com/skincare/',
    market: 'NG',
    kind: 'retailer',
    trust: 90,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://www.csigrocery.com/'),
    note: 'Lagos and Ibadan stock counts with nationwide delivery.',
  },
  {
    name: 'Konga Health',
    homepage: 'https://www.konga.com/content/health',
    market: 'NG',
    kind: 'marketplace',
    trust: 88,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: query => `https://www.konga.com/search?search=${encodeURIComponent(query)}`,
    note: 'Large marketplace; seller and listing checks still apply.',
  },
  {
    name: 'Deoset',
    homepage: 'https://deoset.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 86,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://deoset.com/'),
    note: 'Nigeria beauty retailer with direct catalogue pages.',
  },
  {
    name: 'Nectar Beauty Hub',
    homepage: 'https://nectarbeautyhub.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 86,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://nectarbeautyhub.com/'),
    note: 'Nigeria beauty retailer with brand-led navigation.',
  },
  {
    name: 'Perona Beauty',
    homepage: 'https://peronabeauty.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 86,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://peronabeauty.com/'),
    note: 'Direct Nigeria catalogue with visible product pages.',
  },
  {
    name: 'Allure Beauty',
    homepage: 'https://allure.com.ng/',
    market: 'NG',
    kind: 'retailer',
    trust: 84,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://allure.com.ng/'),
    note: 'Nigeria beauty catalogue and store search.',
  },
  {
    name: 'BabesQuarters',
    homepage: 'https://babesquarters.ng/',
    market: 'NG',
    kind: 'retailer',
    trust: 84,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://babesquarters.ng/'),
    note: 'Nigeria beauty retailer with brand pages and product listings.',
  },
  {
    name: 'AGT Plaza',
    homepage: 'https://www.agtplaza.com/',
    market: 'NG',
    kind: 'marketplace',
    trust: 78,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: query => `https://www.agtplaza.com/search?q=${encodeURIComponent(query)}`,
    note: 'Nigeria marketplace with exact listings and visible Naira pricing.',
  },
  {
    name: 'Slique Beauty',
    homepage: 'https://sliquebeautylimited.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 78,
    reviewStatus: 'provisional',
    contentUse: 'link-only',
    identityEvidence: {
      observedAt: '2026-07-22T09:42:32Z',
      sourceUrl: 'https://sliquebeautylimited.com/contact-us/',
      basis: 'self-published-contact',
      scope: 'self-published',
    },
    searchUrl: wordpressSearch('https://sliquebeautylimited.com/'),
    note: 'Provisional link-only source. Contact details are self-published; no regulator or brand-authorization match is recorded.',
  },
  {
    name: 'Choices Beauty',
    homepage: 'https://choiceschi.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 72,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: wordpressSearch('https://choiceschi.com/'),
    note: 'Nigeria beauty retailer with direct catalogue pages.',
  },
  {
    name: 'Jumia',
    homepage: 'https://www.jumia.com.ng/',
    market: 'NG',
    kind: 'marketplace',
    trust: 62,
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    searchUrl: query => `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(query)}`,
    note: 'Marketplace results vary by seller; verify the listing before purchase.',
  },
];

export function retailerSearchUrl(retailerName: string, query: string) {
  return nigeriaRetailers.find(retailer => retailer.name === retailerName)?.searchUrl(query);
}

export function retailerEvidenceFor(retailerName: string): RetailerEvidence | undefined {
  const retailer = nigeriaRetailers.find(item => item.name === retailerName);
  if (!retailer) return undefined;
  return {
    reviewStatus: retailer.reviewStatus,
    contentUse: retailer.contentUse,
    identity: retailer.identityEvidence,
    regulatorMatch: retailer.regulatorMatchEvidence,
  };
}
