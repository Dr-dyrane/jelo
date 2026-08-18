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

  return [...everyday, ...patterns].map((c) => ({
    slug: c.slug,
    name: c.name,
    area: c.area,
    summary: c.summary,
    kind: c.kind,
  }));
}
