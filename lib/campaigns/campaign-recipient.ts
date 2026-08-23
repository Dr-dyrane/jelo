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

type ActiveCampaignOperator = {
  email: string;
  displayName: string | null;
};

type CampaignRecipientDependencies = {
  listActiveOperators: (
    normalizedEmails: readonly string[],
  ) => Promise<readonly ActiveCampaignOperator[]>;
};

function normalizedEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }
  return email;
}

export function configuredProductionCampaignEmails(
  env: Record<string, string | undefined> = process.env,
) {
  const source = env.CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON;
  if (!source) throw new Error("campaign_operator_recipients_not_configured");

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("campaign_operator_recipients_invalid");
  }
  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new Error("campaign_operator_recipients_invalid");
  }

  const emails = parsed.map(normalizedEmail);
  if (emails.some((email) => email === null)) {
    throw new Error("campaign_operator_recipients_invalid");
  }
  const normalized = emails as string[];
  if (new Set(normalized).size !== 3) {
    throw new Error("campaign_operator_recipients_invalid");
  }
  return normalized.sort();
}

const defaultDependencies: CampaignRecipientDependencies = {
  async listActiveOperators(normalizedEmails) {
    const sql = getPostgresClient();
    const rows = await sql<
      Array<{ email: string; display_name: string | null }>
    >`
      select email, display_name
      from moderation_operators
      where active = true
        and email in ${sql([...normalizedEmails])}
      order by email
      limit 4
    `;
    return rows.map((operator) => ({
      email: operator.email,
      displayName: operator.display_name,
    }));
  },
};

export function campaignDailyEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.CAMPAIGN_DAILY_ENABLED === "true";
}

export async function resolveCampaignRecipients(
  mode: "test" | "production",
  env: Record<string, string | undefined> = process.env,
  dependencies: CampaignRecipientDependencies = defaultDependencies,
): Promise<readonly CampaignRecipient[]> {
  if (mode === "test") {
    const email = normalizedEmail(env.CAMPAIGN_TEST_EMAIL);
    if (!email) throw new Error("campaign_test_recipient_not_configured");
    return [
      {
        kind: "test",
        email,
        displayName: null,
        record: {
          kind: "test",
          recipientKey: campaignRecipientKey(email, env),
        },
      },
    ];
  }

  const configuredEmails = configuredProductionCampaignEmails(env);
  const rows = await dependencies.listActiveOperators(configuredEmails);
  const operatorByEmail = new Map<string, ActiveCampaignOperator>();
  for (const operator of rows) {
    const email = normalizedEmail(operator.email);
    if (!email || operatorByEmail.has(email)) {
      throw new Error("campaign_operator_recipient_set_mismatch");
    }
    operatorByEmail.set(email, { ...operator, email });
  }
  if (
    operatorByEmail.size !== configuredEmails.length ||
    configuredEmails.some((email) => !operatorByEmail.has(email))
  ) {
    throw new Error("campaign_operator_recipient_set_mismatch");
  }

  return configuredEmails.map((email) => {
    const operator = operatorByEmail.get(email)!;
    return {
      kind: "operator" as const,
      email,
      displayName: operator.displayName,
      record: {
        kind: "operator" as const,
        recipientKey: campaignRecipientKey(email, env),
      },
    };
  });
}
