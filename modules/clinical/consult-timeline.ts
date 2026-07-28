export type ConsultTimelineRecord = {
  id: string;
  schemaVersion: 2;
  createdAt: string;
  assessmentType: 'consultation';
  concernSlugs: string[];
  market: 'NG' | 'US';
  recommendedProductSlugs: string[];
  followUpAt: string;
};

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

export function createConsultTimelineRecord(input: {
  concernSlugs: string[];
  market: 'NG' | 'US';
  recommendedProductSlugs: string[];
  createdAt?: string;
}): ConsultTimelineRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const identity = [
    input.concernSlugs.join('|'),
    createdAt,
  ].join(':');

  return {
    id: `assessment_${stableId(identity)}`,
    schemaVersion: 2,
    createdAt,
    assessmentType: 'consultation',
    concernSlugs: [...new Set(input.concernSlugs)],
    market: input.market,
    recommendedProductSlugs: [...new Set(input.recommendedProductSlugs)],
    followUpAt: plusDays(createdAt, 28),
  };
}
