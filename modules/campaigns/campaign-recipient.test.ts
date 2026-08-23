import assert from "node:assert/strict";
import test from "node:test";
import {
  configuredProductionCampaignEmails,
  resolveCampaignRecipients,
} from "@/lib/campaigns/campaign-recipient";

const secret = "campaign-recipient-test-secret";

test("production campaign recipients require exactly three unique normalized emails", () => {
  assert.deepEqual(
    configuredProductionCampaignEmails({
      CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON: JSON.stringify([
        " Zed@example.com ",
        "amy@example.com",
        "Moe@example.com",
      ]),
    }),
    ["amy@example.com", "moe@example.com", "zed@example.com"],
  );

  for (const value of [
    undefined,
    "not-json",
    JSON.stringify(["one@example.com"]),
    JSON.stringify([
      "same@example.com",
      " SAME@example.com ",
      "third@example.com",
    ]),
    JSON.stringify(["one@example.com", "not-an-email", "three@example.com"]),
  ]) {
    assert.throws(
      () =>
        configuredProductionCampaignEmails({
          CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON: value,
        }),
      /campaign_operator_recipients_(?:not_configured|invalid)/,
    );
  }
});

test("test delivery resolves one private recipient without querying operators", async () => {
  let queryCalls = 0;
  const recipients = await resolveCampaignRecipients(
    "test",
    {
      CAMPAIGN_TEST_EMAIL: " Owner@Example.com ",
      CRON_SECRET: secret,
    },
    {
      listActiveOperators: async () => {
        queryCalls += 1;
        return [];
      },
    },
  );

  assert.equal(queryCalls, 0);
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0]?.kind, "test");
  assert.equal(recipients[0]?.email, "owner@example.com");
  assert.match(recipients[0]?.record.recipientKey ?? "", /^[0-9a-f]{64}$/);
});

test("production resolves the exact active operator set in deterministic order", async () => {
  const requested: string[][] = [];
  const recipients = await resolveCampaignRecipients(
    "production",
    {
      CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON: JSON.stringify([
        "zed@example.com",
        "amy@example.com",
        "moe@example.com",
      ]),
      CRON_SECRET: secret,
    },
    {
      listActiveOperators: async (emails) => {
        requested.push([...emails]);
        return [
          { email: "moe@example.com", displayName: "Moe" },
          { email: "zed@example.com", displayName: "Zed" },
          { email: "amy@example.com", displayName: "Amy" },
        ];
      },
    },
  );

  assert.deepEqual(requested, [
    ["amy@example.com", "moe@example.com", "zed@example.com"],
  ]);
  assert.deepEqual(
    recipients.map((recipient) => ({
      kind: recipient.kind,
      email: recipient.email,
      displayName: recipient.displayName,
    })),
    [
      { kind: "operator", email: "amy@example.com", displayName: "Amy" },
      { kind: "operator", email: "moe@example.com", displayName: "Moe" },
      { kind: "operator", email: "zed@example.com", displayName: "Zed" },
    ],
  );
  assert.equal(
    new Set(recipients.map((recipient) => recipient.record.recipientKey)).size,
    3,
  );
});

test("production fails closed when any configured operator is not active", async () => {
  await assert.rejects(
    resolveCampaignRecipients(
      "production",
      {
        CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON: JSON.stringify([
          "one@example.com",
          "two@example.com",
          "three@example.com",
        ]),
        CRON_SECRET: secret,
      },
      {
        listActiveOperators: async () => [
          { email: "one@example.com", displayName: null },
          { email: "two@example.com", displayName: null },
        ],
      },
    ),
    /campaign_operator_recipient_set_mismatch/,
  );
});
