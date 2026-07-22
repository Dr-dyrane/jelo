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

type RetailerIdentityEvidenceBase = Omit<EvidenceReference, 'basis'> & {
  scope: 'self-published' | 'independent';
};

export type RetailerIdentityEvidence =
  | (RetailerIdentityEvidenceBase & {
    basis: 'brand-source';
    scope: 'independent';
    subjectSeller: string;
    subjectHost: string;
    locator: string;
    sourceText: string;
    sourceExcerptSha256: string;
    responseUrl: string;
    responseSha256: string;
    responseDigestScope: 'decoded-response-body';
    responseMimeType: 'application/json' | 'text/html';
    responseByteSize: number;
    retrievedAt: string;
    reviewer: string;
    reviewedAt: string;
  })
  | (RetailerIdentityEvidenceBase & {
    basis: Exclude<EvidenceBasis, 'brand-source'>;
  });

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
