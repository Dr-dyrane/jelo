export type EvidenceBasis =
  | 'retailer-page'
  | 'retailer-api'
  | 'self-published-contact'
  | 'independent-register'
  | 'brand-source';

export type EvidenceReference = {
  observedAt: string;
  sourceUrl: string;
  basis: EvidenceBasis;
};

export type RetailerReviewStatus = 'directory-listed' | 'provisional';
export type ContentUsePolicy = 'link-only' | 'licensed';

export type RetailerIdentityEvidence = EvidenceReference & {
  scope: 'self-published' | 'independent';
};

export type RegulatorMatchEvidence = EvidenceReference & {
  authority: string;
  registrationNumber: string;
};

export type RetailerEvidence = {
  reviewStatus: RetailerReviewStatus;
  contentUse: ContentUsePolicy;
  identity?: RetailerIdentityEvidence;
  regulatorMatch?: RegulatorMatchEvidence;
};

export type SellerIdentityEvidence = EvidenceReference & {
  sellerName: string;
};

export type BrandAuthorizationEvidence = EvidenceReference & {
  brand: string;
};

export type ObservedStock = 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown';
export type LandedCostStatus = 'included' | 'excluded' | 'unknown';

export type PriceObservation = {
  observedAt: string;
  variant: string;
  size: string;
  stock: ObservedStock;
  landedCost: LandedCostStatus;
};
