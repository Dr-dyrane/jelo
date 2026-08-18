import "server-only";

import { concerns } from "@/data/knowledge";
import { getReviewedProductCare } from "@/data/product-care-review";

export type ConcernSummary = {
  slug: string;
  name: string;
  area: string;
  summary: string;
  kind: "concern" | "condition-pattern";
};

function toSummary(c: (typeof concerns)[number]): ConcernSummary {
  return {
    slug: c.slug,
    name: c.name,
    area: c.area,
    summary: c.summary,
    kind: c.kind,
  };
}

/**
 * All 58 concerns as summaries, everyday concerns first then
 * condition patterns. Used as a fallback when a product has no
 * linked concerns so the /lagos rail always has content.
 */
export function allConcernSummaries(): ConcernSummary[] {
  const everyday = concerns.filter((c) => c.kind === "concern");
  const patterns = concerns.filter((c) => c.kind === "condition-pattern");
  return [...everyday, ...patterns].map(toSummary);
}

/**
 * Find all concerns linked to a product slug through the reviewed
 * product care manifest. A concern is linked when the product's
 * approved uses include that concern's slug.
 *
 * Everyday concerns (kind: "concern") are returned first, then
 * condition patterns, so callers can prioritise the more actionable
 * guides.
 */
export function concernsLinkedToProduct(productSlug: string): ConcernSummary[] {
  const review = getReviewedProductCare(productSlug);
  if (!review) return [];

  const linkedSlugs = new Set<string>();
  for (const use of review.approvedUses) {
    for (const slug of use.concernSlugs ?? []) {
      linkedSlugs.add(slug.toLowerCase());
    }
  }

  const linked = concerns.filter((c) => linkedSlugs.has(c.slug));
  const everyday = linked.filter((c) => c.kind === "concern");
  const patterns = linked.filter((c) => c.kind === "condition-pattern");

  return [...everyday, ...patterns].map(toSummary);
}
