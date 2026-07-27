'use server';

import { revalidatePath } from 'next/cache';
import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { assertCan } from '@/lib/moderation/capabilities';
import { decisionInputSchema, mapValueInputSchema } from '@/lib/moderation/action-input';
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

export async function fetchMoreContributionsAction(
  afterSubmittedAt: string,
  afterId: string,
  limit = 40,
) {
  await requireConsoleOperator();

  const parsedDate = new Date(afterSubmittedAt);
  if (!Number.isFinite(parsedDate.valueOf()) || !uuidPattern.test(afterId)) {
    throw new Error('Invalid contribution cursor.');
  }

  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 40;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
  const { listPendingContributions } = await import('@/lib/moderation/queues');
  const { contributionReviewItem } = await import(
    '@/lib/moderation/contribution-presentation'
  );
  const fetchedRows = await listPendingContributions(
    getPostgresClient(),
    safeLimit + 1,
    {
      submittedAt: afterSubmittedAt,
      id: afterId,
    },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const lastRow = rows.at(-1);

  return {
    items: rows.map(contributionReviewItem),
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow
      ? { submittedAt: lastRow.submittedAt, id: lastRow.id }
      : null,
  };
}

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

  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 40;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
  const { listPendingEdges } = await import('@/lib/moderation/queues');
  const { edgeReviewItem } = await import('@/lib/moderation/edge-presentation');
  const fetchedRows = await listPendingEdges(
    getPostgresClient(),
    safeLimit + 1,
    {
      createdAt: afterCreatedAt,
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

export async function fetchMoreObservationsAction(
  afterCreatedAt: string,
  afterId: string,
  limit = 40,
) {
  await requireConsoleOperator();

  const parsedDate = new Date(afterCreatedAt);
  if (!Number.isFinite(parsedDate.valueOf()) || !uuidPattern.test(afterId)) {
    throw new Error('Invalid observation cursor.');
  }

  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 40;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
  const { listPendingObservations } = await import('@/lib/moderation/queues');
  const { listCatalogueProducts } = await import('@/lib/catalogue/repository');
  const {
    observationProductSlug,
    observationReviewItem,
  } = await import('@/lib/moderation/observation-presentation');
  const fetchedRows = await listPendingObservations(
    getPostgresClient(),
    safeLimit + 1,
    {
      createdAt: afterCreatedAt,
      id: afterId,
    },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const catalogue = await listCatalogueProducts();
  const productsBySlug = new Map(catalogue.map(product => [product.slug, product]));
  const items = rows.map(row => {
    const slug = observationProductSlug(row);
    return observationReviewItem(row, slug ? productsBySlug.get(slug) : undefined);
  });
  const lastRow = rows.at(-1);

  return {
    items,
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow
      ? { createdAt: lastRow.createdAt, id: lastRow.id }
      : null,
  };
}

export async function fetchMoreVocabularyAction(
  afterActiveMentionCount: number,
  afterFirstSeenAt: string,
  afterId: string,
  limit = 40,
) {
  await requireConsoleOperator();

  const parsedDate = new Date(afterFirstSeenAt);
  if (
    !Number.isInteger(afterActiveMentionCount)
    || afterActiveMentionCount < 1
    || !Number.isFinite(parsedDate.valueOf())
    || !uuidPattern.test(afterId)
  ) {
    throw new Error('Invalid vocabulary cursor.');
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { listPendingModerationValues } = await import('@/lib/moderation/queues');
  const { vocabularyReviewItem } = await import('@/lib/moderation/vocabulary-presentation');
  const fetchedRows = await listPendingModerationValues(
    getPostgresClient(),
    safeLimit + 1,
    {
      activeMentionCount: afterActiveMentionCount,
      firstSeenAt: afterFirstSeenAt,
      id: afterId,
    },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const lastRow = rows.at(-1);

  return {
    items: rows.map(vocabularyReviewItem),
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow
      ? {
          activeMentionCount: lastRow.activeMentionCount,
          firstSeenAt: lastRow.firstSeenAt,
          id: lastRow.id,
        }
      : null,
  };
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
    assertCan(operator, 'vocabulary.map');

    const { targetId, canonicalEntityKind, canonicalEntityRef, rationale } = mapValueInputSchema.parse({
      targetId: formData.get('targetId'),
      canonicalEntityKind: formData.get('canonicalEntityKind'),
      canonicalEntityRef: formData.get('canonicalEntityRef'),
      rationale: (formData.get('rationale') as string | null)?.trim() || null,
    });

    const settled = await mapModerationValue(
      getPostgresClient(),
      operator.authSubject,
      targetId,
      canonicalEntityKind,
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
