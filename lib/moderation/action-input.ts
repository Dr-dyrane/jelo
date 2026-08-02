import { z } from 'zod';

// Input shapes for console/agent actions. Strict and pure (no SQL), so routes and
// server actions stay thin and every action's payload is validated before it
// reaches a gated writer. targetId is always a row uuid; rationale is the operator's
// own note, never contributor content.

export const decisionInputSchema = z.object({
  targetId: z.uuid(),
  decision: z.enum(['approve', 'reject']),
  rationale: z.string().min(1).max(2000).nullable().default(null),
}).strict();
export type DecisionInput = z.infer<typeof decisionInputSchema>;

export const observationCorrectionInputSchema = z.object({
  targetId: z.uuid(),
  submissionId: z.uuid(),
  disposition: z.literal('defer'),
  rationale: z.string().trim().min(1).max(2000),
}).strict();
export type ObservationCorrectionInput = z.infer<typeof observationCorrectionInputSchema>;

export const mapValueInputSchema = z.object({
  targetId: z.uuid(),
  canonicalEntityKind: z.enum(['purpose', 'product', 'brand', 'retailer']),
  canonicalEntityRef: z.string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use the exact canonical slug.'),
  rationale: z.string().min(1).max(2000).nullable().default(null),
}).strict();
export type MapValueInput = z.infer<typeof mapValueInputSchema>;

export const noteInputSchema = z.object({
  targetId: z.uuid(),
  action: z.enum(['note', 'defer', 'claim', 'retry']).default('note'),
  rationale: z.string().min(1).max(2000),
}).strict();
export type NoteInput = z.infer<typeof noteInputSchema>;
