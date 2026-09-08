"use server";

import { changeCampaignReview } from "@/lib/campaigns/x-review/review-service";
import type { EditorialTransitionInput } from "@/lib/campaigns/x-review/editorial";

export async function saveCampaignDecision(
  reportId: string,
  input: EditorialTransitionInput,
) {
  // The service authenticates and reloads trusted context for every invocation.
  // No email, AI request or X operation is reachable from this action.
  return changeCampaignReview(reportId, input);
}
