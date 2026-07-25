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

export async function decideContributionAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'contributions.decide');
  const { targetId, decision, rationale } = parseDecision(formData);
  await decideContribution(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
  revalidatePath('/ops/contributions');
  revalidatePath('/ops');
}

export async function decideEdgeAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'edges.decide');
  const { targetId, decision, rationale } = parseDecision(formData);
  await decideEdge(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
  revalidatePath('/ops/edges');
  revalidatePath('/ops');
}

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
    // decided this row, not a failure. The revalidate below drops the settled row.
    const settled = await decideObservation(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
    revalidatePath('/ops/observations');
    revalidatePath('/ops');
    if (!settled) {
      return { ok: false, targetId, error: 'This observation was already reviewed by another operator.' };
    }
    return { ok: true, targetId, decision };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { ok: false, error: message };
  }
}

export async function decideModerationValueAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'vocabulary.decide');
  const { targetId, decision, rationale } = parseDecision(formData);
  await decideModerationValue(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
  revalidatePath('/ops/vocabulary');
  revalidatePath('/ops');
}

export async function mapModerationValueAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'vocabulary.decide');

  const targetId = formData.get('targetId') as string;
  const canonicalEntityKind = formData.get('canonicalEntityKind') as string;
  const canonicalEntityRef = formData.get('canonicalEntityRef') as string;
  const rationale = (formData.get('rationale') as string | null)?.trim() || null;

  if (!targetId || !canonicalEntityKind || !canonicalEntityRef) {
    throw new Error('Missing required mapping parameters.');
  }

  await mapModerationValue(getPostgresClient(), operator.authSubject, targetId, canonicalEntityKind, canonicalEntityRef, rationale);
  revalidatePath('/ops/vocabulary');
  revalidatePath('/ops');
}

export async function decideRetailerApplicationAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'retailers.decide');
  const { targetId, decision, rationale } = parseDecision(formData);
  await decideRetailerApplication(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
  revalidatePath('/ops/retailers');
  revalidatePath('/ops');
}
