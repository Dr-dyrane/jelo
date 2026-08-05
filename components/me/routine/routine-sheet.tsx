'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import {
  createRoutineAction,
  updateRoutineAction,
} from '@/app/(customer)/me/actions';
import type { CustomerPortalSavedRoutine } from '@/lib/customer/portal-model';
import { serializeCustomerRoutineSteps } from '@/lib/customer/routine-input';
import styles from './routine-manager.module.css';

type StepDraft = { label: string; instruction: string };

const TIME_PRESETS = [
  { id: 'morning', label: 'Morning' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Custom' },
];

function emptyStep(): StepDraft {
  return { label: '', instruction: '' };
}

function stepsFromRoutine(routine: CustomerPortalSavedRoutine): StepDraft[] {
  return routine.steps.map(step => ({ label: step.label, instruction: step.instruction }));
}

function stepsToSerialized(steps: StepDraft[]): string {
  return serializeCustomerRoutineSteps(
    steps
      .filter(step => step.label.trim())
      .map(step => ({ label: step.label.trim(), instruction: step.instruction.trim() })),
  );
}

function RoutineForm({ routine }: { routine?: CustomerPortalSavedRoutine }) {
  const [name, setName] = useState(routine?.name ?? '');
  const [steps, setSteps] = useState<StepDraft[]>(
    routine ? stepsFromRoutine(routine) : [emptyStep()],
  );
  const nameId = useId();

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps(current => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function removeStep(index: number) {
    setSteps(current => current.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps(current => [...current, emptyStep()]);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps(current => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <>
      {routine ? (
        <>
          <input type="hidden" name="routineId" value={routine.id} />
          <input type="hidden" name="revision" value={routine.revision} />
        </>
      ) : null}
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="steps" value={stepsToSerialized(steps)} />

      <div className={styles.stepField}>
        <label htmlFor={nameId}>
          <span>Time of day</span>
          <small>This becomes the routine name.</small>
        </label>
        <div className={styles.timePresetRow}>
          {TIME_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`${styles.timePreset} ${name === preset.label ? styles.timePresetActive : ''}`}
              onClick={() => setName(preset.label)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          id={nameId}
          type="text"
          maxLength={80}
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Morning, evening, weekly…"
          className={styles.timeCustomInput}
        />
      </div>

      <div className={styles.stepList}>
        <div className={styles.stepListHeader}>
          <span>Steps</span>
          <small>Add one at a time.</small>
        </div>
        {steps.map((step, index) => (
          <div key={index} className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
              <div className={styles.stepCardControls}>
                <button
                  type="button"
                  className={styles.stepMover}
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                  aria-label="Move step up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.stepMover}
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                  aria-label="Move step down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.stepRemover}
                  onClick={() => removeStep(index)}
                  disabled={steps.length <= 1}
                  aria-label="Remove step"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            <input
              type="text"
              maxLength={160}
              value={step.label}
              onChange={event => updateStep(index, { label: event.target.value })}
              placeholder="Step name — e.g. Cleanse"
              className={styles.stepLabelInput}
            />
            <textarea
              maxLength={400}
              value={step.instruction}
              onChange={event => updateStep(index, { instruction: event.target.value })}
              placeholder="How to do it — e.g. Brief, gentle cleanse."
              rows={2}
              className={styles.stepInstructionInput}
            />
          </div>
        ))}
        {steps.length < 20 ? (
          <button type="button" className={styles.addStepButton} onClick={addStep}>
            <Plus size={16} aria-hidden="true" /> Add step
          </button>
        ) : null}
      </div>
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
            <RoutineForm />
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
            <RoutineForm routine={routine} />
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
