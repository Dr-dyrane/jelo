import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';
import productAssets from '@/data/product-assets.json';
import { mergeRetailOffers } from '@/data/retail-offers';
import { verifiedActiveIngredientIds } from '@/data/product-ingredients';

type ProductAsset = { blobUrl: string };

const canonicalAssets = productAssets as Record<string, ProductAsset>;
const catalogueCandidates = [...coreProducts, ...expandedProducts].map(product => ({
  ...product,
  image: canonicalAssets[product.slug]?.blobUrl ?? product.image,
  verifiedIngredientIds: verifiedActiveIngredientIds(product.slug),
  offers: mergeRetailOffers(product, product.offers),
}));

export const products = catalogueCandidates.filter(product => !product.image.startsWith('/product-fallback'));
export const productBySlug = (slug: string) => products.find(product => product.slug === slug);
