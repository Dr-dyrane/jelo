'use client';

import Link from 'next/link';
import type { CustomerPortalSavedRoutine } from '@/lib/customer/portal-model';
import { RoutineCreateSheet, RoutineEditSheet } from './routine-sheet';
import { RoutineDeleteDialog } from './routine-delete-dialog';
import styles from './routine-manager.module.css';

const OUTCOME_MESSAGE: Record<string, string> = {
  'routine-created': 'Routine created.',
  'routine-updated': 'Routine updated.',
  'routine-deleted': 'Routine deleted.',
  'routine-conflict': 'That routine changed. Refresh and try again.',
  'routine-error': 'Routine could not be changed. Try again.',
};

export function RoutineManager({
  routines,
  routineState,
  outcome,
}: {
  routines: readonly CustomerPortalSavedRoutine[];
  routineState: { status: 'ready' | 'unavailable'; message: string | null };
  outcome?: string;
}) {
  const feedback = outcome ? OUTCOME_MESSAGE[outcome] : null;
  if (routineState.status === 'unavailable') {
    return <p className={styles.feedback} role="status">{routineState.message}</p>;
  }

  return (
    <div className={styles.manager}>
      {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}
      <div className={styles.routines}>
        {routines.map(routine => (
          <article className={styles.routine} key={routine.id}>
            <header>
              <div>
                <small>{routine.origin === 'legacy_pages_v1_0' ? 'Reviewed legacy routine' : 'My routine'}</small>
                <h2>{routine.name}</h2>
              </div>
              <span>{routine.steps.length} {routine.steps.length === 1 ? 'step' : 'steps'}</span>
            </header>
            <ol>
              {routine.steps.map(step => (
                <li key={step.id}>
                  <span className={styles.position}>{String(step.position).padStart(2, '0')}</span>
                  <span className={styles.stepCopy}>
                    <strong>{step.label}</strong>
                    {step.instruction ? <span>{step.instruction}</span> : null}
                    {step.product ? (
                      <Link href={`/me/product/${step.product.slug}?from=routine`}>
                        {step.product.brand} {step.product.name}
                      </Link>
                    ) : step.referenceState === 'product_request' ? (
                      <small>Pending catalogue review</small>
                    ) : step.referenceState === 'unresolved' ? (
                      <small>Product reference kept as written</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
            <div className={styles.controls}>
              <RoutineEditSheet routine={routine} />
              <RoutineDeleteDialog routine={routine} />
            </div>
          </article>
        ))}
      </div>

      <RoutineCreateSheet />
    </div>
  );
}
