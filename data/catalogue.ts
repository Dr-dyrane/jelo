import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';
import { isProductDisplayApproved } from '@/data/product-display-approvals';
import productAssets from '@/data/product-assets.json';
import { publishedIntakeProducts } from '@/data/published-intake-products';
import { mergeRetailOffers } from '@/data/retail-offers';
import { verifiedActiveIngredientIds } from '@/data/product-ingredients';
import { withheldProductAssets } from '@/data/withheld-product-assets';

type ProductAsset = { blobUrl: string; sourceUrl: string; hasAlpha: boolean; width: number; height: number; contentHash: string };

const canonicalAssets = productAssets as Record<string, ProductAsset>;
const rightsHeldSlugs = new Set(Object.keys(withheldProductAssets));
export const reviewedProductRecords = [...coreProducts, ...expandedProducts].map(product => ({
  ...product,
  image: canonicalAssets[product.slug]?.blobUrl ?? product.image,
  verifiedIngredientIds: verifiedActiveIngredientIds(product.slug),
  offers: mergeRetailOffers(product, product.offers),
}));

// Product shelves fail closed: no placeholder, rights hold, or opaque studio
// image can enter a public browse surface. Research records remain available in
// their source manifests until a transparent, reviewed replacement is approved.
const displayApprovedReviewedProducts = reviewedProductRecords.filter(product => (
  !rightsHeldSlugs.has(product.slug)
  && canonicalAssets[product.slug]?.hasAlpha === true
  && Math.min(canonicalAssets[product.slug]?.width ?? 0, canonicalAssets[product.slug]?.height ?? 0) >= 1000
  && isProductDisplayApproved(product, canonicalAssets[product.slug])
  && !product.image.startsWith('/product-fallback')
  && !product.image.startsWith('/product-placeholder')
));
const reviewedSlugs = new Set(reviewedProductRecords.map(product => product.slug));
for (const product of publishedIntakeProducts) {
  if (reviewedSlugs.has(product.slug)) {
    throw new Error(`${product.slug} cannot be published twice across catalogue sources.`);
  }
}
export const products = [...displayApprovedReviewedProducts, ...publishedIntakeProducts];
export const productBySlug = (slug: string) => products.find(product => product.slug === slug);
