'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { assertCan } from '@/lib/moderation/capabilities';
import { recordNote } from '@/lib/moderation/transitions';
import { resolveCommunityProductResearchTask } from '@/lib/community-intake/research-resolution';
import { resolveCommunityRetailerResearchTask } from '@/lib/community-intake/retailer-research-resolution';

export type ResearchActionResult =
  | { ok: true; targetId: string; action: string; terminal: boolean }
  | { ok: false; targetId?: string; error: string };

const assignmentSchema = z.object({
  targetId: z.uuid(),
  action: z.enum(['claim', 'defer']),
  rationale: z.string().trim().min(1).max(2000),
});

const resolutionSchema = z.object({
  targetId: z.uuid(),
  entityKind: z.enum(['product', 'retailer']),
  outcome: z.enum([
    'existing-canonical-product',
    'deliberate-intake-candidate',
    'ambiguous-family',
    'bundle',
    'dismissed-duplicate',
    'existing-canonical-retailer',
    'ambiguous-retailer',
  ]),
  targetRef: z.string().trim().max(160).optional(),
  rationale: z.string().trim().min(1).max(2000),
});

function revalidateResearch() {
  revalidatePath('/ops/research');
  revalidatePath('/ops');
  revalidatePath('/ops', 'layout');
  revalidatePath('/ops/activity');
}

function requestedId(formData: FormData) {
  const value = formData.get('targetId');
  return typeof value === 'string' && value ? value : undefined;
}

function failure(targetId: string | undefined, error: unknown): ResearchActionResult {
  console.error('Could not save research work.', error);
  return { ok: false, targetId, error: 'Couldn’t save this research decision. Try again.' };
}

export async function assignResearchTaskAction(
  _previous: unknown,
  formData: FormData,
): Promise<ResearchActionResult> {
  const targetId = requestedId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'research.manage');
    const input = assignmentSchema.parse({
      targetId,
      action: formData.get('action'),
      rationale: formData.get('rationale'),
    });
    await recordNote(
      getPostgresClient(),
      'community_research_task',
      operator.authSubject,
      input.targetId,
      input.rationale,
      input.action,
    );
    revalidateResearch();
    return { ok: true, targetId: input.targetId, action: input.action, terminal: false };
  } catch (error) {
    return failure(targetId, error);
  }
}

export async function resolveResearchTaskAction(
  _previous: unknown,
  formData: FormData,
): Promise<ResearchActionResult> {
  const targetId = requestedId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'research.manage');
    const input = resolutionSchema.parse({
      targetId,
      entityKind: formData.get('entityKind'),
      outcome: formData.get('outcome'),
      targetRef: (formData.get('targetRef') as string | null)?.trim() || undefined,
      rationale: formData.get('rationale'),
    });
    const common = {
      taskId: input.targetId,
      reviewedBy: operator.authSubject,
      rationale: input.rationale,
      auditMetadata: { source: 'ops-research-console' },
    };
    const exactTarget = () => {
      if (!input.targetRef) throw new Error('This outcome requires an exact target.');
      return input.targetRef;
    };

    if (input.entityKind === 'product') {
      const resolution = input.outcome === 'existing-canonical-product'
        ? { ...common, outcome: input.outcome, canonicalSlug: exactTarget() }
        : input.outcome === 'deliberate-intake-candidate'
          ? { ...common, outcome: input.outcome, candidateId: exactTarget() }
          : input.outcome === 'ambiguous-family' || input.outcome === 'bundle'
            ? { ...common, outcome: input.outcome }
            : input.outcome === 'dismissed-duplicate'
              ? { ...common, outcome: input.outcome }
              : null;
      if (!resolution) throw new Error('The selected outcome does not apply to product research.');
      await resolveCommunityProductResearchTask(getPostgresClient(), resolution);
    } else {
      const resolution = input.outcome === 'existing-canonical-retailer'
        ? { ...common, outcome: input.outcome, canonicalSlug: exactTarget() }
        : input.outcome === 'ambiguous-retailer' || input.outcome === 'dismissed-duplicate'
          ? { ...common, outcome: input.outcome }
          : null;
      if (!resolution) throw new Error('The selected outcome does not apply to retailer research.');
      await resolveCommunityRetailerResearchTask(getPostgresClient(), resolution);
    }

    revalidateResearch();
    return { ok: true, targetId: input.targetId, action: input.outcome, terminal: true };
  } catch (error) {
    return failure(targetId, error);
  }
}
