import type { MetadataRoute } from 'next';
import { products } from '@/data/catalogue';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: 'https://jelocare.com', lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://jelocare.com/products', lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://jelocare.com/ingredients', lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://jelocare.com/consult', lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...products.map(product => ({ url: `https://jelocare.com/products/${product.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 }))
  ];
}
