import { z } from "zod";

// The queues the moderation console triages (ADR 0007). Read models for the
// community and retailer intake pipelines plus the measurement-only commerce view.
export const moderationQueueSchema = z.enum([
  "community_contribution",
  "community_edge",
  "community_observation",
  "community_moderation_value",
  "community_research_task",
  "retailer_application",
  "market_finder_report",
  "retailer_location",
  "physical_product_observation",
  "commerce_signal",
]);
export type ModerationQueue = z.infer<typeof moderationQueueSchema>;

export const marketFinderReportOutcomeSchema = z.enum([
  "found_bought",
  "shop_exists_no_stock",
  "location_wrong",
  "shop_closed",
]);
export type MarketFinderReportOutcome = z.infer<
  typeof marketFinderReportOutcomeSchema
>;

export const marketFinderReportDecisionInputSchema = z
  .object({
    contributionId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    rationale: z.string().trim().min(1).max(2000),
  })
  .strict();
export type MarketFinderReportDecisionInput = z.infer<
  typeof marketFinderReportDecisionInputSchema
>;

export const physicalAvailabilitySchema = z.enum([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "unknown",
  "not_carried",
]);
export type PhysicalAvailability = z.infer<typeof physicalAvailabilitySchema>;

export const physicalEvidenceSourceMethodSchema = z.enum([
  "field_visit",
  "retailer_confirmation",
  "branch_online_record",
  "partnership_application",
  "community_report",
  "online_listing",
  "map_result",
  "social_profile",
  "search_result",
  "old_receipt",
]);
export type PhysicalEvidenceSourceMethod = z.infer<
  typeof physicalEvidenceSourceMethodSchema
>;

const evidenceWindowDays: Record<PhysicalEvidenceSourceMethod, number> = {
  field_visit: 14,
  retailer_confirmation: 7,
  branch_online_record: 3,
  community_report: 3,
  partnership_application: 30,
  online_listing: 30,
  map_result: 30,
  social_profile: 30,
  search_result: 30,
  old_receipt: 30,
};

// A physical observation is authored from explicit evidence, not inferred from
// the Market Finder outcome. The database repeats these limits as the final
// authority; this schema keeps every server caller on the same strict contract.
export const physicalProductEvidenceInputSchema = z
  .object({
    contributionId: z.uuid(),
    availability: physicalAvailabilitySchema,
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    sourceMethod: physicalEvidenceSourceMethodSchema,
    sourceReference: z.string().trim().min(1).max(500),
    observedTitle: z.string().trim().min(1).max(240),
    observedSize: z.string().trim().min(1).max(80),
    priceNgn: z
      .number()
      .positive()
      .max(9_999_999_999.99)
      .multipleOf(0.01)
      .nullable(),
    rationale: z.string().trim().min(1).max(2000),
  })
  .strict()
  .superRefine((input, context) => {
    const observedAt = Date.parse(input.observedAt);
    const expiresAt = Date.parse(input.expiresAt);
    if (expiresAt <= observedAt) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must be later than the observation time.",
      });
      return;
    }

    const maximumExpiry =
      observedAt + evidenceWindowDays[input.sourceMethod] * 86_400_000;
    if (expiresAt > maximumExpiry) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry exceeds the allowed evidence window for this source.",
      });
    }
  });
export type PhysicalProductEvidenceInput = z.infer<
  typeof physicalProductEvidenceInputSchema
>;

export const physicalProductObservationDecisionInputSchema = z
  .object({
    observationId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    rationale: z.string().trim().min(1).max(2000),
  })
  .strict();
export type PhysicalProductObservationDecisionInput = z.infer<
  typeof physicalProductObservationDecisionInputSchema
>;

// The single source of shape for a consequential operator action. Strict, so an
// unknown field or action is rejected rather than silently audited. `rationale` is
// an operator-authored note, never contributor content.
export const moderationActionSchema = z
  .object({
    operatorSubject: z.string().min(1).max(320),
    queue: moderationQueueSchema,
    action: z.enum([
      "claim",
      "assign",
      "unassign",
      "approve",
      "reject",
      "map",
      "promote",
      "reconcile",
      "defer",
      "retry",
      "note",
    ]),
    targetRef: z.string().min(1).max(200),
    canonicalWrite: z.boolean().default(false),
    rationale: z.string().min(1).max(2000).nullable().default(null),
    metadata: z
      .record(
        z.string().min(1).max(80),
        z.union([
          z.string().max(500),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .default({}),
  })
  .strict();
export type ModerationAction = z.infer<typeof moderationActionSchema>;

export type ModerationAuditRow = {
  operatorSubject: string;
  queue: ModerationAction["queue"];
  action: ModerationAction["action"];
  targetRef: string;
  canonicalWrite: boolean;
  rationale: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

// Validates and normalizes an operator action into the row to append. Pure and
// testable; kept out of the server-only writer so the strict shape can be tested
// directly. The schema is the single source of shape.
export function buildModerationAuditRow(
  input: ModerationAction,
): ModerationAuditRow {
  const parsed = moderationActionSchema.parse(input);
  return {
    operatorSubject: parsed.operatorSubject,
    queue: parsed.queue,
    action: parsed.action,
    targetRef: parsed.targetRef,
    canonicalWrite: parsed.canonicalWrite,
    rationale: parsed.rationale,
    metadata: parsed.metadata,
  };
}
