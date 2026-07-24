import { z } from 'zod';

// The queues the moderation console triages (ADR 0007). Read models for the
// community and retailer intake pipelines plus the measurement-only commerce view.
export const moderationQueueSchema = z.enum([
  'community_contribution',
  'community_edge',
  'community_observation',
  'community_moderation_value',
  'retailer_application',
  'commerce_signal',
]);
export type ModerationQueue = z.infer<typeof moderationQueueSchema>;

// The single source of shape for a consequential operator action. Strict, so an
// unknown field or action is rejected rather than silently audited. `rationale` is
// an operator-authored note, never contributor content.
export const moderationActionSchema = z.object({
  operatorSubject: z.string().min(1).max(320),
  queue: moderationQueueSchema,
  action: z.enum(['claim', 'approve', 'reject', 'promote', 'defer', 'note']),
  targetRef: z.string().min(1).max(200),
  canonicalWrite: z.boolean().default(false),
  rationale: z.string().min(1).max(2000).nullable().default(null),
}).strict();
export type ModerationAction = z.infer<typeof moderationActionSchema>;

export type ModerationAuditRow = {
  operatorSubject: string;
  queue: ModerationAction['queue'];
  action: ModerationAction['action'];
  targetRef: string;
  canonicalWrite: boolean;
  rationale: string | null;
};

// Validates and normalizes an operator action into the row to append. Pure and
// testable; kept out of the server-only writer so the strict shape can be tested
// directly. The schema is the single source of shape.
export function buildModerationAuditRow(input: ModerationAction): ModerationAuditRow {
  const parsed = moderationActionSchema.parse(input);
  return {
    operatorSubject: parsed.operatorSubject,
    queue: parsed.queue,
    action: parsed.action,
    targetRef: parsed.targetRef,
    canonicalWrite: parsed.canonicalWrite,
    rationale: parsed.rationale,
  };
}
