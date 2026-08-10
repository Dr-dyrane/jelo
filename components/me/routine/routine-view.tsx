'use client';

import { RoutineManager } from '@/components/me/routine/routine-manager';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import type { CustomerRoutineReadModel } from '@/lib/customer/route-read-models';
import styles from '../home/me-home.module.css';

export function RoutineView({
  routineModel,
  mutationOutcome,
}: {
  routineModel?: CustomerRoutineReadModel;
  mutationOutcome?: string;
}) {
  const surface = ME_PORTAL_SURFACES.routine;
  if (!routineModel) return null;
  return (
    <section className={styles.routePage} aria-labelledby="me-routine-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{routineModel.routineProvenance ?? surface.eyebrow}</p>
        <h1 id="me-routine-title">{surface.title}</h1>
      </div>
      <RoutineManager
        routines={routineModel.routines}
        routineState={routineModel.routineState}
        outcome={mutationOutcome}
      />
    </section>
  );
}
