import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';

const catalogueCandidates = [...coreProducts, ...expandedProducts];

export const products = catalogueCandidates.filter(product => !product.image.startsWith('/product-fallback'));
export const productBySlug = (slug: string) => products.find(product => product.slug === slug);