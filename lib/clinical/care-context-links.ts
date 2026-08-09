const ingredientLibrarySlugs = new Set([
  "arbutin",
  "azelaic-acid",
  "benzoyl-peroxide",
  "ceramide-ap",
  "ceramide-eop",
  "ceramide-np",
  "hydrolyzed-hyaluronic-acid",
  "niacinamide",
  "salicylic-acid",
  "snail-secretion-filtrate",
  "tranexamic-acid",
]);

const ingredientTextLinks = [
  {
    pattern: /\bbenzoyl peroxide\b/i,
    slug: "benzoyl-peroxide",
    label: "Benzoyl peroxide",
  },
  {
    pattern: /\btranexamic acid\b/i,
    slug: "tranexamic-acid",
    label: "Tranexamic acid",
  },
  {
    pattern: /\bsalicylic acid\b/i,
    slug: "salicylic-acid",
    label: "Salicylic acid",
  },
  { pattern: /\bazelaic acid\b/i, slug: "azelaic-acid", label: "Azelaic acid" },
  { pattern: /\bniacinamide\b/i, slug: "niacinamide", label: "Niacinamide" },
] as const;

const concernLinkByLabel: Record<string, { slug: string; label: string }> = {
  acne: { slug: "acne-breakouts", label: "Acne & breakouts" },
  blackheads: { slug: "acne-breakouts", label: "Acne & breakouts" },
  congestion: { slug: "oily-congested-skin", label: "Oily & congested skin" },
  "inflamed spots": { slug: "acne-breakouts", label: "Acne & breakouts" },
  oiliness: { slug: "oily-congested-skin", label: "Oily & congested skin" },
  hyperpigmentation: { slug: "dark-spots", label: "Dark spots" },
  "dark spots": { slug: "dark-spots", label: "Dark spots" },
  barrier: { slug: "sensitive-barrier", label: "Sensitive skin & barrier" },
  sensitivity: { slug: "sensitive-barrier", label: "Sensitive skin & barrier" },
  dryness: { slug: "dry-dehydrated-skin", label: "Dry & dehydrated skin" },
  photoaging: { slug: "daily-sun-protection", label: "Daily sun protection" },
  "sun protection": {
    slug: "daily-sun-protection",
    label: "Daily sun protection",
  },
};

/** Internal ingredient guides exist only for the source-checked seed library. */
export function ingredientLibraryHref(slug: string) {
  return ingredientLibrarySlugs.has(slug) ? `/ingredients#${slug}` : null;
}

/** Maps exact named ingredients in concern copy to source-checked library guides. */
export function ingredientLibraryReference(text: string) {
  const match = ingredientTextLinks.find((item) => item.pattern.test(text));
  return match
    ? {
        slug: match.slug,
        label: match.label,
        href: `/ingredients#${match.slug}`,
      }
    : null;
}

/** Exact vocabulary bridge from ingredient evidence to existing concern guides. */
export function concernGuideLinks(labels: string[]) {
  const seen = new Set<string>();
  return labels.flatMap((label) => {
    const link = concernLinkByLabel[label.trim().toLowerCase()];
    if (!link || seen.has(link.slug)) return [];
    seen.add(link.slug);
    return [{ ...link, href: `/concerns/${link.slug}` }];
  });
}
