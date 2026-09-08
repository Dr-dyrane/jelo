import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignReviewPath,
  resolveSignInContinuation,
  resolveSignInIntent,
} from "@/lib/auth/sign-in-intent";
import { campaignReviewAccess } from "@/lib/campaigns/x-review/access";
import { campaignRecipientKey } from "@/lib/campaigns/campaign-archive";
import {
  readCampaignReview,
  changeCampaignReview,
  reviewServiceDependencies,
} from "@/lib/campaigns/x-review/review-service";
import { type EditorialReview } from "@/lib/campaigns/x-review/editorial";
import {
  renderXReviewEmail,
  type XReviewReport,
} from "@/lib/campaigns/x-review/report";

const now = new Date("2026-09-07T12:00:00Z");
const id = "x-review-11111111-1111-4111-8111-111111111111";
const env = {
  JELOCARE_X_REVIEW_ENABLED: "true",
  JELOCARE_X_BEARER_TOKEN: "fictional-token",
  JELOCARE_X_REPORT_EMAIL: "operator@example.invalid",
  JELOCARE_X_PILOT_ENDS_AT: "2026-09-09T12:00:00Z",
  CRON_SECRET: "fictional-secret-at-least-sixteen",
};
const identity = {
  subject: "verified-stable-subject",
  email: " Operator@EXAMPLE.invalid ",
  emailVerified: true,
  name: null,
};
const report: XReviewReport = {
  id,
  checkedAt: now.toISOString(),
  recipientKey: campaignRecipientKey(env.JELOCARE_X_REPORT_EMAIL, env),
  moreAvailable: false,
  aiStatus: "disabled",
  aiCostUsd: null,
  items: [
    {
      source: {
        id: "123",
        username: "fictional",
        authorId: "456",
        text: "@jelocare delivery fees surprised me",
        createdAt: now.toISOString(),
        hasMedia: false,
        sensitive: false,
        metrics: { likes: 0, replies: 0, reposts: 0, views: null },
        parent: {
          id: "789",
          authorId: "999",
          username: "jelocare",
          text: "Check your total before checkout.",
        },
      },
      classification: "answer promptly",
      reason: "Review the context.",
      draft: "Delivery fee wanted its own introduction.",
    },
  ],
};

function fixture() {
  let editorial: EditorialReview | null = null;
  let stored = structuredClone(report);
  let authCalls = 0,
    loads = 0,
    writes = 0;
  let allowed = true;
  const deps: typeof reviewServiceDependencies = {
    ...reviewServiceDependencies,
    access: async () => {
      authCalls++;
      return allowed
        ? {
            status: "ready",
            actor: {
              subject: identity.subject,
              recipientKey: report.recipientKey,
            },
          }
        : { status: "forbidden" };
    },
    reports: {
      ...reviewServiceDependencies.reports,
      load: async () => {
        loads++;
        return structuredClone(stored);
      },
    },
    reviews: {
      load: async () => editorial && structuredClone(editorial),
      compareAndSet: async (_r, version, next) => {
        if (version !== (editorial?.version ?? 0)) return false;
        editorial = structuredClone(next);
        writes++;
        return true;
      },
    },
  };
  return {
    deps,
    revoke: () => {
      allowed = false;
    },
    replace: (value: XReviewReport) => {
      stored = value;
    },
    counts: () => ({ authCalls, loads, writes }),
    editorial: () => editorial,
  };
}

test("campaign continuation accepts only one exact local report path, preserves other intents", () => {
  assert.equal(
    resolveSignInContinuation("/campaign-review"),
    "/campaign-review",
  );
  assert.equal(resolveSignInIntent("/campaign-review"), "campaign");
  const path = campaignReviewPath(id)!;
  assert.equal(resolveSignInContinuation(path), path);
  assert.equal(resolveSignInIntent(path), "campaign");
  for (const invalid of [
    `https://evil.invalid${path}`,
    `//evil.invalid${path}`,
    `${path}?next=/ops`,
    `${path}#x`,
    `${path}/../ops`,
    path.replace("x-review-", "%78-review-"),
    "/campaign-review/x-review-" + "-".repeat(36),
    "/campaign-review?next=/ops",
    "/campaign-review/",
    "/campaign-review#x",
    "https://evil.invalid/campaign-review",
    "//evil.invalid/campaign-review",
  ])
    assert.equal(resolveSignInContinuation(invalid), "/ops");
  assert.equal(resolveSignInContinuation([path, "/ops"]), "/ops");
  assert.equal(resolveSignInIntent("/me"), "customer");
  assert.equal(resolveSignInIntent("/ops"), "operator");
});

test("only the verified campaign inbox identity is authorized; no broad Ops role grants", async () => {
  assert.equal(
    (
      await campaignReviewAccess(env, now, async () => ({
        status: "authenticated",
        identity,
      }))
    ).status,
    "ready",
  );
  for (const overridden of [
    { emailVerified: false },
    { email: "another@example.invalid" },
    { email: null },
    { subject: "" },
  ]) {
    assert.equal(
      (
        await campaignReviewAccess(env, now, async () => ({
          status: "authenticated",
          identity: { ...identity, ...overridden },
        }))
      ).status,
      "forbidden",
    );
  }
  assert.equal(
    (
      await campaignReviewAccess(env, now, async () => ({
        status: "signed-out",
      }))
    ).status,
    "signed-out",
  );
  assert.equal(
    (
      await campaignReviewAccess(env, now, async () => {
        throw new Error("private SDK detail");
      })
    ).status,
    "unavailable",
  );
  assert.equal(
    (
      await campaignReviewAccess({}, now, async () => {
        throw new Error("must not call");
      })
    ).status,
    "disabled",
  );
});

test("unauthorized users cannot read the report store or mutate it", async () => {
  const f = fixture();
  f.revoke();
  assert.equal((await readCampaignReview(id, now, f.deps)).status, "forbidden");
  assert.equal(
    (
      await changeCampaignReview(
        id,
        { sourceId: "123", expectedVersion: 0, operation: "reject" },
        now,
        f.deps,
      )
    ).status,
    "error",
  );
  assert.deepEqual(f.counts(), { authCalls: 2, loads: 0, writes: 0 });
});

test("recipient changes and malformed ids do not disclose stored report content", async () => {
  const f = fixture();
  assert.equal(
    (await readCampaignReview("../../../ops", now, f.deps)).status,
    "not-found",
  );
  assert.equal(f.counts().loads, 0);
  f.replace({ ...report, recipientKey: "changed-recipient" });
  assert.deepEqual(await readCampaignReview(id, now, f.deps), {
    status: "not-found",
  });
  assert.equal(
    (
      await changeCampaignReview(
        id,
        { sourceId: "123", expectedVersion: 0, operation: "reject" },
        now,
        f.deps,
      )
    ).status,
    "error",
  );
  assert.equal(f.counts().writes, 0);
});

test("read/edit/approve/reopen use verified actor and exact saved version, without leaking identity", async () => {
  const f = fixture();
  const loaded = await readCampaignReview(id, now, f.deps);
  assert.equal(loaded.status, "ready");
  assert.doesNotMatch(
    JSON.stringify(loaded),
    /verified-stable-subject|recipientKey|operator@example/,
  );
  const saved = await changeCampaignReview(
    id,
    {
      sourceId: "123",
      expectedVersion: 0,
      operation: "save",
      text: "The delivery fee came with its own plans.",
    },
    now,
    f.deps,
  );
  assert.equal(saved.status, "saved");
  if (saved.status !== "saved") return;
  const approved = await changeCampaignReview(
    id,
    {
      sourceId: "123",
      expectedVersion: 1,
      operation: "approve",
      text: saved.view.items[0].text,
      checkedLive: true,
      copyHash: saved.view.items[0].copyHash,
    },
    now,
    f.deps,
  );
  assert.equal(approved.status, "saved");
  if (approved.status !== "saved") return;
  assert.equal(approved.view.items[0].status, "approved");
  assert.equal(f.editorial()?.items[0].actor, identity.subject);
  assert.equal(
    (
      await changeCampaignReview(
        id,
        { sourceId: "123", expectedVersion: 1, operation: "reject" },
        now,
        f.deps,
      )
    ).status,
    "error",
  );
  const reopened = await changeCampaignReview(
    id,
    { sourceId: "123", expectedVersion: 2, operation: "reopen" },
    now,
    f.deps,
  );
  assert.equal(reopened.status, "saved");
  if (reopened.status !== "saved") return;
  assert.equal(reopened.view.items[0].approvedHash, null);
  assert.equal(f.counts().authCalls, 5);
});

test("revoked access, expiry and atomic store conflict cannot save", async () => {
  const f = fixture();
  await readCampaignReview(id, now, f.deps);
  f.revoke();
  const input = {
    sourceId: "123",
    expectedVersion: 0,
    operation: "reject" as const,
  };
  assert.equal(
    (await changeCampaignReview(id, input, now, f.deps)).status,
    "error",
  );
  const g = fixture();
  const stale = await readCampaignReview(
    id,
    new Date(now.valueOf() + 3_600_001),
    g.deps,
  );
  assert.equal(stale.status === "ready" && stale.view.expired, true);
  assert.equal(
    (
      await changeCampaignReview(
        id,
        input,
        new Date(now.valueOf() + 3_600_001),
        g.deps,
      )
    ).status,
    "error",
  );
  g.deps.reviews.compareAndSet = async () => false;
  assert.equal(
    (await changeCampaignReview(id, input, now, g.deps)).status,
    "error",
  );
  assert.equal(g.counts().writes, 0);
});

test("care/manual holds cannot be overridden; provider errors reveal no details", async () => {
  const f = fixture();
  f.replace({
    ...report,
    items: [
      {
        ...report.items[0],
        classification: "care/safety response",
        draft: null,
      },
    ],
  });
  assert.equal(
    (
      await changeCampaignReview(
        id,
        {
          sourceId: "123",
          expectedVersion: 0,
          operation: "save",
          text: "Hello there",
        },
        now,
        f.deps,
      )
    ).status,
    "error",
  );
  f.deps.reports.load = async () => {
    throw new Error("secret provider payload");
  };
  assert.deepEqual(await readCampaignReview(id, now, f.deps), {
    status: "unavailable",
  });
  assert.doesNotMatch(
    JSON.stringify(
      await changeCampaignReview(
        id,
        { sourceId: "123", expectedVersion: 0, operation: "reject" },
        now,
        f.deps,
      ),
    ),
    /secret provider/,
  );
});

test("private email links to authenticated fixed-origin desk and never carries an approval token", () => {
  const email = renderXReviewEmail(report);
  const url = `https://www.jelocare.com/campaign-review/${id}`;
  assert.ok(email.html.includes(`href="${url}"`));
  assert.ok(email.text.includes(url));
  assert.match(email.text, /Approval does not publish/);
  assert.doesNotMatch(email.html, /recipientKey|operator@example|sha256=/);
});
