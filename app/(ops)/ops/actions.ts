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

export async function decideContributionAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'contributions.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideContribution(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/contributions');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}

export async function decideEdgeAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'edges.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideEdge(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/edges');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}

export async function decideObservationAction(_prevState: unknown, formData: FormData): Promise<ObservationActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'observations.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideObservation(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/observations');
    if (!settled) return { ok: false, targetId, error: 'This observation was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}

export async function decideModerationValueAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'vocabulary.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideModerationValue(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/vocabulary');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}

export async function mapModerationValueAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'vocabulary.decide');

    const targetId = formData.get('targetId') as string;
    const canonicalEntityKind = formData.get('canonicalEntityKind') as string;
    const canonicalEntityRef = formData.get('canonicalEntityRef') as string;
    const rationale = (formData.get('rationale') as string | null)?.trim() || null;

    if (!targetId || !canonicalEntityKind || !canonicalEntityRef) {
      return { ok: false, targetId, error: 'Missing required mapping parameters.' };
    }

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
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}

export async function decideRetailerApplicationAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'retailers.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideRetailerApplication(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces('/ops/retailers');
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}
