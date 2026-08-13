import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { campaignRecipientKey } from "@/lib/campaigns/campaign-archive";

export type CampaignRecipient = {
  kind: "test" | "operator";
  email: string;
  displayName: string | null;
  record: {
    kind: "test" | "operator";
    recipientKey: string;
  };
};

function normalizedEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }
  return email;
}

export function campaignDailyEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.CAMPAIGN_DAILY_ENABLED === "true";
}

export async function resolveCampaignRecipient(
  mode: "test" | "production",
  env: Record<string, string | undefined> = process.env,
): Promise<CampaignRecipient> {
  if (mode === "test") {
    const email = normalizedEmail(env.CAMPAIGN_TEST_EMAIL);
    if (!email) throw new Error("campaign_test_recipient_not_configured");
    return {
      kind: "test",
      email,
      displayName: null,
      record: {
        kind: "test",
        recipientKey: campaignRecipientKey(email, env),
      },
    };
  }

  const configuredEmail = normalizedEmail(env.CAMPAIGN_DAILY_OPERATOR_EMAIL);
  if (!configuredEmail) {
    throw new Error("campaign_operator_recipient_not_configured");
  }
  const sql = getPostgresClient();
  const rows = await sql<
    Array<{ id: string; email: string; display_name: string | null }>
  >`
    select id::text, email, display_name
    from moderation_operators
    where active = true
      and email = ${configuredEmail}
    limit 2
  `;
  if (rows.length !== 1) {
    throw new Error(
      rows.length === 0
        ? "campaign_operator_recipient_not_active"
        : "campaign_operator_recipient_ambiguous",
    );
  }
  const operator = rows[0];
  if (operator.email !== configuredEmail) {
    throw new Error("campaign_operator_recipient_identity_mismatch");
  }
  return {
    kind: "operator",
    email: operator.email,
    displayName: operator.display_name,
    record: {
      kind: "operator",
      recipientKey: campaignRecipientKey(operator.email, env),
    },
  };
}
