export type PharmacyCareReviewAttestationDisposition = "reviewed_context_only";

export type PharmacyCareReviewAttestation = {
  version: string;
  reviewerLabel: string;
  approvedAt: string;
  disposition: PharmacyCareReviewAttestationDisposition;
};

const pharmacistReviewProductSlugs = Object.freeze([
  "cosrx-salicylic-acid-daily-gentle-cleanser",
  "some-by-mi-aha-bha-pha-miracle-toner",
  "anua-niacinamide-10-txa-4-serum",
  "face-facts-wonder-cream-fragrance-free",
  "face-facts-bright-clear-face-cream",
  "b-lab-matcha-hydrating-real-sunscreen",
  "dove-moroccan-argan-oil-beauty-bar",
  "lush-hair-mentholated-conditioner",
  "mediana-leave-in-conditioning-milk",
  "kuza-indian-hemp-hair-scalp-treatment",
  "disaar-argan-oil-body-oil-gel",
  "the-ordinary-azelaic-acid-suspension-10",
  "panoxyl-acne-foaming-wash-10-benzoyl-peroxide",
  "skin-by-zaron-vitamin-c-body-lotion-500ml",
  "c28f590dd2739ea73f1b5ea3",
  "la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml",
  "loccitane-almond-softening-shower-oil-250ml",
  "panoxyl-acne-creamy-wash-4-170g",
  "naturium-dew-glow-moisturizer-spf-50-1-7fl-oz",
  "cerave-blemish-control-cleanser",
  "beauty-formulas-glowing-serum-2-vitamin-c-30ml",
  "cerave-sa-smoothing-cleanser-473ml",
  "cerave-acne-foaming-cream-wash-10-150ml",
  "balance-salicylic-acid-zinc-clarifying-toner-200ml",
  "keracare-dry-itchy-scalp-conditioner-950ml",
  "balance-niacinamide-blemish-recovery-serum-30ml",
  "nineless-a-control-10-azelaic-acid-serum-30ml",
  "nineless-mela-pro-rice-txa-toner-200ml",
  "de-la-cruz-acne-treatment-10-sulfur-73-7g",
  "laroche-posay-mela-b3-serum-30ml",
  "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
  "facefacts-ceramide-blemish-gel-moisturiser-50ml",
  "skin-by-zaron-vitamin-c-body-wash-650ml",
  "prequel-gleanser-glycolic-acid-cleanser-400ml",
  "cerave-acne-foaming-cream-cleanser-4-150ml",
  "saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml",
  "dang-vitamin-c-concentrated-serum-oil-free-30ml",
  "dang-azelaic-acid-serum-30ml",
  "medik8-advanced-night-restore-50ml",
] as const);

/**
 * JeloCare pharmacy approval is deliberately bound to this exact cohort.
 * A future `pharmacist_review` product receives no attestation until a new,
 * versioned record names it explicitly.
 */
export const pharmacyCareReviewAttestationV1 = Object.freeze({
  version: "pharmacy-care-review/2026-08-31/v1",
  reviewerLabel: "JeloCare pharmacist",
  approvedAt: "2026-08-31",
  disposition: "reviewed_context_only" as const,
  productCount: 39,
  productSlugs: pharmacistReviewProductSlugs,
});

const attestedProductSlugs = new Set<string>(pharmacistReviewProductSlugs);

export function getPharmacyCareReviewAttestation(
  productSlug: string,
): PharmacyCareReviewAttestation | undefined {
  if (!attestedProductSlugs.has(productSlug)) return undefined;

  const { version, reviewerLabel, approvedAt, disposition } =
    pharmacyCareReviewAttestationV1;
  return { version, reviewerLabel, approvedAt, disposition };
}
