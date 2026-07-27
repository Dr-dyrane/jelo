import { concernBySlug } from '@/data/knowledge';
import type { Product } from '@/data/products';
import {
  type OrdinaryCareIntent,
} from '@/modules/clinical/core/care-intent';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import type { RoutineStep } from '@/modules/clinical/core/types';
import type { ClinicalProductDecision } from '@/modules/recommendations/clinical-product-filter';

export type ConsultReport = {
  title: string;
  summary: string;
  pattern: string;
  routine: Array<{
    time: 'Morning' | 'Evening' | 'Weekly' | 'Any time';
    action: string;
  }>;
  cautions: string[];
  productSlugs: string[];
  followUp: string;
};

export function buildConsultProductCandidate(
  product: Product,
  decision: ClinicalProductDecision,
) {
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    approvedUseIds: decision.approvedUseIds,
    clinicalReasons: decision.reasons,
    ingredientIds: decision.ingredientIds,
  };
}

function publicRoutineStep(step: RoutineStep) {
  const time: 'Morning' | 'Evening' | 'Weekly' = step.time === 'morning'
    ? 'Morning'
    : step.time === 'evening'
      ? 'Evening'
      : 'Weekly';

  return {
    time,
    action: step.action,
    rationale: step.rationale,
    frequency: step.frequency,
  };
}

export function compactRoutine(
  clinical: ReturnType<typeof assessClinicalRoutine>,
) {
  const plan = clinical.routinePlan;
  if (!plan) return [];

  return [...plan.morning, ...plan.evening, ...plan.weekly]
    .slice(0, 10)
    .map(publicRoutineStep);
}

export function buildDeterministicConsultReport(
  clinical: ReturnType<typeof assessClinicalRoutine>,
  selectedSlugs: string[],
  _modelDraft?: unknown,
): ConsultReport {
  void _modelDraft;
  const routine = compactRoutine(clinical)
    .slice(0, 8)
    .map(step => ({ time: step.time, action: step.action }));
  const cautions = [
    ...clinical.findings.map(finding => `${finding.title}: ${finding.explanation}`),
    `${clinical.referral.level}: ${clinical.referral.action}`,
  ].slice(0, 6);
  const pattern = clinical.differential.primary
    ? `${clinical.differential.primary.label} is the leading working pattern. This is not a diagnosis.`
    : 'The description is not yet specific enough for a working pattern.';

  return {
    title: clinical.referral.level === 'self-care'
      ? 'A careful starting point.'
      : 'Check before you continue.',
    summary: clinical.referral.level === 'self-care'
      ? clinical.routinePlan?.summary
        ?? 'Keep the routine simple and introduce one change at a time.'
      : clinical.referral.action,
    pattern,
    routine: clinical.referral.level === 'self-care' ? routine : [],
    cautions,
    productSlugs: selectedSlugs,
    followUp: clinical.referral.action,
  };
}

export function buildDeterministicCareIntentReport(
  careIntent: OrdinaryCareIntent,
  selectedSlugs: string[],
): ConsultReport {
  const canonicalConcerns = careIntent.concernSlugs
    .map(concernBySlug)
    .filter((concern): concern is NonNullable<typeof concern> => Boolean(concern));
  const requestedCare = careIntent.labels.map(label => label.toLowerCase()).join(' and ');

  return {
    title: 'A simple place to start.',
    summary: selectedSlugs.length
      ? `These options were checked for ${requestedCare}.`
      : `JeloCare does not have a suitable direct match for ${requestedCare} yet.`,
    pattern: `You asked about ${requestedCare}. JeloCare treated this as everyday care, not a diagnosis.`,
    routine: careIntent.routine,
    cautions: canonicalConcerns.map(concern => concern.escalation).slice(0, 3),
    productSlugs: selectedSlugs,
    followUp: canonicalConcerns[0]?.escalation
      ?? 'Get in-person care if the concern becomes painful, spreads quickly or does not improve.',
  };
}
