import "server-only";
import { getAuthSubjectResult } from "@/lib/auth/subject";
import { campaignRecipientKey } from "@/lib/campaigns/campaign-archive";
import { xReviewConfig } from "./report";

export type CampaignActor = { subject: string; recipientKey: string };
export type CampaignAccess =
  | { status: "ready"; actor: CampaignActor }
  | { status: "disabled" | "signed-out" | "forbidden" | "unavailable" };

// Never use the Ops invitation/role resolver or a customer fixture identity here.
export async function campaignReviewAccess(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
  readIdentity = getAuthSubjectResult,
): Promise<CampaignAccess> {
  try {
    const config = xReviewConfig(env, now);
    if (!config) return { status: "disabled" };
    const session = await readIdentity();
    if (session.status !== "authenticated") return { status: session.status };
    const { identity } = session;
    if (
      !identity.subject ||
      !identity.emailVerified ||
      identity.email?.trim().toLowerCase() !== config.recipient
    )
      return { status: "forbidden" };
    return {
      status: "ready",
      actor: {
        subject: identity.subject,
        recipientKey: campaignRecipientKey(config.recipient, env),
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
