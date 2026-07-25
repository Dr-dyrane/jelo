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

function revalidateOps(...queuePaths: string[]) {
  for (const path of queuePaths) revalidatePath(path);
  revalidatePath('/ops');
  revalidatePath('/ops', 'layout');
  revalidatePath('/ops/activity');
  revalidatePath('/ops/signals');
}

// Every action re-runs the guard (it never trusts the page that rendered the form),
// authorizes the specific capability for the operator's role, and uses the
// operator's own resolved subject — never a value from the client.
function parseDecision(formData: FormData) {
  return decisionInputSchema.parse({
    targetId: formData.get('targetId'),
    decision: formData.get('decision'),
    rationale: (formData.get('rationale') as string | null)?.trim() || null,
  });
}

export async function decideContributionAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'contributions.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideContribution(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOps('/ops/contributions');
    if (!settled) {
      return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}

export async function decideEdgeAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'edges.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideEdge(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOps('/ops/edges');
    if (!settled) {
      return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}

export type ActionResult =
  | { ok: true; targetId: string; decision: string }
  | { ok: false; targetId?: string; error: string };

export type ObservationActionResult =
  | { ok: true; targetId: string; decision: string }
  | { ok: false; targetId?: string; error: string };

export async function decideObservationAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ObservationActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'observations.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    // decideObservation is idempotent: a null result means another operator already
    // decided this row, not a failure. Revalidation removes the settled row and
    // refreshes the shared sidebar, activity feed, and signals surfaces.
    const settled = await decideObservation(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOps('/ops/observations');
    if (!settled) {
      return { ok: false, targetId, error: 'This observation was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}

export async function decideModerationValueAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'vocabulary.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideModerationValue(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOps('/ops/vocabulary');
    if (!settled) {
      return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}

export async function mapModerationValueAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
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

    const settled = await mapModerationValue(getPostgresClient(), operator.authSubject, targetId, canonicalEntityKind, canonicalEntityRef, rationale);
    revalidateOps('/ops/vocabulary');
    if (!settled) {
      return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision: 'MAP' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}

export async function decideRetailerApplicationAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'retailers.decide');
    const { targetId, decision, rationale } = parseDecision(formData);
    const settled = await decideRetailerApplication(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidateOps('/ops/retailers');
    if (!settled) {
      return { ok: false, targetId, error: 'This item was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}
