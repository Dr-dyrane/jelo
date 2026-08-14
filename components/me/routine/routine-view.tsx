"use client";

import { RoutineManager } from "@/components/me/routine/routine-manager";
import { ME_PORTAL_SURFACES } from "@/components/me/shell/me-shell-model";
import type { CustomerRoutineReadModel } from "@/lib/customer/route-read-models";
import styles from "../home/me-home.module.css";
import routeStyles from "./routine-view.module.css";

export function RoutineView({
  routineModel,
  mutationOutcome,
}: {
  routineModel?: CustomerRoutineReadModel;
  mutationOutcome?: string;
}) {
  const surface = ME_PORTAL_SURFACES.routine;
  if (!routineModel) return null;
  const stepCount = routineModel.routines.reduce(
    (total, routine) => total + routine.steps.length,
    0,
  );
  return (
    <section
      className={`${styles.routePage} ${routeStyles.page}`}
      aria-labelledby="me-routine-title"
    >
      <header className={routeStyles.heading}>
        <div>
          <p>{routineModel.routineProvenance ?? surface.eyebrow}</p>
          <h1 id="me-routine-title">{surface.title}</h1>
        </div>
        <p className={routeStyles.reading}>
          {stepCount
            ? `${stepCount} ${stepCount === 1 ? "step" : "steps"}, in the order you chose`
            : "A sequence you can make your own"}
        </p>
      </header>
      <RoutineManager
        routines={routineModel.routines}
        routineState={routineModel.routineState}
        outcome={mutationOutcome}
      />
    </section>
  );
}
