import type { Product } from '@/data/products';

type CoreClassification = Pick<Product, 'slug' | 'category' | 'step'> & {
  legacyId: string;
};

/**
 * JeloCare's original 14-product dossier.
 *
 * The classification is preserved from pages-v1-static. Canonical names and
 * exact sizes continue to live in products.ts, where later identity research
 * can improve them without erasing the original catalogue taxonomy.
 */
export const jeloCoreProductDossier = {
  sourceBranch: 'pages-v1-static',
  sourcePath: 'assets/data/products.json',
  sourceSha256: '17d6d7173dc2a724eaad873afbc43b5b1b325ea87baa3e4faa922214c73b89f3',
  products: [
    { legacyId: 'cosrx', slug: 'cosrx-salicylic-acid-daily-gentle-cleanser', category: 'Face', step: 'Cleanse' },
    { legacyId: 'somebymi', slug: 'some-by-mi-aha-bha-pha-miracle-toner', category: 'Face', step: 'Exfoliate' },
    { legacyId: 'anua', slug: 'anua-niacinamide-10-txa-4-serum', category: 'Face', step: 'Treat' },
    { legacyId: 'wonder', slug: 'face-facts-wonder-cream-fragrance-free', category: 'Face', step: 'Moisturize' },
    { legacyId: 'bright', slug: 'face-facts-bright-clear-face-cream', category: 'Face', step: 'Moisturize' },
    { legacyId: 'blab', slug: 'b-lab-matcha-hydrating-real-sunscreen', category: 'Face', step: 'Protect' },
    { legacyId: 'dove', slug: 'dove-moroccan-argan-oil-beauty-bar', category: 'Body', step: 'Cleanse' },
    { legacyId: 'deodorant', slug: 'dove-go-fresh-cucumber-green-tea-spray', category: 'Body', step: 'Protect' },
    { legacyId: 'miracle', slug: 'miracle-natural-hair-anti-dandruff-shampoo', category: 'Hair', step: 'Cleanse' },
    { legacyId: 'lush', slug: 'lush-hair-mentholated-conditioner', category: 'Hair', step: 'Condition' },
    { legacyId: 'mediana', slug: 'mediana-leave-in-conditioning-milk', category: 'Hair', step: 'Leave in' },
    { legacyId: 'kuza', slug: 'kuza-indian-hemp-hair-scalp-treatment', category: 'Hair', step: 'Seal' },
    { legacyId: 'ogx', slug: 'ogx-renewing-argan-oil-of-morocco', category: 'Hair', step: 'Finish' },
    { legacyId: 'disaar', slug: 'disaar-argan-oil-body-oil-gel', category: 'Body', step: 'Moisturize' },
  ] satisfies CoreClassification[],
} as const;
