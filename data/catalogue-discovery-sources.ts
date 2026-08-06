export type CataloguePrivateSourceByteRetention =
  | {
    capability: 'private-exact-product-response-audit';
    rationale: 'reopen-dated-offer-fields-and-verify-response-integrity';
    retentionBoundary: 'private-evidence-repository-only';
    publicContentReuse: 'none';
    publicImageReuse: 'none';
  }
  | {
    capability: 'none';
    rationale: 'no-reviewed-private-response-retention-grant';
    retentionBoundary: 'none';
    publicContentReuse: 'none';
    publicImageReuse: 'none';
  };

export type CatalogueDiscoverySource = {
  key: string;
  retailer: string;
  endpoint: string;
  host: string;
  reviewStatus: 'directory-listed' | 'provisional';
  trust: number;
  contentUse: 'link-only';
  privateSourceByteRetention: CataloguePrivateSourceByteRetention;
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
    privateSourceByteRetention: {
      capability: 'private-exact-product-response-audit',
      rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
      retentionBoundary: 'private-evidence-repository-only',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
  {
    key: 'lux-beauty-ng',
    retailer: 'Lux Beauty',
    endpoint: 'https://www.luxbeautyng.com/wp-json/wc/store/v1/products',
    host: 'luxbeautyng.com',
    reviewStatus: 'directory-listed',
    trust: 96,
    contentUse: 'link-only',
    privateSourceByteRetention: {
      capability: 'none',
      rationale: 'no-reviewed-private-response-retention-grant',
      retentionBoundary: 'none',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
  {
    key: 'slique-beauty',
    retailer: 'Slique Beauty',
    endpoint: 'https://sliquebeautylimited.com/wp-json/wc/store/v1/products',
    host: 'sliquebeautylimited.com',
    reviewStatus: 'provisional',
    trust: 78,
    contentUse: 'link-only',
    privateSourceByteRetention: {
      capability: 'private-exact-product-response-audit',
      rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
      retentionBoundary: 'private-evidence-repository-only',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
  {
    key: 'reginah',
    retailer: 'Reginah',
    endpoint: 'https://reginah.com/wp-json/wc/store/v1/products',
    host: 'reginah.com',
    reviewStatus: 'provisional',
    trust: 60,
    contentUse: 'link-only',
    privateSourceByteRetention: {
      capability: 'private-exact-product-response-audit',
      rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
      retentionBoundary: 'private-evidence-repository-only',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
  {
    key: 'beureva',
    retailer: 'Beureva',
    endpoint: 'https://beureva.com/wp-json/wc/store/v1/products',
    host: 'beureva.com',
    reviewStatus: 'provisional',
    trust: 60,
    contentUse: 'link-only',
    privateSourceByteRetention: {
      capability: 'private-exact-product-response-audit',
      rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
      retentionBoundary: 'private-evidence-repository-only',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
  {
    key: 'rhema-beauty-shop',
    retailer: 'Rhema Beauty Shop',
    endpoint: 'https://rhemabeautyshop.com/wp-json/wc/store/v1/products',
    host: 'rhemabeautyshop.com',
    reviewStatus: 'provisional',
    trust: 60,
    contentUse: 'link-only',
    privateSourceByteRetention: {
      capability: 'private-exact-product-response-audit',
      rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
      retentionBoundary: 'private-evidence-repository-only',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
  {
    key: 'main-market-online',
    retailer: 'Main Market Online',
    endpoint: 'https://mainmarketonline.com/wp-json/wc/store/v1/products',
    host: 'mainmarketonline.com',
    reviewStatus: 'provisional',
    trust: 60,
    contentUse: 'link-only',
    privateSourceByteRetention: {
      capability: 'private-exact-product-response-audit',
      rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
      retentionBoundary: 'private-evidence-repository-only',
      publicContentReuse: 'none',
      publicImageReuse: 'none',
    },
  },
] as const;
