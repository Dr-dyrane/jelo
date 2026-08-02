'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { assertCan } from '@/lib/moderation/capabilities';
import { updateResearchAssignment } from '@/lib/moderation/transitions';
import { resolveCommunityProductResearchTask } from '@/lib/community-intake/research-resolution';
import { resolveCommunityRetailerResearchTask } from '@/lib/community-intake/retailer-research-resolution';

export type ResearchActionResult =
  | { ok: true; requestId: string; targetId: string; action: string; terminal: boolean }
  | { ok: false; requestId?: string; targetId?: string; action?: string; error: string };

const assignmentSchema = z.object({
  requestId: z.uuid(),
  targetId: z.uuid(),
  action: z.enum(['claim', 'defer', 'retry', 'takeover', 'assign', 'unassign']),
  targetOperatorId: z.uuid().optional(),
  rationale: z.string().trim().min(1).max(2000),
});

const resolutionSchema = z.object({
  requestId: z.uuid(),
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

function failure(
  requestId: string | undefined,
  targetId: string | undefined,
  action: string | undefined,
  error: unknown,
): ResearchActionResult {
  console.error('Could not save research work.', error);
  return {
    ok: false,
    requestId,
    targetId,
    action,
    error: 'Couldn’t save this research decision. Try again.',
  };
}

export async function assignResearchTaskAction(
  _previous: unknown,
  formData: FormData,
): Promise<ResearchActionResult> {
  const targetId = requestedId(formData);
  const requestId = formData.get('requestId')?.toString();
  const requestedAction = formData.get('action')?.toString();
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'research.manage');
    const input = assignmentSchema.parse({
      requestId,
      targetId,
      action: formData.get('action'),
      targetOperatorId: (formData.get('targetOperatorId') as string | null) || undefined,
      rationale: formData.get('rationale'),
    });
    const administrativeAssignment = input.action === 'assign'
      || input.action === 'unassign'
      || input.action === 'takeover';
    assertCan(operator, administrativeAssignment ? 'research.assign' : 'research.manage');
    await updateResearchAssignment(
      getPostgresClient(),
      operator.authSubject,
      input.targetId,
      input.action === 'takeover' ? 'claim' : input.action,
      input.rationale,
      {
        allowResearchTakeover: input.action === 'takeover',
        targetOperatorId: input.targetOperatorId,
      },
    );
    revalidateResearch();
    return {
      ok: true,
      requestId: input.requestId,
      targetId: input.targetId,
      action: input.action,
      terminal: false,
    };
  } catch (error) {
    return failure(requestId, targetId, requestedAction, error);
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function fetchMoreResearchTasksAction(
  workRank: number,
  signalCount: number,
  firstSeenAt: string,
  id: string,
  limit = 40,
) {
  const operator = await requireConsoleOperator();
  const parsedDate = new Date(firstSeenAt);
  if (
    !Number.isInteger(workRank)
    || workRank < 0
    || workRank > 3
    || !Number.isInteger(signalCount)
    || signalCount < 0
    || !Number.isFinite(parsedDate.valueOf())
    || !uuidPattern.test(id)
  ) throw new Error('Invalid research cursor.');

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { listPendingResearchTasks } = await import('@/lib/moderation/research-tasks');
  const fetchedRows = await listPendingResearchTasks(
    getPostgresClient(),
    operator.id,
    safeLimit + 1,
    { workRank, signalCount, firstSeenAt, id },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const lastRow = rows.at(-1);
  return {
    items: rows,
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow ? {
      workRank: lastRow.workRank,
      signalCount: lastRow.signalCount,
      firstSeenAt: lastRow.firstSeenAt,
      id: lastRow.id,
    } : null,
  };
}

export async function resolveResearchTaskAction(
  _previous: unknown,
  formData: FormData,
): Promise<ResearchActionResult> {
  const targetId = requestedId(formData);
  const requestId = formData.get('requestId')?.toString();
  const requestedAction = formData.get('outcome')?.toString();
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'research.manage');
    const input = resolutionSchema.parse({
      requestId,
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
    return {
      ok: true,
      requestId: input.requestId,
      targetId: input.targetId,
      action: input.outcome,
      terminal: true,
    };
  } catch (error) {
    return failure(requestId, targetId, requestedAction, error);
  }
}
