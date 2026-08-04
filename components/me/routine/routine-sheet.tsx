'use client';

import { X } from 'lucide-react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import {
  createRoutineAction,
  updateRoutineAction,
} from '@/app/(customer)/me/actions';
import type { CustomerPortalSavedRoutine } from '@/lib/customer/portal-model';
import { serializeCustomerRoutineSteps } from '@/lib/customer/routine-input';
import styles from './routine-manager.module.css';

function RoutineFields({ routine }: { routine?: CustomerPortalSavedRoutine }) {
  return (
    <>
      {routine ? (
        <>
          <input type="hidden" name="routineId" value={routine.id} />
          <input type="hidden" name="revision" value={routine.revision} />
        </>
      ) : null}
      <label>
        <span>Routine name</span>
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={routine?.name}
          placeholder="Morning"
        />
      </label>
      <label>
        <span>Steps</span>
        <small>One per line. Add an instruction after a | character.</small>
        <textarea
          name="steps"
          required
          rows={routine ? Math.max(4, routine.steps.length) : 4}
          defaultValue={routine ? serializeCustomerRoutineSteps(routine.steps) : undefined}
          placeholder={'Cleanse | Brief, gentle cleanse.\nMoisturize | Apply a light layer.'}
        />
      </label>
    </>
  );
}

export function RoutineCreateSheet() {
  const { dialogRef, triggerRef, open, close } = useModalDialog();

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.createTrigger}
        type="button"
        aria-haspopup="dialog"
        aria-controls="create-routine-sheet"
        onClick={open}
      >
        Create routine
      </button>

      <dialog
        id="create-routine-sheet"
        ref={dialogRef}
        className={styles.sheetDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-routine-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <section className={styles.sheet}>
          <header className={styles.sheetHeading}>
            <div>
              <p>My routine</p>
              <h2 id="create-routine-title">New routine.</h2>
            </div>
            <button className={styles.sheetClose} type="button" aria-label="Close" onClick={close}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <form action={createRoutineAction} className={styles.sheetBody}>
            <RoutineFields />
            <div className={styles.sheetActions}>
              <button className={styles.cancelAction} type="button" onClick={close}>Cancel</button>
              <button className={styles.submitAction} type="submit">Create routine</button>
            </div>
          </form>
        </section>
      </dialog>
    </>
  );
}

export function RoutineEditSheet({
  routine,
}: {
  routine: CustomerPortalSavedRoutine;
}) {
  const { dialogRef, triggerRef, open, close } = useModalDialog();

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.editAction}
        type="button"
        aria-haspopup="dialog"
        aria-controls={`edit-routine-sheet-${routine.id}`}
        onClick={open}
      >
        Edit routine
      </button>

      <dialog
        id={`edit-routine-sheet-${routine.id}`}
        ref={dialogRef}
        className={styles.sheetDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`edit-routine-title-${routine.id}`}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <section className={styles.sheet}>
          <header className={styles.sheetHeading}>
            <div>
              <p>{routine.origin === 'legacy_pages_v1_0' ? 'Reviewed legacy routine' : 'My routine'}</p>
              <h2 id={`edit-routine-title-${routine.id}`}>Edit {routine.name}.</h2>
            </div>
            <button className={styles.sheetClose} type="button" aria-label="Close" onClick={close}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <form action={updateRoutineAction} className={styles.sheetBody}>
            <RoutineFields routine={routine} />
            <div className={styles.sheetActions}>
              <button className={styles.cancelAction} type="button" onClick={close}>Cancel</button>
              <button className={styles.submitAction} type="submit">Save changes</button>
            </div>
          </form>
        </section>
      </dialog>
    </>
  );
}
