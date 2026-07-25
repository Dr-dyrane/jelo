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

export async function decideObservationAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'observations.decide');
  const { targetId, decision, rationale } = parseDecision(formData);
  // decideObservation is idempotent: a null result means another operator already
  // decided this row, not a failure. The revalidate below drops the settled row.
  await decideObservation(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
  revalidatePath('/ops/observations');
  revalidatePath('/ops');
}

export async function decideModerationValueAction(formData: FormData) {
  const operator = await requireConsoleOperator();
  assertCan(operator, 'vocabulary.decide');
  const { targetId, decision, rationale } = parseDecision(formData);
  await decideModerationValue(getPostgresClient(), operator.authSubject, targetId, decision, rationale);
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
