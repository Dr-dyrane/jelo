import type { CustomerPortalSavedRoutine } from './portal-model';

/**
 * Routine context for one product with explicit authority states.
 *
 * - `ready`: the routine service succeeded. Includes structured count, step count, and names.
 * - `unavailable`: the routine service failed. Must not be converted to "Not in my Routine."
 */
export type ProductRoutineContext =
  | {
      state: 'ready';
      /** Total number of routine steps referencing this product across all routines. */
      stepCount: number;
      /** Number of distinct routines referencing this product. */
      routineCount: number;
      /** Names of routines referencing this product. */
      routineNames: string[];
      /** Human-readable context label. */
      label: string;
    }
  | {
      state: 'unavailable';
      /** Human-readable context label. */
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
  const matchingRoutines = routines.filter(routine =>
    routine.steps.some(step => step.product?.slug === productSlug),
  );
  const matchingSteps = matchingRoutines.flatMap(routine =>
    routine.steps.filter(step => step.product?.slug === productSlug),
  );
  const stepCount = matchingSteps.length;
  if (stepCount === 0) {
    return {
      state: 'ready',
      stepCount: 0,
      routineCount: 0,
      routineNames: [],
      label: 'Not in my Routine',
    };
  }
  const routineNames = matchingRoutines.map(r => r.name);
  if (matchingRoutines.length === 1) {
    const routineName = matchingRoutines[0].name;
    // Append "routine" only when the saved name does not already contain it.
    // "Morning" becomes "In Morning routine"; "Evening routine" stays as-is.
    const hasRoutineNoun = /\broutine\b/i.test(routineName);
    return {
      state: 'ready',
      stepCount,
      routineCount: 1,
      routineNames,
      label: hasRoutineNoun ? `In ${routineName}` : `In ${routineName} routine`,
    };
  }
  return {
    state: 'ready',
    stepCount,
    routineCount: matchingRoutines.length,
    routineNames,
    label: `In ${matchingRoutines.length} routines`,
  };
}

/**
 * Create an unavailable routine context.
 */
export function unavailableRoutineContext(): ProductRoutineContext {
  return { state: 'unavailable', label: 'Routine unavailable' };
}
