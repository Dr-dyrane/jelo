export type CatalogueDiscoverySource = {
  key: string;
  retailer: string;
  endpoint: string;
  host: string;
  reviewStatus: 'directory-listed' | 'provisional';
  trust: number;
  contentUse: 'link-only';
};

export const catalogueDiscoverySources: readonly CatalogueDiscoverySource[] = [
  {
    key: 'buybetter',
    retailer: 'BuyBetter',
    endpoint: 'https://buybetter.ng/wp-json/wc/store/v1/products',
    host: 'buybetter.ng',
    reviewStatus: 'directory-listed',
    trust: 97,
    contentUse: 'link-only',
  },
  {
    key: 'lux-beauty-ng',
    retailer: 'Lux Beauty',
    endpoint: 'https://www.luxbeautyng.com/wp-json/wc/store/v1/products',
    host: 'luxbeautyng.com',
    reviewStatus: 'directory-listed',
    trust: 96,
    contentUse: 'link-only',
  },
  {
    key: 'slique-beauty',
    retailer: 'Slique Beauty',
    endpoint: 'https://sliquebeautylimited.com/wp-json/wc/store/v1/products',
    host: 'sliquebeautylimited.com',
    reviewStatus: 'provisional',
    trust: 78,
    contentUse: 'link-only',
  },
] as const;
