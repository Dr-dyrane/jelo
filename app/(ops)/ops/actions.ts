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

export function revalidateOpsSurfaces(queuePath: string) {
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

async function runDecision(
  capability: Parameters<typeof assertCan>[1],
  queuePath: string,
  transition: (client: ReturnType<typeof getPostgresClient>, operatorSubject: string, targetId: string, decision: 'approve' | 'reject', rationale: string | null) => Promise<unknown>,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, capability);
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await transition(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOpsSurfaces(queuePath);
    if (!settled) return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    return { ok: true, targetId, decision };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' };
  }
}

export async function decideContributionAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  return runDecision('contributions.decide', '/ops/contributions', decideContribution, formData);
}

export async function decideEdgeAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  return runDecision('edges.decide', '/ops/edges', decideEdge, formData);
}

export type ObservationActionResult = ActionResult;

export async function decideObservationAction(_prevState: unknown, formData: FormData): Promise<ObservationActionResult> {
  return runDecision('observations.decide', '/ops/observations', decideObservation, formData);
}

export async function decideModerationValueAction(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  return runDecision('vocabulary.decide', '/ops/vocabulary', decideModerationValue, formData);
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
  return runDecision('retailers.decide', '/ops/retailers', decideRetailerApplication, formData);
}
