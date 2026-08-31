import type { Product } from "@/data/products";
import {
  getReviewedProductCare,
  matchingApprovedProductUses,
  type ProductCareState,
} from "@/data/product-care-review";
import {
  getPharmacyCareReviewAttestation,
  type PharmacyCareReviewAttestation,
} from "@/data/product-care-review-attestation";
import { ingredientById } from "@/modules/clinical/core/ingredients";
import type {
  ClinicalAssessment,
  ClinicalTimelineRecord,
} from "@/modules/clinical/core/types";
import { approvedUseMatchesProductArea } from "./product-concern-authority";

type RecommendationTimelineRecord = Pick<
  ClinicalTimelineRecord,
  "recommendedProductSlugs"
>;

export type ClinicalProductDecision = {
  slug: string;
  eligible: boolean;
  careState: ProductCareState | "unreviewed";
  approvedUseIds: string[];
  ingredientIds: string[];
  reasons: string[];
  exclusions: string[];
  clinicalScore: number;
  pharmacyAttestation: PharmacyCareReviewAttestation | null;
};

function priorRecommendationCount(
  slug: string,
  timeline: RecommendationTimelineRecord[],
) {
  return timeline.filter((record) =>
    record.recommendedProductSlugs.includes(slug),
  ).length;
}

export function evaluateProductClinically(
  product: Product,
  clinical: ClinicalAssessment,
  timeline: RecommendationTimelineRecord[] = [],
  match: {
    concernSlugs?: readonly string[];
    productSteps?: readonly string[];
  } = {},
): ClinicalProductDecision {
  const review = getReviewedProductCare(product.slug);
  const careState = review?.careState ?? "unreviewed";
  const pharmacyAttestation =
    careState === "pharmacist_review"
      ? (getPharmacyCareReviewAttestation(product.slug) ?? null)
      : null;
  const ingredientIds = Array.from(
    new Set(product.verifiedIngredientIds ?? []),
  );
  const unknownIngredientIds = ingredientIds.filter(
    (id) => !ingredientById.has(id),
  );
  const blocked = ingredientIds.filter((id) => {
    if (clinical.blockedIngredientIds.includes(id)) return true;
    const ingredient = ingredientById.get(id);
    if (!ingredient) return false;
    return (
      Boolean(clinical.profile?.pregnant && ingredient.pregnancy === "avoid") ||
      Boolean(
        clinical.profile?.breastfeeding && ingredient.breastfeeding === "avoid",
      )
    );
  });
  const approvedUses =
    review?.careState === "supportive_eligible"
      ? matchingApprovedProductUses(review, {
          concernSlugs: match.concernSlugs ?? [],
        }).filter((use) =>
          approvedUseMatchesProductArea(
            product,
            use,
            match.concernSlugs ?? [],
            match.productSteps,
          ),
        )
      : [];
  const exclusions: string[] = [];
  const reasons = approvedUses.map((use) => use.label);
  let clinicalScore = 0;

  if (!review)
    exclusions.push("No reviewed product-care decision is available.");
  else if (review.careState === "pharmacist_review") {
    exclusions.push(
      pharmacyAttestation
        ? "Pharmacist-reviewed context only; this is not a direct supportive recommendation. Ask a pharmacist for guidance about a specific concern."
        : "Pharmacist guidance is required before product guidance.",
    );
  } else if (review.careState === "insufficient_data")
    exclusions.push(
      "Formula and label evidence are insufficient for product guidance.",
    );
  else if (approvedUses.length === 0)
    exclusions.push(
      "The reported need is outside this product’s approved supportive use.",
    );

  if (unknownIngredientIds.length)
    exclusions.push(
      `Ingredient evidence is not recognized: ${unknownIngredientIds.join(", ")}`,
    );
  if (blocked.length)
    exclusions.push(
      `Contains blocked ingredient${blocked.length === 1 ? "" : "s"}: ${blocked.join(", ")}`,
    );

  clinicalScore += approvedUses.length * 20;

  const priorCount = priorRecommendationCount(product.slug, timeline);
  if (priorCount > 0 && exclusions.length === 0) {
    reasons.push(
      `Previously recommended ${priorCount} time${priorCount === 1 ? "" : "s"}`,
    );
    clinicalScore += Math.min(priorCount * 2, 6);
  }

  return {
    slug: product.slug,
    eligible: exclusions.length === 0,
    careState,
    approvedUseIds: approvedUses.map((use) => use.id),
    ingredientIds,
    reasons,
    exclusions,
    clinicalScore,
    pharmacyAttestation,
  };
}

export function clinicallyFilterProducts(
  products: Product[],
  clinical: ClinicalAssessment,
  timeline: RecommendationTimelineRecord[] = [],
  match: {
    concernSlugs?: readonly string[];
    productSteps?: readonly string[];
  } = {},
) {
  return products
    .map((product) => ({
      product,
      decision: evaluateProductClinically(product, clinical, timeline, match),
    }))
    .filter((item) => item.decision.eligible);
}
