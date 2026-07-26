'use server';

import { revalidatePath } from 'next/cache';
import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { assertCan } from '@/lib/moderation/capabilities';
import { decisionInputSchema } from '@/lib/moderation/action-input';
import {
  decideContribution,
  decideEdge,
  decideModerationValue,
  mapModerationValue,
  decideObservation,
  decideRetailerApplication,
} from '@/lib/moderation/transitions';

function revalidateOpsSurfaces(queuePath: string) {
  revalidatePath(queuePath);
  revalidatePath('/ops');
  revalidatePath('/ops', 'layout');
  revalidatePath('/ops/activity');
  revalidatePath('/ops/signals');
}

function parseDecision(formData: FormData) {
  return decisionInputSchema.parse({
    targetId: formData.get('targetId'),
    decision: formData.get('decision'),
    rationale: (formData.get('rationale') as string | null)?.trim() || null,
  });
}

export type ActionResult =
  | { ok: true; targetId: string; decision: string }
  | { ok: false; targetId?: string; error: string };

export type ObservationActionResult = ActionResult;

function requestedTargetId(formData: FormData) {
  const value = formData.get('targetId');
  return typeof value === 'string' && value ? value : undefined;
}

function decisionFailure(task: string, targetId: string | undefined, error: unknown): ActionResult {
  console.error(`Could not save ${task} decision.`, error);
  return {
    ok: false,
    targetId,
    error: 'Couldn’t save this decision. Try again.',
  };
}

export async function decideContributionAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  const requestedId = requestedTargetId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'contributions.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideContribution(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/contributions');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return decisionFailure('contribution', requestedId, err);
  }
}

export async function decideEdgeAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  const requestedId = requestedTargetId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'edges.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideEdge(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/edges');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return decisionFailure('relationship', requestedId, err);
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function fetchMoreRelationshipsAction(
  afterCreatedAt: string,
  afterId: string,
  limit = 40,
) {
  await requireConsoleOperator();

  const parsedDate = new Date(afterCreatedAt);
  if (!Number.isFinite(parsedDate.valueOf()) || !uuidPattern.test(afterId)) {
    throw new Error('Invalid relationship cursor.');
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { listPendingEdges } = await import('@/lib/moderation/queues');
  const { edgeReviewItem } = await import('@/lib/moderation/edge-presentation');
  const fetchedRows = await listPendingEdges(
    getPostgresClient(),
    safeLimit + 1,
    {
      createdAt: parsedDate.toISOString(),
      id: afterId,
    },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const lastRow = rows.at(-1);

  return {
    items: rows.map(edgeReviewItem),
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow
      ? { createdAt: lastRow.createdAt, id: lastRow.id }
      : null,
  };
}

export async function decideObservationAction(_prevState: unknown, formData: FormData): Promise<ObservationActionResult> {
  const requestedId = requestedTargetId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'observations.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideObservation(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/observations');
    if (!settled) return { ok: false, targetId, error: 'This observation was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return decisionFailure('observation', requestedId, err);
  }
}

export async function fetchMoreObservationsAction(offset: number, limit = 50) {
  await requireConsoleOperator();
  const { listPendingObservations } = await import('@/lib/moderation/queues');
  const { findCatalogueProduct } = await import('@/lib/catalogue/repository');
  const rows = await listPendingObservations(getPostgresClient(), limit, offset);
  const enrichedRows = await Promise.all(rows.map(async row => {
    if (row.subjectKind === 'product') {
      const slug = row.subjectRef.startsWith('product:') ? row.subjectRef.slice(8) : row.subjectRef;
      const product = await findCatalogueProduct(slug);
      return { ...row, product };
    }
    return row;
  }));
  return enrichedRows;
}

export async function decideModerationValueAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  const requestedId = requestedTargetId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'vocabulary.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideModerationValue(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/vocabulary');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return decisionFailure('vocabulary', requestedId, err);
  }
}

export async function mapModerationValueAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  const requestedId = requestedTargetId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'vocabulary.decide');

    const targetId = formData.get('targetId') as string;
    const canonicalEntityKind = formData.get('canonicalEntityKind') as string;
    const canonicalEntityRef = formData.get('canonicalEntityRef') as string;
    const rationale = (formData.get('rationale') as string | null)?.trim() || null;

    if (!targetId || !canonicalEntityKind || !canonicalEntityRef) {
      return { ok: false, targetId, error: 'Choose what this value should become.' };
    }

    const settled = await mapModerationValue(
      getPostgresClient(),
      operator.authSubject,
      targetId,
      canonicalEntityKind as 'purpose' | 'product' | 'brand' | 'retailer',
      canonicalEntityRef,
      rationale,
    );
    revalidateOpsSurfaces('/ops/vocabulary');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision: 'map' };
  } catch (err) {
    return decisionFailure('vocabulary match', requestedId, err);
  }
}

export async function decideRetailerApplicationAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  const requestedId = requestedTargetId(formData);
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'retailers.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideRetailerApplication(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/retailers');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return decisionFailure('retailer application', requestedId, err);
  }
}
