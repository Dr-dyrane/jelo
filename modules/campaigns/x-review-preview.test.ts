import assert from "node:assert/strict";
import test from "node:test";
import type { AuthIdentity, AuthSubjectResult } from "@/lib/auth/subject";
import { campaignReviewAccess } from "@/lib/campaigns/x-review/access";
import type { XReviewPost } from "@/lib/campaigns/x-review/client";
import {
  PILOT_RUN_LIMIT,
  type XReviewReport,
} from "@/lib/campaigns/x-review/report";
import {
  defaultXReviewDependencies,
  prepareXReview,
} from "@/lib/campaigns/x-review/runner";
import {
  previewServiceDependencies,
  startCampaignPreview,
} from "@/lib/campaigns/x-review/preview-service";

const now = new Date("2026-09-07T12:00:00Z");
const env = Object.freeze({
  JELOCARE_X_REVIEW_ENABLED: "true",
  JELOCARE_X_BEARER_TOKEN: "fictional-preview-token",
  JELOCARE_X_REPORT_EMAIL: "operator@example.invalid",
  JELOCARE_X_PILOT_ENDS_AT: "2026-09-14T12:00:00Z",
  JELOCARE_X_AI_ENABLED: "true",
  JELOCARE_X_EMAIL_ENABLED: "true",
  CRON_SECRET: "fictional-preview-secret-at-least-sixteen",
});
const identity: AuthIdentity = {
  subject: "private-campaign-subject",
  email: " Operator@EXAMPLE.invalid ",
  emailVerified: true,
  name: null,
};
const post: XReviewPost = {
  id: "123",
  authorId: "456",
  username: "fictional",
  text: "@jelocare the delivery fee surprised me",
  createdAt: now.toISOString(),
  parent: {
    id: "789",
    authorId: "999",
    username: "jelocare",
    text: "Check your full total before checkout.",
  },
  metrics: { replies: 0, reposts: 0, likes: 1, views: 20 },
  hasMedia: false,
  sensitive: false,
};

function fixture() {
  let session: AuthSubjectResult = { status: "authenticated", identity };
  let authCalls = 0,
    preparations = 0,
    reservations = 0,
    attempts = 0,
    reads = 0,
    drafts = 0,
    emails = 0;
  let runEnv: Record<string, string | undefined> | undefined;
  const slots = new Set<number>();
  const reports = new Map<string, XReviewReport>();
  const runner: typeof defaultXReviewDependencies = {
    ...defaultXReviewDependencies,
    read: async () => {
      reads++;
      return { posts: [post], moreAvailable: false, accountId: "999" };
    },
    draft: async (items) => {
      drafts++;
      return { items, aiStatus: "completed", aiCostUsd: 0.001 };
    },
    send: async () => {
      emails++;
    },
    hasMail: () => true,
    store: {
      // An atomic in-memory ledger shared by every caller below. This checks
      // service/runner integration, not live Redis Lua execution.
      reserveRun: async (at) => {
        reservations++;
        const slot = Math.floor(at.valueOf() / (12 * 3_600_000));
        if (slots.has(slot) || attempts >= PILOT_RUN_LIMIT) return false;
        slots.add(slot);
        attempts++;
        return true;
      },
      wasReported: async () => false,
      save: async (report) => {
        reports.set(report.id, structuredClone(report));
      },
      load: async (id) => reports.get(id) ?? null,
      reserveDelivery: async () => {
        throw new Error("Preview must not reserve email delivery");
      },
      deliveryOutcome: async () => {
        throw new Error("Preview must not record email delivery");
      },
    },
  };
  const deps: typeof previewServiceDependencies = {
    access: (e, at) => {
      authCalls++;
      return campaignReviewAccess(e, at, async () => session);
    },
    prepare: (e, at) => {
      preparations++;
      runEnv = e;
      return prepareXReview(e, at, runner);
    },
  };
  return {
    deps,
    runner,
    reports,
    setSession: (next: AuthSubjectResult) => {
      session = next;
    },
    runEnv: () => runEnv,
    counts: () => ({
      authCalls,
      preparations,
      reservations,
      attempts,
      reads,
      drafts,
      emails,
    }),
  };
}

test("real access helper denies signed-out, unverified, wrong-email and unavailable identities before paid work", async () => {
  const denied: AuthSubjectResult[] = [
    { status: "signed-out" },
    { status: "unavailable" },
    ...[
      { emailVerified: false },
      { email: "other@example.invalid" },
      { email: null },
      { subject: "" },
    ].map((override) => ({
      status: "authenticated" as const,
      identity: { ...identity, ...override },
    })),
  ];
  for (const session of denied) {
    const f = fixture();
    f.setSession(session);
    const result = await startCampaignPreview(true, env, now, f.deps);
    assert.equal(result.status, "error");
    if (result.status !== "error") throw new Error("must deny");
    assert.equal(
      result.signInRequired,
      session.status === "signed-out" ? true : undefined,
    );
    assert.equal(f.counts().authCalls, 1);
    assert.equal(f.counts().preparations, 0);
    assert.equal(f.counts().reservations, 0);
    assert.equal(f.counts().reads, 0);
    assert.doesNotMatch(
      JSON.stringify(result),
      /operator@example|private-campaign-subject|token|secret/,
    );
  }
});

test("disabled and invalid pilot configuration fail before the runner", async () => {
  for (const overrides of [
    { JELOCARE_X_REVIEW_ENABLED: "false" },
    { JELOCARE_X_PILOT_ENDS_AT: "2026-09-01T12:00:00Z" },
    { JELOCARE_X_BEARER_TOKEN: "[SENSITIVE]" },
  ]) {
    const f = fixture();
    const result = await startCampaignPreview(
      true,
      { ...env, ...overrides },
      now,
      f.deps,
    );
    assert.equal(result.status, "error");
    if (result.status !== "error") throw new Error("must deny");
    assert.match(result.message, /No X request was made/);
    assert.equal(f.counts().preparations, 0);
  }
});

test("access exceptions are sanitized and do not consume a run", async () => {
  const f = fixture();
  f.deps.access = async () => {
    throw new Error("private token and operator@example.invalid");
  };
  const result = await startCampaignPreview(true, env, now, f.deps);
  assert.equal(result.status, "error");
  assert.match(JSON.stringify(result), /couldn’t verify campaign access/);
  assert.doesNotMatch(JSON.stringify(result), /private token|operator@example/);
  assert.equal(f.counts().preparations, 0);
});

test("every call reauthorizes, including a formerly valid client after access revocation", async () => {
  const f = fixture();
  assert.equal(
    (await startCampaignPreview(true, env, now, f.deps)).status,
    "ready",
  );
  f.setSession({ status: "signed-out" });
  assert.deepEqual(await startCampaignPreview(true, env, now, f.deps), {
    status: "error",
    message: "Sign in with the campaign email before running a preview.",
    signInRequired: true,
  });
  assert.equal(f.counts().authCalls, 2);
  assert.equal(f.counts().preparations, 1);
});

test("only literal boolean true authorizes a paid preview; input is never coerced", async () => {
  const f = fixture();
  const invalid: unknown[] = [
    undefined,
    null,
    false,
    0,
    1,
    "true",
    "on",
    {},
    [],
    [true],
    {
      valueOf() {
        throw new Error("must not coerce");
      },
      toString() {
        throw new Error("must not coerce");
      },
    },
  ];
  for (const confirmed of invalid) {
    const result = await startCampaignPreview(confirmed, env, now, f.deps);
    assert.equal(result.status, "error");
    assert.match(JSON.stringify(result), /Confirm the paid preview/);
  }
  assert.equal(f.counts().authCalls, invalid.length);
  assert.equal(f.counts().preparations, 0);
  assert.equal(f.counts().attempts, 0);
});

test("the real runner receives a copied environment with AI and email forced off", async () => {
  const f = fixture();
  const processAi = process.env.JELOCARE_X_AI_ENABLED;
  const processEmail = process.env.JELOCARE_X_EMAIL_ENABLED;
  const result = await startCampaignPreview(true, env, now, f.deps);
  assert.equal(result.status, "ready");
  assert.notEqual(f.runEnv(), env);
  assert.deepEqual(f.runEnv(), {
    ...env,
    JELOCARE_X_AI_ENABLED: "false",
    JELOCARE_X_EMAIL_ENABLED: "false",
  });
  assert.equal(env.JELOCARE_X_AI_ENABLED, "true");
  assert.equal(env.JELOCARE_X_EMAIL_ENABLED, "true");
  assert.equal(process.env.JELOCARE_X_AI_ENABLED, processAi);
  assert.equal(process.env.JELOCARE_X_EMAIL_ENABLED, processEmail);
  assert.equal(f.counts().reads, 1);
  assert.equal(f.counts().drafts, 0);
  assert.equal(f.counts().emails, 0);
  const [stored] = [...f.reports.values()];
  assert.equal(stored.aiStatus, "disabled");
  assert.equal(stored.items[0].draft, null);
});

test("successful client output contains only a validated local path and item count", async () => {
  const f = fixture();
  const result = await startCampaignPreview(true, env, now, f.deps);
  const [stored] = [...f.reports.values()];
  assert.deepEqual(result, {
    status: "ready",
    reportPath: `/campaign-review/${stored.id}`,
    itemCount: 1,
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /email|sha256|html|recipient|actor|token|secret|delivery fee/,
  );
});

test("empty reports open for inspection and cannot initiate email", async () => {
  const f = fixture();
  f.runner.read = async () => ({
    posts: [],
    moreAvailable: false,
    accountId: "999",
  });
  const result = await startCampaignPreview(true, env, now, f.deps);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("missing empty preview");
  assert.equal(result.itemCount, 0);
  assert.equal(f.reports.size, 1);
  assert.equal(f.counts().emails, 0);
});

test("concurrent desk calls and a protected-route runner share one nonrefundable slot", async () => {
  const f = fixture();
  const results = await Promise.all([
    startCampaignPreview(true, env, now, f.deps),
    startCampaignPreview(true, env, now, f.deps),
    prepareXReview({ ...env, JELOCARE_X_AI_ENABLED: "false" }, now, f.runner),
  ]);
  assert.equal(
    results.filter(
      (result) =>
        result.status === "ready" || result.status === "preview-ready",
    ).length,
    1,
  );
  assert.equal(f.counts().attempts, 1);
  assert.equal(f.counts().reads, 1);
  assert.equal(f.reports.size, 1);
});

test("the service retains the real runner's shared six-attempt lifetime cap across UTC buckets", async () => {
  const f = fixture();
  for (let index = 0; index < PILOT_RUN_LIMIT; index++) {
    const at = new Date(now.valueOf() + index * 12 * 3_600_000);
    assert.equal(
      (await startCampaignPreview(true, env, at, f.deps)).status,
      "ready",
    );
  }
  const result = await startCampaignPreview(
    true,
    env,
    new Date(now.valueOf() + PILOT_RUN_LIMIT * 12 * 3_600_000),
    f.deps,
  );
  assert.equal(result.status, "error");
  assert.match(
    JSON.stringify(result),
    /12-hour window or the six-attempt pilot allowance/,
  );
  assert.equal(f.counts().attempts, 6);
  assert.equal(f.counts().reads, 6);
});

test("source failure consumes its reservation, is never retried, and returns no provider detail", async () => {
  const f = fixture();
  let failures = 0;
  f.runner.read = async () => {
    failures++;
    throw new Error("private provider token https://example.invalid");
  };
  const result = await startCampaignPreview(true, env, now, f.deps);
  assert.equal(result.status, "error");
  assert.match(JSON.stringify(result), /An attempt may have been consumed/);
  assert.doesNotMatch(JSON.stringify(result), /provider token|https:\/\//);
  assert.equal(failures, 1);
  assert.equal(f.counts().attempts, 1);
  assert.equal(f.reports.size, 0);
  const second = await startCampaignPreview(true, env, now, f.deps);
  assert.match(JSON.stringify(second), /six-attempt pilot allowance/);
  assert.equal(failures, 1);
});

test("store reservation failure prevents all source, AI and email work", async () => {
  const f = fixture();
  f.runner.store.reserveRun = async () => {
    throw new Error("private Redis URL and token");
  };
  const result = await startCampaignPreview(true, env, now, f.deps);
  assert.equal(result.status, "error");
  assert.doesNotMatch(JSON.stringify(result), /Redis|token/);
  assert.equal(f.counts().reads, 0);
  assert.equal(f.counts().drafts, 0);
  assert.equal(f.counts().emails, 0);
});

test("invalid runner report paths or counts fail closed without exposing email/hash fields", async () => {
  const validId = "x-review-11111111-1111-4111-8111-111111111111";
  const invalid = [
    { reportId: "https://evil.invalid/report" },
    { reportId: "../../../ops" },
    { reportId: `${validId}?token=private` },
    { reportId: `${validId}#fragment` },
    { reportId: "x-review-" + "-".repeat(36) },
    { itemCount: -1 },
    { itemCount: 6 },
    { itemCount: NaN },
    { itemCount: 1.5 },
  ];
  for (const override of invalid) {
    const f = fixture();
    f.deps.prepare = async () => ({
      status: "preview-ready",
      reportId: validId,
      itemCount: 1,
      sha256: "private-hash",
      email: { subject: "private", text: "private", html: "private" },
      ...override,
    });
    const result = await startCampaignPreview(true, env, now, f.deps);
    assert.equal(result.status, "error");
    assert.doesNotMatch(
      JSON.stringify(result),
      /evil|private|sha256|email|token/,
    );
  }
});

test("a disabled result from the shared runner is surfaced without a retry", async () => {
  const f = fixture();
  let calls = 0;
  f.deps.prepare = async () => {
    calls++;
    return { status: "disabled" };
  };
  assert.deepEqual(await startCampaignPreview(true, env, now, f.deps), {
    status: "error",
    message: "The preview pilot is disabled. No X request was made.",
  });
  assert.equal(calls, 1);
});
