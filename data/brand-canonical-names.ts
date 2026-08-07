/**
 * Canonical brand name map.
 *
 * Some brands enter the catalogue under variant names (different casing,
 * punctuation, or legal suffixes). This map normalizes them to a single
 * canonical display name so that search, filtering, and product pages
 * group all products from the same company together.
 *
 * The intake manifest retains the original brand string for evidence
 * integrity; this map is applied at the read-model / display layer.
 *
 * To add a new mapping:
 * 1. Add the variant → canonical entry here.
 * 2. Run `npm run catalogue:search:bundle:build` to rebuild the search artifact.
 * 3. Add a test case in brand-canonical-names.test.ts.
 */
export const canonicalBrandNameMap: Readonly<Record<string, string>> = {
  // DANG! Lifestyle — danglifestyle.co
  'DANG': 'DANG! Lifestyle',
  'Dang Lifestyle': 'DANG! Lifestyle',
  'Dang! Lifestyle Inc.': 'DANG! Lifestyle',
  // Dove — unilever brand, casing varies by source
  'DOVE': 'Dove',
  // FACE FACTS — facefactsskincare.com
  'FaceFacts': 'FACE FACTS',
  // ANUA — anua.kr, casing varies by source
  'Anua': 'ANUA',
  // Estelin — estelin.co.in, source domain variant
  'estelinindia': 'ESTELIN',
};

/**
 * Returns the canonical brand name for a given brand string.
 * If no mapping exists, the original brand is returned unchanged.
 */
export function canonicalBrandName(brand: string): string {
  return canonicalBrandNameMap[brand] ?? brand;
}

/**
 * Returns the set of known aliases for a canonical brand name.
 * This is the inverse of {@link canonicalBrandNameMap}.
 */
export function brandAliasesFor(canonical: string): string[] {
  return Object.entries(canonicalBrandNameMap)
    .filter(([, value]) => value === canonical)
    .map(([key]) => key);
}
