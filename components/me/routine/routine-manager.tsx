'use client';

import Link from 'next/link';
import { ClockPlus } from 'lucide-react';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { CustomerPortalSavedRoutine } from '@/lib/customer/portal-model';
import { RoutineCreateSheet, RoutineEditSheet } from './routine-sheet';
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
      {routines.length ? <div className={styles.routines}>
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
                <li className={step.product ? styles.productStep : styles.actionStep} key={step.id}>
                  <span className={styles.position}>{String(step.position).padStart(2, '0')}</span>
                  {step.product ? (
                    <Link
                      className={styles.stepImage}
                      href={`/me/product/${step.product.slug}?from=routine`}
                      aria-label={`View ${step.product.name}`}
                    >
                      <SafeProductImage
                        src={step.product.image}
                        alt={`${step.product.brand} ${step.product.name}`}
                      />
                    </Link>
                  ) : (
                    <span className={styles.actionStepIcon} aria-hidden="true">
                      <ClockPlus size={18} strokeWidth={1.6} />
                    </span>
                  )}
                  <span className={styles.stepCopy}>
                    <strong>{step.label}</strong>
                    {step.instruction ? <span>{step.instruction}</span> : null}
                    {step.product ? (
                      <Link href={`/me/product/${step.product.slug}?from=routine`}>
                        {step.product.brand} {step.product.name}
                      </Link>
                    ) : step.referenceState === 'product_request' ? (
                      <small>Pending review</small>
                    ) : step.referenceState === 'unresolved' ? (
                      <small>Product no longer available</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
            <div className={styles.controls}>
              <RoutineEditSheet routine={routine} />
            </div>
          </article>
        ))}
      </div> : (
        <div className={styles.emptyRoutine}>
          <ClockPlus size={24} strokeWidth={1.5} aria-hidden="true" />
          <strong>No routine yet.</strong>
          <span>Build a simple sequence you can return to.</span>
        </div>
      )}

      <RoutineCreateSheet />
    </div>
  );
}
