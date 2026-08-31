import { createHash } from "node:crypto";
import { products as publicProducts } from "@/data/catalogue";
import {
  getPharmacyCareReviewAttestation,
  type PharmacyCareReviewAttestation,
} from "@/data/product-care-review-attestation";
import {
  getReviewedProductCare,
  type ProductCareState,
  type ReviewedProductCare,
} from "@/data/product-care-review";
import type { Product } from "@/data/products";

export const CLINICAL_REVIEW_PLAN_SCHEMA_VERSION =
  "clinical-review-plan/2026-08-31/v1";

export type ClinicalReviewReason =
  | "insufficient_evidence"
  | "invalid_review_date"
  | "legacy_attestation_requires_credential_binding"
  | "missing_care_cell"
  | "missing_source"
  | "missing_verified_ingredients"
  | "supportive_review_requires_credential_binding"
  | "unattested_pharmacist_context";

export type ClinicalReviewQueueItem = {
  idempotencyKey: string;
  productSlug: string;
  careState: ProductCareState | "unreviewed";
  reviewedAt: string | null;
  evidenceSourceCount: number;
  verifiedIngredientCount: number;
  attestationVersion: string | null;
  productEvidenceDigest: string;
  reasons: ClinicalReviewReason[];
};

export type ClinicalReviewPlan = {
  schemaVersion: typeof CLINICAL_REVIEW_PLAN_SCHEMA_VERSION;
  status: "current" | "attention_required";
  generatedAt: string;
  manifestDigest: string;
  writesPerformed: 0;
  counts: {
    products: number;
    current: number;
    queued: number;
    careStates: {
      supportiveEligible: number;
      pharmacistReview: number;
      insufficientData: number;
      unreviewed: number;
    };
    reasons: Record<ClinicalReviewReason, number>;
  };
  queue: ClinicalReviewQueueItem[];
};

const reasonOrder: readonly ClinicalReviewReason[] = [
  "missing_care_cell",
  "invalid_review_date",
  "unattested_pharmacist_context",
  "legacy_attestation_requires_credential_binding",
  "supportive_review_requires_credential_binding",
  "missing_source",
  "missing_verified_ingredients",
  "insufficient_evidence",
];

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sorted(values: readonly string[] | undefined) {
  return [...(values ?? [])].sort((left, right) => left.localeCompare(right));
}

export function isValidClinicalReviewDate(
  value: string | undefined,
  generatedAt: Date,
) {
  if (!value) return false;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const timestampMatch = value.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/,
  );
  if (!dateOnly && !timestampMatch) return false;
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.valueOf() > generatedAt.valueOf()
  )
    return false;
  if (dateOnly) return parsed.toISOString().slice(0, 10) === value;
  const normalizedInput = `${timestampMatch?.[1]}.${(timestampMatch?.[2] ?? "").padEnd(3, "0")}Z`;
  return parsed.toISOString() === normalizedInput;
}

function careDigestInput(
  product: Product,
  review: ReviewedProductCare | undefined,
  attestation: PharmacyCareReviewAttestation | undefined,
) {
  return {
    product: {
      slug: product.slug,
      catalogueIdentity: product.catalogueIdentity ?? null,
      brand: product.brand,
      name: product.name,
      size: product.size,
      category: product.category,
      step: product.step,
      displayLine: product.displayLine,
      bestFor: sorted(product.bestFor),
      concerns: sorted(product.concerns),
      skinTypes: sorted(product.skinTypes),
      sensitiveFriendly: product.sensitiveFriendly,
      usage: product.usage,
      evidence: product.evidence,
      verifiedIngredientIds: sorted(product.verifiedIngredientIds),
    },
    review: review
      ? {
          productSlug: review.productSlug,
          careState: review.careState,
          reviewedAt: review.reviewedAt,
          evidenceSourceUrls: sorted(review.evidenceSourceUrls),
          approvedUses: [...review.approvedUses]
            .map((use) => ({
              id: use.id,
              label: use.label,
              concernIds: sorted(use.concernIds),
              concernSlugs: sorted(use.concernSlugs),
              skinTypes: sorted(use.skinTypes),
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        }
      : null,
    attestation: attestation
      ? {
          version: attestation.version,
          reviewerLabel: attestation.reviewerLabel,
          approvedAt: attestation.approvedAt,
          disposition: attestation.disposition,
        }
      : null,
  };
}

function emptyReasonCounts(): Record<ClinicalReviewReason, number> {
  return {
    insufficient_evidence: 0,
    invalid_review_date: 0,
    legacy_attestation_requires_credential_binding: 0,
    missing_care_cell: 0,
    missing_source: 0,
    missing_verified_ingredients: 0,
    supportive_review_requires_credential_binding: 0,
    unattested_pharmacist_context: 0,
  };
}

export function buildClinicalReviewPlan(
  generatedAt: Date = new Date(),
  products: readonly Product[] = publicProducts,
): ClinicalReviewPlan {
  const seen = new Set<string>();
  const reasonCounts = emptyReasonCounts();
  const careStates = {
    supportiveEligible: 0,
    pharmacistReview: 0,
    insufficientData: 0,
    unreviewed: 0,
  };
  const queue: ClinicalReviewQueueItem[] = [];
  const manifestCells: Array<{ slug: string; digest: string }> = [];

  for (const product of [...products].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  )) {
    if (seen.has(product.slug)) {
      throw new Error(`Duplicate public product slug: ${product.slug}`);
    }
    seen.add(product.slug);

    const review = getReviewedProductCare(product.slug);
    const attestation = getPharmacyCareReviewAttestation(product.slug);
    const reasons: ClinicalReviewReason[] = [];

    if (!review) {
      careStates.unreviewed += 1;
      reasons.push("missing_care_cell");
    } else {
      if (review.careState === "supportive_eligible")
        careStates.supportiveEligible += 1;
      if (review.careState === "pharmacist_review")
        careStates.pharmacistReview += 1;
      if (review.careState === "insufficient_data")
        careStates.insufficientData += 1;

      if (!isValidClinicalReviewDate(review.reviewedAt, generatedAt))
        reasons.push("invalid_review_date");
      if (review.evidenceSourceUrls.length === 0)
        reasons.push("missing_source");
      if (review.careState === "insufficient_data") {
        if ((product.verifiedIngredientIds?.length ?? 0) === 0)
          reasons.push("missing_verified_ingredients");
        reasons.push("insufficient_evidence");
      }
      if (review.careState === "pharmacist_review") {
        if (!attestation) reasons.push("unattested_pharmacist_context");
        else reasons.push("legacy_attestation_requires_credential_binding");
      }
      if (review.careState === "supportive_eligible")
        reasons.push("supportive_review_requires_credential_binding");
    }

    reasons.sort(
      (left, right) => reasonOrder.indexOf(left) - reasonOrder.indexOf(right),
    );
    const productEvidenceDigest = digest(
      careDigestInput(product, review, attestation),
    );
    manifestCells.push({ slug: product.slug, digest: productEvidenceDigest });

    if (reasons.length === 0) continue;
    for (const reason of reasons) reasonCounts[reason] += 1;
    queue.push({
      idempotencyKey: digest({
        schemaVersion: CLINICAL_REVIEW_PLAN_SCHEMA_VERSION,
        productSlug: product.slug,
        productEvidenceDigest,
        reasons,
      }),
      productSlug: product.slug,
      careState: review?.careState ?? "unreviewed",
      reviewedAt: review?.reviewedAt ?? null,
      evidenceSourceCount: review?.evidenceSourceUrls.length ?? 0,
      verifiedIngredientCount: product.verifiedIngredientIds?.length ?? 0,
      attestationVersion: attestation?.version ?? null,
      productEvidenceDigest,
      reasons,
    });
  }

  return {
    schemaVersion: CLINICAL_REVIEW_PLAN_SCHEMA_VERSION,
    status: queue.length === 0 ? "current" : "attention_required",
    generatedAt: generatedAt.toISOString(),
    manifestDigest: digest({
      schemaVersion: CLINICAL_REVIEW_PLAN_SCHEMA_VERSION,
      cells: manifestCells,
    }),
    writesPerformed: 0,
    counts: {
      products: products.length,
      current: products.length - queue.length,
      queued: queue.length,
      careStates,
      reasons: reasonCounts,
    },
    queue,
  };
}
