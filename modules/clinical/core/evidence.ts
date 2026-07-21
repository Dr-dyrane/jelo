import type { EvidenceRecord } from './types';

export const evidenceRegistry: EvidenceRecord[] = [
  {
    id: 'pregnancy-topical-retinoids',
    title: 'Topical retinoids in pregnancy',
    source: 'Clinical safety guidance',
    sourceType: 'guideline',
    level: 'high',
    summary: 'Topical retinoids are treated as avoid-in-pregnancy ingredients in JeloCare safety rules.',
    reviewedAt: '2026-07-20',
    reviewStatus: 'reviewed',
  },
  {
    id: 'lactation-topical-application',
    title: 'Topical products during breastfeeding',
    source: 'Clinical lactation guidance',
    sourceType: 'clinical-review',
    level: 'moderate',
    summary: 'Avoid infant contact with treated skin and avoid application on or near the breast unless specifically directed.',
    reviewedAt: '2026-07-20',
    reviewStatus: 'reviewed',
  },
  {
    id: 'retinoid-acid-irritation',
    title: 'Combined retinoid and exfoliant irritation',
    source: 'Dermatology practice consensus',
    sourceType: 'consensus',
    level: 'moderate',
    summary: 'Concurrent use can increase irritation and barrier disruption; gradual introduction and alternating schedules reduce active load.',
    reviewedAt: '2026-07-20',
    reviewStatus: 'reviewed',
  },
  {
    id: 'tretinoin-bpo-timing',
    title: 'Tretinoin and benzoyl peroxide scheduling',
    source: 'Acne treatment guidance',
    sourceType: 'guideline',
    level: 'moderate',
    summary: 'Separate timing unless the prescribed formulation and regimen are specifically designed for combined use.',
    reviewedAt: '2026-07-20',
    reviewStatus: 'reviewed',
  },
  {
    id: 'active-load-barrier-risk',
    title: 'Cumulative irritation from multiple actives',
    source: 'Dermatology clinical review',
    sourceType: 'clinical-review',
    level: 'moderate',
    summary: 'Multiple irritation-prone actives increase the likelihood of burning, peeling and barrier impairment, especially in sensitive skin.',
    reviewedAt: '2026-07-20',
    reviewStatus: 'reviewed',
  },
  {
    id: 'photosensitive-routine-photoprotection',
    title: 'Photoprotection with irritation-prone routines',
    source: 'Photoprotection consensus',
    sourceType: 'consensus',
    level: 'high',
    summary: 'Consistent broad-spectrum sunscreen supports routines that may increase irritation or worsen post-inflammatory hyperpigmentation after sun exposure.',
    reviewedAt: '2026-07-20',
    reviewStatus: 'reviewed',
  },
];

const evidenceById = new Map(evidenceRegistry.map(record => [record.id, record]));

export function resolveEvidence(ids: string[] = []) {
  return ids.map(id => evidenceById.get(id)).filter((record): record is EvidenceRecord => Boolean(record));
}

export function evidenceForFindings(findings: { evidenceIds?: string[] }[]) {
  const ids = Array.from(new Set(findings.flatMap(finding => finding.evidenceIds ?? [])));
  return resolveEvidence(ids);
}