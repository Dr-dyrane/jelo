import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';

export const products = [...coreProducts, ...expandedProducts];
export const productBySlug = (slug: string) => products.find(product => product.slug === slug);
