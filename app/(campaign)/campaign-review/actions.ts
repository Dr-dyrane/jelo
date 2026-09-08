"use server";

import { startCampaignPreview } from "@/lib/campaigns/x-review/preview-service";

export async function runCampaignPreview(confirmed: unknown) {
  return startCampaignPreview(confirmed);
}
