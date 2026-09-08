import { createHash } from "node:crypto";
import { z } from "zod";
import {
  reportHash,
  safeDraft,
  type XReviewItem,
  type XReviewReport,
} from "./report";

export type EditorialItem = {
  sourceId: string;
  text: string;
  status: "draft" | "approved" | "rejected" | "changes-requested";
  feedback: string | null;
  approvedHash: string | null;
  actor: string | null;
  updatedAt: string | null;
};
export type EditorialReview = {
  reportId: string;
  reportHash: string;
  version: number;
  items: EditorialItem[];
};
export type EditorialTransitionInput = {
  sourceId: string;
  expectedVersion: number;
  operation: "save" | "approve" | "reject" | "reopen" | "request-changes";
  text?: string;
  feedback?: string;
  copyHash?: string;
  checkedLive?: boolean;
};
export type EditorialErrorCode =
  | "x-review-editorial-invalid-input"
  | "x-review-editorial-invalid-state"
  | "x-review-editorial-report-mismatch"
  | "x-review-editorial-version-conflict"
  | "x-review-editorial-stale"
  | "x-review-editorial-source-missing"
  | "x-review-editorial-held"
  | "x-review-editorial-copy-invalid"
  | "x-review-editorial-copy-mismatch"
  | "x-review-editorial-live-check-required"
  | "x-review-editorial-feedback-required"
  | "x-review-editorial-store-unavailable";

export class EditorialReviewError extends Error {
  constructor(public readonly code: EditorialErrorCode) {
    super(code);
    this.name = "EditorialReviewError";
  }
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sourceId = z.string().regex(/^\d{1,25}$/);
const version = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1);
const copy = z.string().refine((text) => [...text].length <= 240);
const feedback = z.string().refine((text) => [...text].length <= 600);
const itemSchema = z
  .object({
    sourceId,
    text: copy,
    status: z.enum(["draft", "approved", "rejected", "changes-requested"]),
    feedback: feedback.nullable(),
    approvedHash: hash.nullable(),
    actor: z.string().min(1).max(254).nullable(),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();
export const editorialReviewSchema = z
  .object({
    reportId: z.string().regex(/^x-review-[0-9a-f-]{36}$/),
    reportHash: hash,
    version,
    items: z.array(itemSchema).max(5),
  })
  .strict()
  .refine(
    (review) =>
      new Set(review.items.map((item) => item.sourceId)).size ===
      review.items.length,
  );
const inputSchema = z
  .object({
    sourceId,
    expectedVersion: version,
    operation: z.enum([
      "save",
      "approve",
      "reject",
      "reopen",
      "request-changes",
    ]),
    text: copy.optional(),
    feedback: feedback.optional(),
    copyHash: hash.optional(),
    checkedLive: z.boolean().optional(),
  })
  .strict();

function held(item: XReviewItem) {
  return (
    !["answer promptly", "light banter", "buying intent"].includes(
      item.classification,
    ) ||
    item.source.hasMedia ||
    item.source.sensitive ||
    !item.source.parent
  );
}
function sourceFor(report: XReviewReport, id: string) {
  const matches = report.items.filter((item) => item.source.id === id);
  if (matches.length !== 1)
    throw new EditorialReviewError("x-review-editorial-source-missing");
  return matches[0];
}
function validCopy(text: string) {
  return [...text].length <= 240 && safeDraft(text);
}

export function initialEditorialReview(report: XReviewReport): EditorialReview {
  const review: EditorialReview = {
    reportId: report.id,
    reportHash: reportHash(report),
    version: 0,
    items: report.items.map((item) => ({
      sourceId: item.source.id,
      text:
        !held(item) && item.draft && validCopy(item.draft) ? item.draft : "",
      status: "draft",
      feedback: null,
      approvedHash: null,
      actor: null,
      updatedAt: null,
    })),
  };
  if (!editorialReviewSchema.safeParse(review).success)
    throw new EditorialReviewError("x-review-editorial-invalid-state");
  return review;
}

/** This approval is bound to one exact text-only copy and the immutable source. */
export function editorialCopyHash(report: XReviewReport, item: EditorialItem) {
  const source = sourceFor(report, item.sourceId).source;
  return createHash("sha256")
    .update(
      JSON.stringify({
        reportHash: reportHash(report),
        source,
        parent: source.parent,
        sourceId: item.sourceId,
        text: item.text,
        media: "none",
      }),
    )
    .digest("hex");
}

export function transitionEditorialReview(
  report: XReviewReport,
  current: EditorialReview,
  input: EditorialTransitionInput,
  actor: string,
  now: Date,
): EditorialReview {
  if (
    !inputSchema.safeParse(input).success ||
    typeof actor !== "string" ||
    !actor.trim() ||
    actor.length > 254 ||
    /[\r\n\0]/.test(actor)
  ) {
    throw new EditorialReviewError("x-review-editorial-invalid-input");
  }
  if (!editorialReviewSchema.safeParse(current).success)
    throw new EditorialReviewError("x-review-editorial-invalid-state");
  if (
    current.reportId !== report.id ||
    current.reportHash !== reportHash(report)
  )
    throw new EditorialReviewError("x-review-editorial-report-mismatch");
  if (current.version !== input.expectedVersion)
    throw new EditorialReviewError("x-review-editorial-version-conflict");
  const checked = Date.parse(report.checkedAt);
  const age = now instanceof Date ? now.valueOf() - checked : NaN;
  if (!Number.isFinite(age) || age < 0 || age > 3_600_000)
    throw new EditorialReviewError("x-review-editorial-stale");
  if (
    current.items.length !== report.items.length ||
    current.items.some(
      (item) =>
        !report.items.some((source) => source.source.id === item.sourceId),
    )
  ) {
    throw new EditorialReviewError("x-review-editorial-invalid-state");
  }
  const source = sourceFor(report, input.sourceId);
  const item = current.items.find(
    (candidate) => candidate.sourceId === input.sourceId,
  );
  if (!item)
    throw new EditorialReviewError("x-review-editorial-source-missing");
  if (held(source) && !["reject", "reopen"].includes(input.operation))
    throw new EditorialReviewError("x-review-editorial-held");
  const next: EditorialItem = {
    ...item,
    actor,
    updatedAt: now.toISOString(),
    approvedHash: null,
  };
  switch (input.operation) {
    case "save":
      if (item.status !== "draft" && item.status !== "changes-requested")
        throw new EditorialReviewError("x-review-editorial-invalid-state");
      if (input.text === undefined || !validCopy(input.text))
        throw new EditorialReviewError("x-review-editorial-copy-invalid");
      next.text = input.text;
      next.status = "draft";
      break;
    case "approve":
      if (item.status !== "draft")
        throw new EditorialReviewError("x-review-editorial-invalid-state");
      if (!validCopy(item.text))
        throw new EditorialReviewError("x-review-editorial-copy-invalid");
      if (
        (input.text !== undefined && input.text !== item.text) ||
        input.copyHash !== editorialCopyHash(report, item)
      )
        throw new EditorialReviewError("x-review-editorial-copy-mismatch");
      if (input.checkedLive !== true)
        throw new EditorialReviewError(
          "x-review-editorial-live-check-required",
        );
      next.status = "approved";
      next.approvedHash = input.copyHash;
      break;
    case "reject":
      if (item.status === "rejected")
        throw new EditorialReviewError("x-review-editorial-invalid-state");
      next.status = "rejected";
      if (input.feedback !== undefined) next.feedback = input.feedback;
      break;
    case "reopen":
      if (item.status === "draft")
        throw new EditorialReviewError("x-review-editorial-invalid-state");
      next.status = "draft";
      break;
    case "request-changes":
      if (
        item.status !== "draft" &&
        item.status !== "approved" &&
        item.status !== "changes-requested"
      )
        throw new EditorialReviewError("x-review-editorial-invalid-state");
      if (!input.feedback?.trim())
        throw new EditorialReviewError("x-review-editorial-feedback-required");
      next.status = "changes-requested";
      next.feedback = input.feedback;
      break;
  }
  return {
    ...current,
    version: current.version + 1,
    items: current.items.map((candidate) =>
      candidate.sourceId === item.sourceId ? next : { ...candidate },
    ),
  };
}
