/**
 * Bridge between community contributions and the product care review process.
 *
 * Products in `insufficient_data` care state cannot be recommended through
 * the consult engine. Community contributions (outcomes, prices, store
 * observations) provide real-world evidence that can help move a product
 * from `insufficient_data` toward `pharmacist_review` or
 * `supportive_eligible`.
 *
 * This module is clinical authority. It does not automatically change care
 * states — it surfaces evidence for a human pharmacist or operator to review.
 */

import {
  getReviewedProductCare,
  type ProductCareState,
  type ReviewedProductCare,
} from "@/data/product-care-review";
import {
  getPharmacyCareReviewAttestation,
  type PharmacyCareReviewAttestation,
} from "@/data/product-care-review-attestation";

export type ProductCareEvidenceSignal = {
  productSlug: string;
  currentCareState: ProductCareState;
  hasCommunityOutcome: boolean;
  outcomeSummary: {
    loveIt: number;
    helped: number;
    unsure: number;
    didntHelp: number;
    total: number;
  };
  recommendation:
    "insufficient-evidence" | "ready-for-pharmacist-review" | "keep-monitoring";
};

/**
 * The minimum number of community outcomes before a product in
 * insufficient_data state is flagged for pharmacist review.
 * This is intentionally conservative — community outcomes are
 * anecdotal, not clinical. They are a signal to review, not a
 * substitute for review.
 */
const MIN_OUTCOMES_FOR_REVIEW = 5;

/**
 * The minimum positive outcome ratio (love-it + helped) before
 * a product is flagged for pharmacist review.
 */
const MIN_POSITIVE_RATIO = 0.6;

/**
 * Identify products in `insufficient_data` care state that have
 * accumulated community outcome evidence.
 *
 * @param productSlugs - The set of catalogue product slugs to check.
 * @param communityOutcomes - A map from product slug to outcome counts.
 *   This would typically be built from the community_knowledge_edges
 *   and community_observations tables by an operator-facing query.
 */
export function identifyCareEvidenceSignals(
  productSlugs: readonly string[],
  communityOutcomes: Map<
    string,
    { loveIt: number; helped: number; unsure: number; didntHelp: number }
  >,
): ProductCareEvidenceSignal[] {
  const signals: ProductCareEvidenceSignal[] = [];

  for (const productSlug of productSlugs) {
    const careState = careStateForProduct(productSlug);
    if (careState !== "insufficient_data") continue;

    const outcomes = communityOutcomes.get(productSlug);
    const total = outcomes
      ? outcomes.loveIt + outcomes.helped + outcomes.unsure + outcomes.didntHelp
      : 0;
    const positive = outcomes ? outcomes.loveIt + outcomes.helped : 0;
    const positiveRatio = total > 0 ? positive / total : 0;

    let recommendation: ProductCareEvidenceSignal["recommendation"] =
      "insufficient-evidence";
    if (
      total >= MIN_OUTCOMES_FOR_REVIEW &&
      positiveRatio >= MIN_POSITIVE_RATIO
    ) {
      recommendation = "ready-for-pharmacist-review";
    } else if (total > 0) {
      recommendation = "keep-monitoring";
    }

    signals.push({
      productSlug,
      currentCareState: careState,
      hasCommunityOutcome: total > 0,
      outcomeSummary: {
        loveIt: outcomes?.loveIt ?? 0,
        helped: outcomes?.helped ?? 0,
        unsure: outcomes?.unsure ?? 0,
        didntHelp: outcomes?.didntHelp ?? 0,
        total,
      },
      recommendation,
    });
  }

  return signals;
}

/**
 * Get the care state for a product slug, defaulting to insufficient_data
 * if the product is not in the reviewed manifest.
 */
export function careStateForProduct(productSlug: string): ProductCareState {
  const review: ReviewedProductCare | undefined =
    getReviewedProductCare(productSlug);
  return review?.careState ?? "insufficient_data";
}

/**
 * Check whether a product is in a care state that allows
 * direct recommendation through the consult engine.
 */
export function isCareEligible(productSlug: string): boolean {
  const state = careStateForProduct(productSlug);
  return state === "supportive_eligible";
}

/**
 * Check whether a product is in a care state that requires
 * pharmacist review before any recommendation.
 */
export function requiresPharmacistReview(productSlug: string): boolean {
  const state = careStateForProduct(productSlug);
  return state === "pharmacist_review";
}

/**
 * Check whether a product has insufficient clinical data
 * and would benefit from community contribution evidence.
 */
export function hasInsufficientData(productSlug: string): boolean {
  const state = careStateForProduct(productSlug);
  return state === "insufficient_data";
}

/**
 * Read the governed pharmacy approval metadata for an exact product cohort.
 * The compatibility care state alone never implies an attestation.
 */
export function careStateAttestation(
  productSlug: string,
): PharmacyCareReviewAttestation | null {
  if (careStateForProduct(productSlug) !== "pharmacist_review") return null;
  return getPharmacyCareReviewAttestation(productSlug) ?? null;
}

/**
 * Get a human-readable label for a product's care state,
 * suitable for display in the contribute pathway.
 */
export function careStateLabel(productSlug: string): string | null {
  const state = careStateForProduct(productSlug);
  switch (state) {
    case "supportive_eligible":
      return null; // No label needed — this is the normal state
    case "pharmacist_review":
      return careStateAttestation(productSlug)
        ? "Pharmacist-reviewed context"
        : "Pharmacist guidance required";
    case "insufficient_data":
      return "Community evidence being collected";
    default:
      return null;
  }
}
