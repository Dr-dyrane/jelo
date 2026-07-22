export type RetailerReference = {
  name: string;
  homepage: string;
  market: 'NG';
  kind: 'retailer' | 'marketplace';
  trust: number;
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
    searchUrl: wordpressSearch('https://beautybydaz.com/'),
    note: 'Lagos store, direct catalogue pages and visible Naira pricing.',
  },
  {
    name: 'Teeka4',
    homepage: 'https://teeka4.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 98,
    searchUrl: wordpressSearch('https://teeka4.com/'),
    note: 'Direct catalogue, sourcing guidance and visible stock status.',
  },
  {
    name: 'Lush Hair Nigeria',
    homepage: 'https://nigeria.lushhairafrica.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 98,
    searchUrl: query => `https://nigeria.lushhairafrica.com/search?q=${encodeURIComponent(query)}`,
    note: 'Official Nigeria brand shop with visible stock and Naira pricing.',
  },
  {
    name: 'Lux Beauty',
    homepage: 'https://www.luxbeautyng.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 96,
    searchUrl: wordpressSearch('https://www.luxbeautyng.com/'),
    note: 'Direct catalogue, Lagos pickup and nationwide delivery.',
  },
  {
    name: 'MakeupAlleyNG',
    homepage: 'https://makeupalleyng.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 92,
    searchUrl: wordpressSearch('https://makeupalleyng.com/'),
    note: 'Nigeria beauty retailer with direct product listings.',
  },
  {
    name: 'CSi Grocery',
    homepage: 'https://www.csigrocery.com/skincare/',
    market: 'NG',
    kind: 'retailer',
    trust: 90,
    searchUrl: wordpressSearch('https://www.csigrocery.com/'),
    note: 'Lagos and Ibadan stock counts with nationwide delivery.',
  },
  {
    name: 'Konga Health',
    homepage: 'https://www.konga.com/content/health',
    market: 'NG',
    kind: 'marketplace',
    trust: 88,
    searchUrl: query => `https://www.konga.com/search?search=${encodeURIComponent(query)}`,
    note: 'Large marketplace; seller and listing checks still apply.',
  },
  {
    name: 'Deoset',
    homepage: 'https://deoset.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 86,
    searchUrl: wordpressSearch('https://deoset.com/'),
    note: 'Nigeria beauty retailer with direct catalogue pages.',
  },
  {
    name: 'Nectar Beauty Hub',
    homepage: 'https://nectarbeautyhub.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 86,
    searchUrl: wordpressSearch('https://nectarbeautyhub.com/'),
    note: 'Nigeria beauty retailer with brand-led navigation.',
  },
  {
    name: 'Perona Beauty',
    homepage: 'https://peronabeauty.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 86,
    searchUrl: wordpressSearch('https://peronabeauty.com/'),
    note: 'Direct Nigeria catalogue with visible product pages.',
  },
  {
    name: 'Allure Beauty',
    homepage: 'https://allure.com.ng/',
    market: 'NG',
    kind: 'retailer',
    trust: 84,
    searchUrl: wordpressSearch('https://allure.com.ng/'),
    note: 'Nigeria beauty catalogue and store search.',
  },
  {
    name: 'BabesQuarters',
    homepage: 'https://babesquarters.ng/',
    market: 'NG',
    kind: 'retailer',
    trust: 84,
    searchUrl: wordpressSearch('https://babesquarters.ng/'),
    note: 'Nigeria beauty retailer with brand pages and product listings.',
  },
  {
    name: 'AGT Plaza',
    homepage: 'https://www.agtplaza.com/',
    market: 'NG',
    kind: 'marketplace',
    trust: 78,
    searchUrl: query => `https://www.agtplaza.com/search?q=${encodeURIComponent(query)}`,
    note: 'Nigeria marketplace with exact listings and visible Naira pricing.',
  },
  {
    name: 'Slique Beauty',
    homepage: 'https://sliquebeautylimited.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 78,
    searchUrl: wordpressSearch('https://sliquebeautylimited.com/'),
    note: 'Lagos beauty retailer with nationwide delivery.',
  },
  {
    name: 'Choices Beauty',
    homepage: 'https://choiceschi.com/',
    market: 'NG',
    kind: 'retailer',
    trust: 72,
    searchUrl: wordpressSearch('https://choiceschi.com/'),
    note: 'Nigeria beauty retailer with direct catalogue pages.',
  },
  {
    name: 'Jumia',
    homepage: 'https://www.jumia.com.ng/',
    market: 'NG',
    kind: 'marketplace',
    trust: 62,
    searchUrl: query => `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(query)}`,
    note: 'Marketplace results vary by seller; verify the listing before purchase.',
  },
];

export function retailerSearchUrl(retailerName: string, query: string) {
  return nigeriaRetailers.find(retailer => retailer.name === retailerName)?.searchUrl(query);
}
