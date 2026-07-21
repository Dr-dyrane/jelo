import type { ClinicalAssessment, ClinicalTimelineRecord } from './types';

function plusDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function stableId(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

export function createTimelineRecord(input: {
  query: string;
  concerns: string[];
  market: 'NG' | 'US';
  clinical: ClinicalAssessment;
  recommendedProductSlugs: string[];
  createdAt?: string;
}): ClinicalTimelineRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const followUpDays = input.clinical.barrier.state === 'compromised' ? 7 : input.clinical.barrier.state === 'stressed' ? 14 : 28;
  const identity = [input.query.trim().toLowerCase(), createdAt, input.clinical.findings.map(item => item.ruleId).join('|')].join(':');

  return {
    id: `assessment_${stableId(identity)}`,
    schemaVersion: 1,
    createdAt,
    assessmentType: 'consultation',
    concernSummary: input.query.trim().slice(0, 240),
    concerns: input.concerns,
    market: input.market,
    barrier: input.clinical.barrier,
    activeLoad: input.clinical.activeLoad,
    findingRuleIds: input.clinical.findings.map(item => item.ruleId),
    blockedIngredientIds: input.clinical.blockedIngredientIds,
    detectedIngredientIds: input.clinical.detectedIngredients.map(item => item.id),
    routineSummary: input.clinical.routinePlan?.summary,
    recommendedProductSlugs: input.recommendedProductSlugs,
    followUpAt: plusDays(createdAt, followUpDays),
  };
}