import type { ReviewedProduct } from '@/data/products';
import { hasListingEvidence } from '@/modules/commerce/offer-evidence';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';
import {
  assessCatalogueQuality,
  type CatalogueQualityAssessment,
  type ImageRights,
  type PublicAssetOrigin,
} from './catalogue-publication-gate';

export type ReviewedAssetAudit = {
  rights: ImageRights;
  origin: PublicAssetOrigin;
  packaging: 'intact' | 'clipped' | 'unknown';
  sourceFaithful: boolean;
  backgroundTreatment: 'none' | 'styled-composite' | 'automated-removal' | 'unknown';
  labelVariantSizeUnchanged: boolean;
  packagingInvented: boolean | 'unknown';
  manualSourceOutputQa: boolean;
  presentationQuality: 'magazine-ready' | 'ordinary' | 'unknown';
};

export type ReviewedProductQualityAudit = {
  productSlug: string;
  publicationEligibilityChanged: false;
  assessment: CatalogueQualityAssessment;
};

const unknownAsset: ReviewedAssetAudit = {
  rights: 'missing',
  origin: 'unknown',
  packaging: 'unknown',
  sourceFaithful: false,
  backgroundTreatment: 'unknown',
  labelVariantSizeUnchanged: false,
  packagingInvented: 'unknown',
  manualSourceOutputQa: false,
  presentationQuality: 'unknown',
};

export function auditReviewedProductQuality(
  product: ReviewedProduct,
  asset: ReviewedAssetAudit = unknownAsset,
): ReviewedProductQualityAudit {
  const exactNigeriaOffer = product.offers.some(offer =>
    offer.match !== 'search'
    && (offer.location.includes('NG') || offer.location.includes('INTL'))
    && hasListingEvidence(offer)
    && isOfferFresh(offer),
  );

  return {
    productSlug: product.slug,
    publicationEligibilityChanged: false,
    assessment: assessCatalogueQuality({
      id: product.slug,
      source: 'reviewed',
      identityTraceable: Boolean(product.slug && product.brand.trim() && product.name.trim() && product.size.trim()),
      formulaEvidence: product.verifiedIngredientIds?.length ? 'partial' : 'missing',
      productEvidence: product.evidence,
      exactNigeriaOffer,
      imageRights: asset.rights,
      assetOrigin: asset.origin,
      packaging: asset.packaging,
      sourceFaithful: asset.sourceFaithful,
      backgroundTreatment: asset.backgroundTreatment,
      labelVariantSizeUnchanged: asset.labelVariantSizeUnchanged,
      packagingInvented: asset.packagingInvented,
      manualSourceOutputQa: asset.manualSourceOutputQa,
      presentationQuality: asset.presentationQuality,
    }),
  };
}
