export type ConsultOutcome = "love-it" | "helped" | "unsure" | "didnt-help";

export type ConsultTimelineRecord = {
  id: string;
  schemaVersion: 2;
  createdAt: string;
  assessmentType: "consultation";
  concernSlugs: string[];
  market: "NG" | "US";
  recommendedProductSlugs: string[];
  followUpAt: string;
  outcome?: ConsultOutcome;
  outcomeNote?: string;
  outcomeRecordedAt?: string;
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
  market: "NG" | "US";
  recommendedProductSlugs: string[];
  createdAt?: string;
}): ConsultTimelineRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const identity = [input.concernSlugs.join("|"), createdAt].join(":");

  return {
    id: `assessment_${stableId(identity)}`,
    schemaVersion: 2,
    createdAt,
    assessmentType: "consultation",
    concernSlugs: [...new Set(input.concernSlugs)],
    market: input.market,
    recommendedProductSlugs: [...new Set(input.recommendedProductSlugs)],
    followUpAt: plusDays(createdAt, 28),
  };
}

/**
 * Record an outcome on an existing timeline record, closing the
 * Data → Wisdom → Action → Outcome → Knowledge feedback loop.
 *
 * The outcome aligns with the community intake outcome enum so that
 * consult outcomes and community contributions share the same vocabulary.
 */
export function recordConsultOutcome(
  record: ConsultTimelineRecord,
  outcome: ConsultOutcome,
  note?: string,
): ConsultTimelineRecord {
  return {
    ...record,
    outcome,
    outcomeNote: note?.trim().slice(0, 280) || undefined,
    outcomeRecordedAt: new Date().toISOString(),
  };
}

/**
 * Check whether a timeline record is due for outcome follow-up.
 * A record is due if it has no outcome and the follow-up date has passed.
 */
export function isOutcomeFollowUpDue(
  record: ConsultTimelineRecord,
  now: Date = new Date(),
): boolean {
  if (record.outcome) return false;
  return new Date(record.followUpAt) <= now;
}

/**
 * Summarize outcomes across a timeline for the same concern set.
 * Returns the distribution of outcomes so the consult engine can
 * acknowledge prior results in future recommendations.
 */
export function summarizeTimelineOutcomes(records: ConsultTimelineRecord[]): {
  total: number;
  withOutcome: number;
  loveIt: number;
  helped: number;
  unsure: number;
  didntHelp: number;
} {
  const withOutcome = records.filter((r) => r.outcome);
  return {
    total: records.length,
    withOutcome: withOutcome.length,
    loveIt: withOutcome.filter((r) => r.outcome === "love-it").length,
    helped: withOutcome.filter((r) => r.outcome === "helped").length,
    unsure: withOutcome.filter((r) => r.outcome === "unsure").length,
    didntHelp: withOutcome.filter((r) => r.outcome === "didnt-help").length,
  };
}
