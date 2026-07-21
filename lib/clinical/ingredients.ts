import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';

export type EvidenceGrade = 'high' | 'moderate' | 'emerging' | 'insufficient';
export type SafetyStatus = 'generally_safe' | 'use_with_caution' | 'avoid' | 'unknown';
export type IngredientRelationType = 'compatible' | 'complementary' | 'redundant' | 'irritation_risk' | 'avoid_together';

export type IngredientSummary = {
  id: string;
  slug: string;
  inciName: string;
  commonName: string | null;
  summary: string | null;
  evidenceGrade: EvidenceGrade;
  pregnancyStatus: SafetyStatus;
  nursingStatus: SafetyStatus;
  sensitiveSkinStatus: SafetyStatus;
  comedogenicRating: number | null;
  requiresSunProtection: boolean;
  pharmacistReviewed: boolean;
};

type IngredientRow = {
  id: string;
  slug: string;
  inci_name: string;
  common_name: string | null;
  summary: string | null;
  evidence_grade: EvidenceGrade;
  pregnancy_status: SafetyStatus;
  nursing_status: SafetyStatus;
  sensitive_skin_status: SafetyStatus;
  comedogenic_rating: number | null;
  requires_sun_protection: boolean;
  pharmacist_reviewed: boolean;
};

function mapIngredient(row: IngredientRow): IngredientSummary {
  return {
    id: row.id,
    slug: row.slug,
    inciName: row.inci_name,
    commonName: row.common_name,
    summary: row.summary,
    evidenceGrade: row.evidence_grade,
    pregnancyStatus: row.pregnancy_status,
    nursingStatus: row.nursing_status,
    sensitiveSkinStatus: row.sensitive_skin_status,
    comedogenicRating: row.comedogenic_rating,
    requiresSunProtection: row.requires_sun_protection,
    pharmacistReviewed: row.pharmacist_reviewed,
  };
}

export async function findIngredientBySlug(slug: string) {
  const sql = getPostgresClient();
  const [row] = await sql<IngredientRow[]>`
    select
      id,
      slug,
      inci_name,
      common_name,
      summary,
      evidence_grade,
      pregnancy_status,
      nursing_status,
      sensitive_skin_status,
      comedogenic_rating,
      requires_sun_protection,
      pharmacist_reviewed
    from ingredients
    where slug = ${slug}
    limit 1
  `;

  return row ? mapIngredient(row) : undefined;
}

export async function listIngredientsForProduct(productSlug: string) {
  const sql = getPostgresClient();
  const rows = await sql<(IngredientRow & {
    position: number | null;
    concentration_percent: string | null;
    is_active: boolean;
    verified_at: Date | null;
  })[]>`
    select
      i.id,
      i.slug,
      i.inci_name,
      i.common_name,
      i.summary,
      i.evidence_grade,
      i.pregnancy_status,
      i.nursing_status,
      i.sensitive_skin_status,
      i.comedogenic_rating,
      i.requires_sun_protection,
      i.pharmacist_reviewed,
      pi.position,
      pi.concentration_percent,
      pi.is_active,
      pi.verified_at
    from product_ingredients pi
    join ingredients i on i.id = pi.ingredient_id
    join products p on p.id = pi.product_id
    where p.slug = ${productSlug}
    order by pi.position asc nulls last, i.inci_name
  `;

  return rows.map(row => ({
    ...mapIngredient(row),
    position: row.position,
    concentrationPercent: row.concentration_percent === null ? null : Number(row.concentration_percent),
    isActive: row.is_active,
    verifiedAt: row.verified_at,
  }));
}

export async function listIngredientRelations(ingredientId: string) {
  const sql = getPostgresClient();
  return sql<{
    relatedIngredientId: string;
    relatedIngredientSlug: string;
    relatedIngredientName: string;
    relationType: IngredientRelationType;
    evidenceGrade: EvidenceGrade;
    rationale: string;
    pharmacistReviewed: boolean;
  }[]>`
    select
      related.id as "relatedIngredientId",
      related.slug as "relatedIngredientSlug",
      coalesce(related.common_name, related.inci_name) as "relatedIngredientName",
      relation.relation_type as "relationType",
      relation.evidence_grade as "evidenceGrade",
      relation.rationale,
      relation.pharmacist_reviewed as "pharmacistReviewed"
    from ingredient_relations relation
    join ingredients related on related.id = relation.related_ingredient_id
    where relation.ingredient_id = ${ingredientId}
    order by relation.relation_type, related.inci_name
  `;
}
