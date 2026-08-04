export const LEGACY_SHELF_IMPORT_MANIFEST = {
  id: 'pages-v1.0',
  source: {
    commit: '04c45c87db839d516d0dc91cf93ac690445a9949',
    products: {
      path: 'assets/data/products.json',
      sha256: '17d6d7173dc2a724eaad873afbc43b5b1b325ea87baa3e4faa922214c73b89f3',
      legacyIds: [
        'cosrx',
        'somebymi',
        'anua',
        'wonder',
        'bright',
        'blab',
        'dove',
        'deodorant',
        'miracle',
        'lush',
        'mediana',
        'kuza',
        'ogx',
        'disaar',
      ],
    },
    routine: {
      path: 'assets/js/components.js',
      sha256: '3326dd88e087807ec11223755364ef04aebe2cb61ff65c5021e8211a3d01fe6f',
    },
  },
  accepted: [
    {
      legacyId: 'cosrx',
      identityVersion: {
        slugAtReview: 'cosrx-salicylic-acid-daily-gentle-cleanser',
        brandAtReview: 'COSRX',
        variantAtReview: 'Salicylic Acid Daily Gentle Cleanser',
        sizeAtReview: '150 ml',
      },
      provenance: {
        category: 'Face', step: 'Cleanse', purpose: 'Cleanse · clarify',
        usage: 'Morning and evening', priority: 'Essential',
        routineReferences: ['morning:01:COSRX cleanser'],
      },
    },
    {
      legacyId: 'somebymi',
      identityVersion: {
        slugAtReview: 'some-by-mi-aha-bha-pha-miracle-toner',
        brandAtReview: 'SOME BY MI',
        variantAtReview: 'AHA·BHA·PHA 30 Days Miracle Toner',
        sizeAtReview: '150 ml',
      },
      provenance: {
        category: 'Face', step: 'Exfoliate', purpose: 'Exfoliate · refine',
        usage: 'Evening, twice weekly', priority: 'Controlled',
        routineReferences: ['evening:02:Toner twice weekly'],
      },
    },
    {
      legacyId: 'anua',
      identityVersion: {
        slugAtReview: 'anua-niacinamide-10-txa-4-serum',
        brandAtReview: 'ANUA',
        variantAtReview: 'Niacinamide 10% + TXA 4% Serum',
        sizeAtReview: '30 ml',
      },
      provenance: {
        category: 'Face', step: 'Treat', purpose: 'Correct · brighten',
        usage: 'Morning and most evenings', priority: 'Essential',
        routineReferences: ['morning:02:Anua serum', 'evening:02:Anua most nights'],
      },
    },
    {
      legacyId: 'wonder',
      identityVersion: {
        slugAtReview: 'face-facts-wonder-cream-fragrance-free',
        brandAtReview: 'FACE FACTS',
        variantAtReview: 'Wonder Cream Fragrance Free',
        sizeAtReview: '50 ml',
      },
      provenance: {
        category: 'Face', step: 'Moisturize', purpose: 'Hydrate · comfort',
        usage: 'Morning or barrier nights', priority: 'Essential',
        routineReferences: ['morning:03:Wonder Cream', 'evening:03:Wonder Cream'],
      },
    },
    {
      legacyId: 'ogx',
      identityVersion: {
        slugAtReview: 'ogx-renewing-argan-oil-of-morocco',
        brandAtReview: 'OGX',
        variantAtReview: 'Renewing + Argan Oil of Morocco Extra Penetrating Oil',
        sizeAtReview: '100 ml',
      },
      provenance: {
        category: 'Hair', step: 'Finish', purpose: 'Gloss · finish',
        usage: 'Hair lengths and ends', priority: 'Preferred',
        routineReferences: ['hair:04:Kuza + OGX'],
      },
    },
  ],
  pendingRequests: [
    {
      legacyId: 'bright',
      request: {
        brand: 'FACE FACTS',
        fullPackName: 'Bright + Clear Face Cream',
        printedSizeVariant: '75 ml',
        category: 'Face',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/shop/face/face-facts-bright-clear-face-cream-75ml/',
      },
      provenance: {
        step: 'Moisturize', purpose: 'Even · soften', usage: 'Standard evenings', priority: 'Keep',
        routineReferences: ['evening:03:Bright + Clear or Wonder Cream'],
      },
    },
    {
      legacyId: 'blab',
      request: {
        brand: 'B.LAB',
        fullPackName: 'Matcha Hydrating Real Sunscreen SPF50+ PA++++',
        printedSizeVariant: '50 ml',
        category: 'Face',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/shop/face/sunscreens/b-lab-matcha-hydrating-real-sun-screen-spf50-pa/',
      },
      provenance: {
        step: 'Protect', purpose: 'Shield · preserve', usage: 'Every morning', priority: 'Never skip',
        routineReferences: ['morning:04:B.LAB sunscreen'],
      },
    },
    {
      legacyId: 'dove',
      request: {
        brand: 'DOVE',
        fullPackName: 'Beauty Bar — Moroccan Argan Oil',
        printedSizeVariant: 'Variant pack',
        category: 'Body',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=dove+moroccan+argan+oil+beauty+bar&post_type=product',
      },
      provenance: {
        step: 'Cleanse', purpose: 'Cleanse · soften', usage: 'Daily', priority: 'Essential',
        routineReferences: [],
      },
    },
    {
      legacyId: 'deodorant',
      request: {
        brand: 'DOVE',
        fullPackName: 'Go Fresh Cucumber & Green Tea Spray',
        printedSizeVariant: 'Aerosol',
        category: 'Body',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=dove+go+fresh+cucumber+green+tea+spray&post_type=product',
      },
      provenance: {
        step: 'Protect', purpose: 'Freshen · protect', usage: 'Daily', priority: 'Keep',
        routineReferences: [],
      },
    },
    {
      legacyId: 'miracle',
      request: {
        brand: 'BEAUTIFUL YOU · MIRACLE',
        fullPackName: 'Natural Hair Anti-Dandruff & Anti-Itch Shampoo',
        printedSizeVariant: '400 ml',
        category: 'Hair',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=miracle+natural+hair+anti+dandruff+shampoo&post_type=product',
      },
      provenance: {
        step: 'Cleanse', purpose: 'Cleanse · calm', usage: 'Wash days', priority: 'Essential',
        routineReferences: ['hair:01:Miracle shampoo'],
      },
    },
    {
      legacyId: 'lush',
      request: {
        brand: 'LUSH HAIR',
        fullPackName: 'Rinse Me Out Mentholated Conditioner',
        printedSizeVariant: '370 ml',
        category: 'Hair',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=lush+hair+mentholated+conditioner&post_type=product',
      },
      provenance: {
        step: 'Condition', purpose: 'Condition · detangle', usage: 'After shampoo', priority: 'Keep',
        routineReferences: ['hair:02:Lush conditioner'],
      },
    },
    {
      legacyId: 'mediana',
      request: {
        brand: 'MEDIANA',
        fullPackName: 'Leave-In Conditioning Milk',
        printedSizeVariant: '250 ml',
        category: 'Hair',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=mediana+leave-in+conditioning+milk&post_type=product',
      },
      provenance: {
        step: 'Leave in', purpose: 'Detangle · soften', usage: 'After wash', priority: 'Essential',
        routineReferences: ['hair:03:Mediana milk'],
      },
    },
    {
      legacyId: 'kuza',
      request: {
        brand: 'KUZA',
        fullPackName: '100% Indian Hemp Hair & Scalp Treatment',
        printedSizeVariant: '8 oz / 226 g',
        category: 'Hair',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=kuza+indian+hemp+hair+scalp+treatment&post_type=product',
      },
      provenance: {
        step: 'Seal', purpose: 'Treat · seal', usage: 'Small amount as needed', priority: 'Keep',
        routineReferences: ['hair:04:Kuza + OGX'],
      },
    },
    {
      legacyId: 'disaar',
      request: {
        brand: 'DISAAR',
        fullPackName: 'Argan Oil Body Oil Gel',
        printedSizeVariant: 'Body oil gel',
        category: 'Body',
        retailerLabel: 'Beauty by Daz',
        sourceUrl: 'https://beautybydaz.com/?s=disaar+argan+oil+body+oil+gel&post_type=product',
      },
      provenance: {
        step: 'Moisturize', purpose: 'Moisturize · glow', usage: 'After shower', priority: 'Keep',
        routineReferences: [],
      },
    },
  ],
  requiredIdentity: {
    versionNumber: 1,
    provenance: 'jelocare_reviewed',
    publicEligibilityBasis: 'reviewed_catalogue_projection',
    packageVersion: 'reviewed-baseline-v1:static-v1',
    formulaVersion: 'reviewed-baseline-v1:static-v1',
    lifecycleState: 'active',
  },
} as const;

export type LegacyShelfImportManifest = typeof LEGACY_SHELF_IMPORT_MANIFEST;
