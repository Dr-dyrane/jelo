import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  editorialCopyHash,
  initialEditorialReview,
  transitionEditorialReview,
  EditorialReviewError,
  type EditorialTransitionInput,
  type EditorialReview,
} from "@/lib/campaigns/x-review/editorial";
import {
  CAS_X_EDITORIAL_REVIEW,
  xEditorialStore,
} from "@/lib/campaigns/x-review/review-store";
import {
  reportHash,
  type XReviewReport,
} from "@/lib/campaigns/x-review/report";

const checkedAt = "2026-09-07T09:00:00.000Z";
const now = new Date("2026-09-07T09:05:00.000Z");
const actor = "editor@example.invalid";
function report(): XReviewReport {
  return {
    id: "x-review-11111111-1111-4111-8111-111111111111",
    checkedAt,
    recipientKey: "a".repeat(64),
    moreAvailable: false,
    aiStatus: "completed",
    aiCostUsd: 0.001,
    items: [
      {
        source: {
          id: "123",
          text: "@jelocare That delivery fee surprised me",
          authorId: "456",
          username: "reader",
          createdAt: checkedAt,
          parent: {
            id: "789",
            text: "Check the full total before checkout",
            authorId: "999",
            username: "jelocare",
          },
          metrics: { replies: 0, reposts: 0, likes: 2, views: 30 },
          hasMedia: false,
          sensitive: false,
        },
        classification: "light banter",
        reason: "Unapproved draft",
        draft: "Delivery fee wanted its own introduction 😭",
      },
    ],
  };
}
function transition(
  r: XReviewReport,
  current: EditorialReview,
  input: Partial<EditorialTransitionInput> &
    Pick<EditorialTransitionInput, "operation">,
  at = now,
) {
  return transitionEditorialReview(
    r,
    current,
    { sourceId: "123", expectedVersion: current.version, ...input },
    actor,
    at,
  );
}
function error(code: EditorialReviewError["code"]) {
  return (value: unknown) =>
    value instanceof EditorialReviewError && value.code === code;
}

test("editorial initialization is unapproved and does not mutate the private report", () => {
  const r = report();
  const before = structuredClone(r);
  const current = initialEditorialReview(r);
  assert.deepEqual(current, {
    reportId: r.id,
    reportHash: reportHash(r),
    version: 0,
    items: [
      {
        sourceId: "123",
        text: r.items[0].draft,
        status: "draft",
        feedback: null,
        approvedHash: null,
        actor: null,
        updatedAt: null,
      },
    ],
  });
  assert.deepEqual(r, before);
});

test("editorial copy hash binds exact whitespace, full source and parent, report hash and explicit no-media", () => {
  const r = report();
  const item = initialEditorialReview(r).items[0];
  const expected = createHash("sha256")
    .update(
      JSON.stringify({
        reportHash: reportHash(r),
        source: r.items[0].source,
        parent: r.items[0].source.parent,
        sourceId: item.sourceId,
        text: item.text,
        media: "none",
      }),
    )
    .digest("hex");
  assert.equal(editorialCopyHash(r, item), expected);
  assert.notEqual(
    editorialCopyHash(r, { ...item, text: item.text + " " }),
    expected,
  );
  for (const change of [
    (changed: XReviewReport) => {
      changed.items[0].source.text = "Changed source";
    },
    (changed: XReviewReport) => {
      changed.items[0].source.parent!.text = "Changed parent";
    },
    (changed: XReviewReport) => {
      changed.items[0].source.metrics.likes = 9;
    },
    (changed: XReviewReport) => {
      changed.recipientKey = "b".repeat(64);
    },
  ]) {
    const changed = structuredClone(r);
    change(changed);
    assert.notEqual(editorialCopyHash(changed, item), expected);
  }
});

test("save and approve retain exact copy, require saved hash and live check, and record actor/version", () => {
  const r = report();
  const initial = initialEditorialReview(r);
  const copy = "  Delivery fee brought a plus one 😭 ";
  const saved = transition(r, initial, { operation: "save", text: copy });
  assert.equal(saved.version, 1);
  assert.equal(saved.items[0].text, copy);
  assert.equal(saved.items[0].actor, actor);
  assert.equal(saved.items[0].updatedAt, now.toISOString());
  assert.equal(initial.version, 0);
  assert.equal(initial.items[0].text, r.items[0].draft);
  const hash = editorialCopyHash(r, saved.items[0]);
  assert.throws(
    () => transition(r, saved, { operation: "approve", copyHash: hash }),
    error("x-review-editorial-live-check-required"),
  );
  assert.throws(
    () =>
      transition(r, saved, {
        operation: "approve",
        copyHash: "f".repeat(64),
        checkedLive: true,
      }),
    error("x-review-editorial-copy-mismatch"),
  );
  assert.throws(
    () =>
      transition(r, saved, {
        operation: "approve",
        copyHash: hash,
        text: copy.trim(),
        checkedLive: true,
      }),
    error("x-review-editorial-copy-mismatch"),
  );
  const approved = transition(r, saved, {
    operation: "approve",
    copyHash: hash,
    checkedLive: true,
  });
  assert.equal(approved.version, 2);
  assert.equal(approved.items[0].status, "approved");
  assert.equal(approved.items[0].approvedHash, hash);
  assert.equal(approved.items[0].text, copy);
  assert.throws(
    () =>
      transition(r, approved, {
        operation: "approve",
        copyHash: hash,
        checkedLive: true,
      }),
    error("x-review-editorial-invalid-state"),
  );
  assert.throws(
    () => transition(r, approved, { operation: "save", text: "Changed" }),
    error("x-review-editorial-invalid-state"),
  );
});

test("all editorial mutations enforce optimistic version, report binding and one-hour freshness", () => {
  const r = report();
  const current = initialEditorialReview(r);
  for (const operation of [
    "save",
    "approve",
    "reject",
    "reopen",
    "request-changes",
  ] as const) {
    const input = {
      operation,
      text: "Hello there",
      copyHash: editorialCopyHash(r, current.items[0]),
      checkedLive: true,
      feedback: "Shorter please",
    };
    assert.throws(
      () => transition(r, current, { ...input, expectedVersion: 1 }),
      error("x-review-editorial-version-conflict"),
    );
    for (const at of [
      new Date("2026-09-07T08:59:59.999Z"),
      new Date("2026-09-07T10:00:00.001Z"),
      new Date("invalid"),
    ]) {
      assert.throws(
        () => transition(r, current, input, at),
        error("x-review-editorial-stale"),
      );
    }
    const changed = structuredClone(r);
    changed.items[0].source.parent!.text += " changed";
    assert.throws(
      () => transition(changed, current, input),
      error("x-review-editorial-report-mismatch"),
    );
  }
  assert.equal(
    transition(
      r,
      current,
      { operation: "reject" },
      new Date("2026-09-07T10:00:00.000Z"),
    ).version,
    1,
  );
});

test("manual and care holds can be rejected or reopened but never edited or approved", () => {
  for (const classification of [
    "care/safety response",
    "manual review",
  ] as const) {
    const r = report();
    r.items[0].classification = classification;
    const current = initialEditorialReview(r);
    assert.equal(current.items[0].text, "");
    for (const operation of ["save", "approve", "request-changes"] as const) {
      assert.throws(
        () =>
          transition(r, current, {
            operation,
            text: "Hello there",
            feedback: "Rewrite please",
            checkedLive: true,
            copyHash: editorialCopyHash(r, current.items[0]),
          }),
        error("x-review-editorial-held"),
      );
    }
    const rejected = transition(r, current, {
      operation: "reject",
      feedback: "Needs manual care review",
    });
    assert.equal(rejected.items[0].status, "rejected");
    assert.equal(rejected.version, 1);
    const reopened = transition(r, rejected, { operation: "reopen" });
    assert.equal(reopened.items[0].status, "draft");
    assert.equal(reopened.items[0].approvedHash, null);
    assert.throws(
      () => transition(r, reopened, { operation: "save", text: "Hello there" }),
      error("x-review-editorial-held"),
    );
    assert.equal(r.items[0].classification, classification);
  }
});

test("unsafe, empty or overlong edits fail while the copy limit counts code points", () => {
  const r = report();
  const current = initialEditorialReview(r);
  for (const text of [
    "",
    "   ",
    "Use SPF 50",
    "Guaranteed cure",
    "My face is burning",
    "Visit https://example.com",
    "x".repeat(241),
    "a".repeat(240) + " ",
  ]) {
    assert.throws(
      () => transition(r, current, { operation: "save", text }),
      (value) => value instanceof EditorialReviewError,
    );
  }
  assert.equal(
    transition(r, current, { operation: "save", text: "🧴".repeat(240) })
      .items[0].text,
    "🧴".repeat(240),
  );
});

test("request changes records bounded feedback without AI work and save/reopen invalidate approval", () => {
  const r = report();
  const initial = initialEditorialReview(r);
  const approved = transition(r, initial, {
    operation: "approve",
    checkedLive: true,
    copyHash: editorialCopyHash(r, initial.items[0]),
  });
  const changes = transition(r, approved, {
    operation: "request-changes",
    feedback: "Keep it short and natural.",
  });
  assert.equal(changes.items[0].status, "changes-requested");
  assert.equal(changes.items[0].approvedHash, null);
  assert.equal(changes.items[0].feedback, "Keep it short and natural.");
  assert.equal(changes.items[0].text, initial.items[0].text);
  const saved = transition(r, changes, {
    operation: "save",
    text: "That fee came with company 😭",
  });
  assert.equal(saved.items[0].status, "draft");
  assert.equal(saved.version, 3);
  const reopened = transition(r, approved, { operation: "reopen" });
  assert.equal(reopened.items[0].approvedHash, null);
  assert.equal(reopened.items[0].status, "draft");
  assert.throws(
    () =>
      transition(r, initial, { operation: "request-changes", feedback: " " }),
    error("x-review-editorial-feedback-required"),
  );
  assert.throws(
    () =>
      transition(r, initial, {
        operation: "request-changes",
        feedback: "x".repeat(601),
      }),
    error("x-review-editorial-invalid-input"),
  );
  assert.equal(
    transition(r, initial, {
      operation: "request-changes",
      feedback: "x".repeat(600),
    }).items[0].feedback?.length,
    600,
  );
});

test("stale tabs cannot replay mutations and malformed state fails closed", () => {
  const r = report();
  const current = initialEditorialReview(r);
  const saved = transition(r, current, {
    operation: "save",
    text: "That fee came with company 😭",
  });
  assert.throws(
    () => transition(r, saved, { operation: "reject", expectedVersion: 0 }),
    error("x-review-editorial-version-conflict"),
  );
  assert.throws(
    () => transition(r, { ...current, items: [] }, { operation: "reject" }),
    error("x-review-editorial-invalid-state"),
  );
  assert.throws(
    () => transition(r, current, { operation: "reject", sourceId: "999" }),
    error("x-review-editorial-source-missing"),
  );
  assert.throws(
    () =>
      transitionEditorialReview(
        r,
        current,
        { sourceId: "123", expectedVersion: 0, operation: "reject" },
        "",
        now,
      ),
    error("x-review-editorial-invalid-input"),
  );
});

test("changes-requested feedback may be updated only at the current version", () => {
  const r = report();
  const initial = initialEditorialReview(r);
  const changes = transition(r, initial, {
    operation: "request-changes",
    feedback: "Shorter please",
  });
  const feedback = "  Keep the joke but remove the extra explanation.  ";
  const updated = transition(r, changes, {
    operation: "request-changes",
    feedback,
  });
  assert.equal(updated.version, 2);
  assert.equal(updated.items[0].status, "changes-requested");
  assert.equal(updated.items[0].feedback, feedback);
  assert.equal(updated.items[0].text, initial.items[0].text);
  assert.equal(updated.items[0].approvedHash, null);
  assert.equal(updated.items[0].actor, actor);
  assert.throws(
    () =>
      transition(r, updated, {
        operation: "request-changes",
        feedback: "Stale change",
        expectedVersion: 1,
      }),
    error("x-review-editorial-version-conflict"),
  );
});

test("editorial CAS is a separate atomic key, bound to original report existence, exact bytes, version and remaining TTL", () => {
  assert.match(CAS_X_EDITORIAL_REVIEW, /GET', KEYS\[1\]/);
  assert.match(CAS_X_EDITORIAL_REVIEW, /original ~= ARGV\[4\]/);
  assert.match(CAS_X_EDITORIAL_REVIEW, /PTTL', KEYS\[1\]/);
  assert.match(CAS_X_EDITORIAL_REVIEW, /ttl <= 0/);
  assert.match(CAS_X_EDITORIAL_REVIEW, /local version = 0/);
  assert.match(CAS_X_EDITORIAL_REVIEW, /version ~= expected/);
  assert.match(CAS_X_EDITORIAL_REVIEW, /next\.version ~= expected \+ 1/);
  assert.match(
    CAS_X_EDITORIAL_REVIEW,
    /math\.min\(ttl, tonumber\(ARGV\[3\]\)\)/,
  );
  assert.match(CAS_X_EDITORIAL_REVIEW, /SET', KEYS\[2\], ARGV\[2\], 'PX', ttl/);
  assert.doesNotMatch(
    CAS_X_EDITORIAL_REVIEW,
    /(?:SET|EXPIRE|PEXPIRE|DEL)', KEYS\[1\]/,
  );
});

test("editorial store rejects invalid IDs and invalid CAS before touching Redis", async () => {
  await assert.rejects(
    xEditorialStore.load("../report"),
    error("x-review-editorial-invalid-input"),
  );
  const r = report();
  const current = initialEditorialReview(r);
  await assert.rejects(
    xEditorialStore.compareAndSet(r, 0, current),
    error("x-review-editorial-invalid-state"),
  );
  await assert.rejects(
    xEditorialStore.compareAndSet(r, 0, {
      ...current,
      version: 1,
      reportHash: "f".repeat(64),
    }),
    error("x-review-editorial-invalid-state"),
  );
});
