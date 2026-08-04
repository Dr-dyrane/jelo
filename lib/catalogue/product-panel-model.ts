import 'server-only';

import { getReviewedProductCare } from '@/data/product-care-review';
import { isPublishedIntakeProduct } from '@/data/published-intake-products';
import type { Offer, Product } from '@/data/products';
import { listProductIngredientsSafe } from '@/lib/clinical/ingredients';
import { getProductPriceTrends } from '@/lib/inventory/price-trends';
import {
  priceTrendOfferSnapshot,
  type ProductPriceTrends,
} from '@/modules/commerce/price-trends';

export type ProductPanelTab = 'buy' | 'stores' | 'details';

export type ProductPanelData = {
  productSlug: string;
  productName: string;
  offers: Offer[];
  priceTrends?: ProductPriceTrends;
  careNote: string;
  usage: string;
  ingredients: Array<{ id: string; label: string; sourceUrl?: string }>;
  routine: Array<{ title: string; detail: string }>;
};

/**
 * Builds the complete evidence payload used by every product quick panel.
 * Keeping this server-owned prevents the public page and member workspace from
 * drifting on offer freshness, price history, care review, or ingredient safety.
 */
export async function readProductPanelData(product: Product): Promise<ProductPanelData> {
  const trendSnapshot = product.offers.flatMap(offer => {
    if (offer.match === 'search') return [];

    return (['NG', 'US'] as const).flatMap(market => {
      const snapshot = priceTrendOfferSnapshot(offer, market);
      return snapshot ? [snapshot] : [];
    });
  });

  const [priceTrends, productIngredients] = await Promise.all([
    getProductPriceTrends(product.slug, trendSnapshot),
    listProductIngredientsSafe(product.slug),
  ]);

  const careReview = getReviewedProductCare(product.slug);
  const catalogueVerified = isPublishedIntakeProduct(product.slug);
  const careNote = careReview?.careState === 'supportive_eligible'
    ? careReview.approvedUses.map(use => use.label).join(' · ')
    : careReview?.careState === 'pharmacist_review'
      ? 'Check with a pharmacist first.'
      : catalogueVerified
        ? product.displayLine
        : 'More formula evidence needed.';

  const ingredients = productIngredients.slice(0, 8).map(ingredient => {
    const concentration = ingredient.concentrationPercent == null
      ? ''
      : `${ingredient.concentrationPercent}% `;

    return {
      id: ingredient.id,
      label: `${concentration}${ingredient.commonName ?? ingredient.inciName}`,
      sourceUrl: ingredient.sourceUrl ?? undefined,
    };
  });

  return {
    productSlug: product.slug,
    productName: product.name,
    offers: product.offers,
    priceTrends,
    careNote,
    usage: product.usage,
    ingredients,
    routine: [],
  };
}
