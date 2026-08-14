import { z } from "zod";

const conciseText = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(z.string().min(1).max(120));

export const contributionKindSchema = z.enum(["product", "routine", "store"]);
export type ContributionKind = z.infer<typeof contributionKindSchema>;

export const adaptiveValueSchema = z
  .object({
    id: conciseText,
    label: conciseText,
    source: z.enum(["canonical", "custom"]),
  })
  .strict();
export type AdaptiveValue = z.infer<typeof adaptiveValueSchema>;

const purchaseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.valueOf()) && parsed <= new Date();
  }, "Purchase date cannot be in the future.");

export const contributionDraftSchema = z
  .object({
    kind: contributionKindSchema,
    purposes: z.array(adaptiveValueSchema).max(8).default([]),
    products: z.array(adaptiveValueSchema).max(20).default([]),
    brands: z.array(adaptiveValueSchema).max(4).default([]),
    retailers: z.array(adaptiveValueSchema).max(6).default([]),
    priceNgn: z.number().min(100).max(10_000_000).nullable().default(null),
    purchaseDate: purchaseDateSchema.nullable().default(null),
    outcome: z
      .enum(["love-it", "helped", "unsure", "didnt-help"])
      .nullable()
      .default(null),
    currentStep: z.number().int().min(1).max(9),
  })
  .strict();
export type ContributionDraft = z.infer<typeof contributionDraftSchema>;

export const finalContributionSchema = contributionDraftSchema.superRefine(
  (draft, context) => {
    if (!draft.purposes.length)
      context.addIssue({
        code: "custom",
        path: ["purposes"],
        message: "Choose at least one use.",
      });
    if (draft.kind === "product") {
      if (draft.products.length !== 1)
        context.addIssue({
          code: "custom",
          path: ["products"],
          message: "Choose one product.",
        });
      if (!draft.brands.length)
        context.addIssue({
          code: "custom",
          path: ["brands"],
          message: "Choose a brand.",
        });
      if (!draft.retailers.length)
        context.addIssue({
          code: "custom",
          path: ["retailers"],
          message: "Choose a store.",
        });
      if (!draft.outcome)
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "Share how it went.",
        });
    }
    if (draft.kind === "routine") {
      if (!draft.products.length)
        context.addIssue({
          code: "custom",
          path: ["products"],
          message: "Add at least one product.",
        });
      if (!draft.outcome)
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "Share how it went.",
        });
    }
    if (draft.kind === "store" && !draft.retailers.length) {
      context.addIssue({
        code: "custom",
        path: ["retailers"],
        message: "Choose a store.",
      });
    }
  },
);

export const intakeEventSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["step_viewed", "selection_changed", "draft_restored"]),
    step: z.number().int().min(1).max(9),
    inputMode: z.enum(["tap", "search", "type", "custom"]).nullable(),
    resultsCount: z.number().int().min(0).max(100).nullable(),
  })
  .strict();
export type IntakeEvent = z.infer<typeof intakeEventSchema>;

// The single source of shape for a first-class community observation (ADR 0005).
// Strict, enums and bounded ints only, so no free text or PII can enter by construction.
export const communityObservationSchema = z
  .object({
    observationKind: z.enum(["price", "outcome"]),
    subjectKind: z.enum(["product", "anonymous_contribution"]),
    subjectRef: z.string().min(1).max(160),
    amountNgn: z.number().min(100).max(10_000_000).nullable(),
    outcome: z.enum(["love-it", "helped", "unsure", "didnt-help"]).nullable(),
    observedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict()
  .refine(
    (observation) =>
      observation.observationKind === "price"
        ? observation.amountNgn != null && observation.outcome == null
        : observation.outcome != null && observation.amountNgn == null,
    "A price observation carries an amount; an outcome observation carries an outcome.",
  );
export type CommunityObservation = z.infer<typeof communityObservationSchema>;

export const saveDraftRequestSchema = z
  .object({
    revision: z.number().int().min(0),
    draft: contributionDraftSchema,
    events: z.array(intakeEventSchema).max(50).default([]),
    website: z.string().max(0).optional(),
  })
  .strict();

export const createDraftRequestSchema = z
  .object({
    kind: contributionKindSchema,
    website: z.string().max(0).optional(),
  })
  .strict();

export function emptyContributionDraft(
  kind: ContributionKind = "product",
): ContributionDraft {
  return {
    kind,
    purposes: [],
    products: [],
    brands: [],
    retailers: [],
    priceNgn: null,
    purchaseDate: null,
    outcome: null,
    currentStep: 1,
  };
}

export function normalizeCommunityValue(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-NG");
}
