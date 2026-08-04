'use client';

import { Trash2 } from 'lucide-react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import { deleteRoutineAction } from '@/app/(customer)/me/actions';
import type { CustomerPortalSavedRoutine } from '@/lib/customer/portal-model';
import styles from './routine-manager.module.css';

export function RoutineDeleteDialog({
  routine,
}: {
  routine: CustomerPortalSavedRoutine;
}) {
  const { dialogRef, triggerRef, open, close } = useModalDialog();

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.deleteAction}
        type="button"
        aria-haspopup="dialog"
        aria-controls={`delete-routine-dialog-${routine.id}`}
        onClick={open}
      >
        <Trash2 size={16} aria-hidden="true" /> Delete
      </button>

      <dialog
        id={`delete-routine-dialog-${routine.id}`}
        ref={dialogRef}
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`delete-routine-title-${routine.id}`}
        aria-describedby={`delete-routine-consequences-${routine.id}`}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <section className={styles.deletePanel}>
          <header>
            <p>{routine.origin === 'legacy_pages_v1_0' ? 'Reviewed legacy routine' : 'My routine'}</p>
            <h2 id={`delete-routine-title-${routine.id}`}>Delete this routine?</h2>
          </header>

          <dl className={styles.deleteIdentity} aria-label="Routine being deleted">
            <div><dt>Name</dt><dd>{routine.name}</dd></div>
            <div><dt>Steps</dt><dd>{routine.steps.length}</dd></div>
          </dl>

          <div id={`delete-routine-consequences-${routine.id}`} className={styles.deleteConsequences}>
            <p>Deleting this routine will:</p>
            <ul>
              <li>Remove it and all its steps from your Routine.</li>
              <li>Keep any products it referenced on your Shelf.</li>
            </ul>
            <strong>This cannot be undone.</strong>
          </div>

          <form className={styles.deleteActions}>
            <button type="button" onClick={close}>Cancel</button>
            <button
              className={styles.confirmDelete}
              type="submit"
              formAction={deleteRoutineAction}
              name="routineId"
              value={routine.id}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </form>
        </section>
      </dialog>
    </>
  );
}
