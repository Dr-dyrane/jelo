import "server-only";

import type { PostgresClient } from "@/lib/db/postgres";

export type CommunityOutcomeCounts = {
  loveIt: number;
  helped: number;
  unsure: number;
  didntHelp: number;
};

type CommunityOutcomeRow = {
  subject_ref: string;
  love_it: number;
  helped: number;
  unsure: number;
  didnt_help: number;
};

/**
 * Aggregate approved community outcome observations for the given product
 * slugs. Only `observation_kind = 'outcome'` rows on `subject_kind = 'product'`
 * with `moderation_status = 'approved'` are counted, so the result reflects
 * moderated evidence rather than raw community submissions.
 *
 * Returns a Map keyed by product slug. Slugs with no approved outcomes are
 * omitted from the Map; callers treat a missing entry as zero evidence.
 */
export async function getCommunityOutcomeCounts(
  sql: PostgresClient,
  productSlugs: readonly string[],
): Promise<Map<string, CommunityOutcomeCounts>> {
  const counts = new Map<string, CommunityOutcomeCounts>();

  if (productSlugs.length === 0) {
    return counts;
  }

  const rows = await sql<CommunityOutcomeRow[]>`
    select subject_ref,
      count(*) filter (where outcome = 'love-it')::int as love_it,
      count(*) filter (where outcome = 'helped')::int as helped,
      count(*) filter (where outcome = 'unsure')::int as unsure,
      count(*) filter (where outcome = 'didnt-help')::int as didnt_help
    from community_observations
    where observation_kind = 'outcome'
      and subject_kind = 'product'
      and moderation_status = 'approved'
      and subject_ref = any(${productSlugs}::text[])
    group by subject_ref
  `;

  for (const row of rows) {
    counts.set(row.subject_ref, {
      loveIt: row.love_it,
      helped: row.helped,
      unsure: row.unsure,
      didntHelp: row.didnt_help,
    });
  }

  return counts;
}
