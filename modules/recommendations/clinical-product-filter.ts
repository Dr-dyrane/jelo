import type { Product } from '@/data/products';
import { detectIngredients } from '@/modules/clinical/core/ingredients';
import type { ClinicalAssessment, ClinicalTimelineRecord } from '@/modules/clinical/core/types';

export type ClinicalProductDecision = {
  slug: string;
  eligible: boolean;
  ingredientIds: string[];
  reasons: string[];
  exclusions: string[];
  clinicalScore: number;
};

const treatmentSteps = new Set(['treat', 'exfoliate']);

function productText(product: Product) {
  return [product.brand, product.name, product.step, product.displayLine, product.usage, ...product.bestFor, ...product.concerns].join(' ');
}

function priorRecommendationCount(slug: string, timeline: ClinicalTimelineRecord[]) {
  return timeline.filter(record => record.recommendedProductSlugs.includes(slug)).length;
}

export function evaluateProductClinically(
  product: Product,
  clinical: ClinicalAssessment,
  timeline: ClinicalTimelineRecord[] = [],
): ClinicalProductDecision {
  const ingredients = detectIngredients(productText(product));
  const ingredientIds = ingredients.map(item => item.id);
  const blocked = ingredientIds.filter(id => clinical.blockedIngredientIds.includes(id));
  const exclusions: string[] = [];
  const reasons: string[] = [];
  let clinicalScore = 0;

  if (blocked.length) exclusions.push(`Contains blocked ingredient${blocked.length === 1 ? '' : 's'}: ${blocked.join(', ')}`);

  const step = product.step.toLowerCase();
  const recoveryMode = clinical.barrier.state === 'stressed' || clinical.barrier.state === 'compromised';
  if (recoveryMode && treatmentSteps.has(step)) exclusions.push('Treatment actives are paused while barrier recovery is prioritized.');
  if (recoveryMode && !product.sensitiveFriendly) exclusions.push('Not marked suitable for a stressed or sensitive barrier.');

  if (clinical.profile?.sensitiveSkin && !product.sensitiveFriendly) {
    exclusions.push('Not marked sensitive-skin friendly.');
  }

  if (clinical.activeLoad.total >= 3 && treatmentSteps.has(step)) {
    exclusions.push('Would add another treatment step to an already high active load.');
  }

  if (product.sensitiveFriendly) {
    reasons.push('Sensitive-skin friendly');
    clinicalScore += 8;
  }
  if (step === 'moisturize' && clinical.barrier.state !== 'stable') {
    reasons.push('Supports barrier recovery');
    clinicalScore += 20;
  }
  if (step === 'protect') {
    reasons.push('Supports daily photoprotection');
    clinicalScore += 12;
  }
  if (product.evidence === 'high') clinicalScore += 12;
  else if (product.evidence === 'moderate') clinicalScore += 7;

  const priorCount = priorRecommendationCount(product.slug, timeline);
  if (priorCount > 0) {
    reasons.push(`Previously recommended ${priorCount} time${priorCount === 1 ? '' : 's'}`);
    clinicalScore += Math.min(priorCount * 2, 6);
  }

  return {
    slug: product.slug,
    eligible: exclusions.length === 0,
    ingredientIds,
    reasons,
    exclusions,
    clinicalScore,
  };
}

export function clinicallyFilterProducts(
  products: Product[],
  clinical: ClinicalAssessment,
  timeline: ClinicalTimelineRecord[] = [],
) {
  return products
    .map(product => ({ product, decision: evaluateProductClinically(product, clinical, timeline) }))
    .filter(item => item.decision.eligible);
}
