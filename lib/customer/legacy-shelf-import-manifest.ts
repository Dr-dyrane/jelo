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
  rejected: [
    { legacyId: 'dove', reason: 'ambiguous-legacy-identity' },
    { legacyId: 'deodorant', reason: 'ambiguous-legacy-identity' },
    { legacyId: 'bright', reason: 'no-reviewed-public-binding' },
    { legacyId: 'blab', reason: 'no-reviewed-public-binding' },
    { legacyId: 'miracle', reason: 'no-reviewed-public-binding' },
    { legacyId: 'lush', reason: 'no-reviewed-public-binding' },
    { legacyId: 'mediana', reason: 'no-reviewed-public-binding' },
    { legacyId: 'kuza', reason: 'no-reviewed-public-binding' },
    { legacyId: 'disaar', reason: 'no-reviewed-public-binding' },
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
