import assert from "node:assert/strict";
import test from "node:test";
import {
  createConsultTimelineRecord,
  recordConsultOutcome,
  isOutcomeFollowUpDue,
  summarizeTimelineOutcomes,
} from "./consult-timeline";

test("consult timeline exposes only session-safe comparison fields", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["dry-dehydrated-skin"],
    market: "NG",
    recommendedProductSlugs: ["cerave-pm-facial-moisturising-lotion-52ml"],
    createdAt: "2026-07-27T10:00:00.000Z",
  });

  assert.equal(record.schemaVersion, 2);
  assert.equal(record.followUpAt, "2026-08-24T10:00:00.000Z");
  assert.deepEqual(Object.keys(record).sort(), [
    "assessmentType",
    "concernSlugs",
    "createdAt",
    "followUpAt",
    "id",
    "market",
    "recommendedProductSlugs",
    "schemaVersion",
  ]);
});

test("consult timeline cannot encode inferred clinical state or trend", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["dry-dehydrated-skin", "dry-dehydrated-skin"],
    market: "NG",
    recommendedProductSlugs: ["cerave-pm-facial-moisturising-lotion-52ml"],
    createdAt: "2026-07-27T10:00:00.000Z",
  });
  const serialized = JSON.stringify(record);

  assert.deepEqual(record.concernSlugs, ["dry-dehydrated-skin"]);
  assert.doesNotMatch(
    serialized,
    /barrier|improving|worsening|stable|clinical/i,
  );
});

test("recordConsultOutcome sets outcome fields and preserves existing data", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["acne-breakouts"],
    market: "NG",
    recommendedProductSlugs: ["cosrx-salicylic-acid-daily-gentle-cleanser"],
    createdAt: "2026-07-27T10:00:00.000Z",
  });

  const updated = recordConsultOutcome(
    record,
    "helped",
    "Cleared up in two weeks",
  );

  assert.equal(updated.outcome, "helped");
  assert.equal(updated.outcomeNote, "Cleared up in two weeks");
  assert.ok(updated.outcomeRecordedAt);
  // Original fields preserved
  assert.equal(updated.id, record.id);
  assert.equal(updated.concernSlugs, record.concernSlugs);
  assert.equal(updated.market, record.market);
  assert.equal(updated.recommendedProductSlugs, record.recommendedProductSlugs);
  assert.equal(updated.followUpAt, record.followUpAt);
});

test("recordConsultOutcome trims and truncates long notes", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["dry-dehydrated-skin"],
    market: "NG",
    recommendedProductSlugs: [],
    createdAt: "2026-07-27T10:00:00.000Z",
  });

  const longNote = "a".repeat(300);
  const updated = recordConsultOutcome(record, "love-it", longNote);

  assert.equal(updated.outcomeNote!.length, 280);
});

test("recordConsultOutcome with empty note sets outcomeNote to undefined", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["dry-dehydrated-skin"],
    market: "NG",
    recommendedProductSlugs: [],
    createdAt: "2026-07-27T10:00:00.000Z",
  });

  const updated = recordConsultOutcome(record, "unsure", "   ");

  assert.equal(updated.outcome, "unsure");
  assert.equal(updated.outcomeNote, undefined);
});

test("isOutcomeFollowUpDue returns true when no outcome and follow-up passed", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["acne-breakouts"],
    market: "NG",
    recommendedProductSlugs: [],
    createdAt: "2026-01-01T10:00:00.000Z",
  });

  assert.ok(isOutcomeFollowUpDue(record, new Date("2026-09-01T00:00:00.000Z")));
});

test("isOutcomeFollowUpDue returns false when outcome is recorded", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["acne-breakouts"],
    market: "NG",
    recommendedProductSlugs: [],
    createdAt: "2026-01-01T10:00:00.000Z",
  });
  const withOutcome = recordConsultOutcome(record, "helped");

  assert.equal(
    isOutcomeFollowUpDue(withOutcome, new Date("2026-09-01T00:00:00.000Z")),
    false,
  );
});

test("isOutcomeFollowUpDue returns false when follow-up has not passed", () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ["acne-breakouts"],
    market: "NG",
    recommendedProductSlugs: [],
    createdAt: "2026-08-01T10:00:00.000Z",
  });

  assert.equal(
    isOutcomeFollowUpDue(record, new Date("2026-08-10T00:00:00.000Z")),
    false,
  );
});

test("summarizeTimelineOutcomes counts outcomes correctly", () => {
  const base = {
    market: "NG" as const,
    recommendedProductSlugs: [],
    concernSlugs: ["acne-breakouts"],
  };
  const records = [
    createConsultTimelineRecord({
      ...base,
      createdAt: "2026-07-01T10:00:00.000Z",
    }),
    recordConsultOutcome(
      createConsultTimelineRecord({
        ...base,
        createdAt: "2026-07-02T10:00:00.000Z",
      }),
      "love-it",
    ),
    recordConsultOutcome(
      createConsultTimelineRecord({
        ...base,
        createdAt: "2026-07-03T10:00:00.000Z",
      }),
      "helped",
    ),
    recordConsultOutcome(
      createConsultTimelineRecord({
        ...base,
        createdAt: "2026-07-04T10:00:00.000Z",
      }),
      "didnt-help",
    ),
    recordConsultOutcome(
      createConsultTimelineRecord({
        ...base,
        createdAt: "2026-07-05T10:00:00.000Z",
      }),
      "unsure",
    ),
  ];

  const summary = summarizeTimelineOutcomes(records);

  assert.equal(summary.total, 5);
  assert.equal(summary.withOutcome, 4);
  assert.equal(summary.loveIt, 1);
  assert.equal(summary.helped, 1);
  assert.equal(summary.unsure, 1);
  assert.equal(summary.didntHelp, 1);
});
