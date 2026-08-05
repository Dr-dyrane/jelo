import type { CustomerPortalSavedRoutine } from './portal-model';

/**
 * Routine context for one product: all matching routines, not just the first.
 */
export type ProductRoutineContext = {
  /** Total number of routine steps referencing this product across all routines. */
  stepCount: number;
  /** Human-readable context label, e.g. "In Morning routine" or "In 2 routines". */
  label: string;
};

/**
 * Derive routine context for a product from all saved routines.
 * Counts every matching step across every routine — does not stop at the first.
 */
export function deriveRoutineContext(
  routines: readonly CustomerPortalSavedRoutine[],
  productSlug: string,
): ProductRoutineContext {
  const matchingSteps = routines.flatMap(routine =>
    routine.steps.filter(step => step.product?.slug === productSlug),
  );
  const stepCount = matchingSteps.length;
  if (stepCount === 0) return { stepCount: 0, label: 'Not in my Routine' };
  const matchingRoutines = routines.filter(routine =>
    routine.steps.some(step => step.product?.slug === productSlug),
  );
  if (matchingRoutines.length === 1) {
    return { stepCount, label: `In ${matchingRoutines[0].name}` };
  }
  return { stepCount, label: `In ${matchingRoutines.length} routines` };
}
