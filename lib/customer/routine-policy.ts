import type { CustomerAccessIdentity } from './access-policy';
import type { CustomerRoutineInput } from './routine-input';
import type { CustomerRoutineRecord, CustomerRoutineRepository } from './routine-repository';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';

export type CustomerRoutineReadResult =
  | { status: 'ready'; routines: CustomerRoutineRecord[] }
  | { status: 'unavailable'; routines: []; message: string };

export type CustomerRoutineSummaryResult =
  | { status: 'ready'; routineCount: number; stepCount: number }
  | { status: 'unavailable'; routineCount: 0; stepCount: 0; message: string };

export type CustomerRoutineContextResult =
  | { status: 'ready'; routines: CustomerRoutineRecord[] }
  | { status: 'unavailable'; routines: []; message: string };

export type CustomerRoutineActionResult = {
  status: 'created' | 'updated' | 'removed' | 'already_removed' | 'conflict' | 'error';
  message: string;
};

export function createCustomerRoutineService(repository: CustomerRoutineRepository) {
  const availableOwner = (identity: CustomerAccessIdentity) => (
    identity.source === 'session' && isValidCustomerShelfOwnerSubject(identity.subject)
  );

  return {
    async read(identity: CustomerAccessIdentity): Promise<CustomerRoutineReadResult> {
      if (!availableOwner(identity)) {
        return { status: 'unavailable', routines: [], message: 'Routine is unavailable right now. Try again.' };
      }
      try {
        return { status: 'ready', routines: await repository.list(identity.subject) };
      } catch {
        console.error('Customer Routine read unavailable.');
        return { status: 'unavailable', routines: [], message: 'Routine is unavailable right now. Try again.' };
      }
    },

    async summary(identity: CustomerAccessIdentity): Promise<CustomerRoutineSummaryResult> {
      if (!availableOwner(identity)) {
        return { status: 'unavailable', routineCount: 0, stepCount: 0, message: 'Routine is unavailable right now. Try again.' };
      }
      try {
        const result = await repository.summary(identity.subject);
        return { status: 'ready', routineCount: result.routineCount, stepCount: result.stepCount };
      } catch {
        console.error('Customer Routine summary unavailable.');
        return { status: 'unavailable', routineCount: 0, stepCount: 0, message: 'Routine is unavailable right now. Try again.' };
      }
    },

    async contextForProduct(identity: CustomerAccessIdentity, slug: string): Promise<CustomerRoutineContextResult> {
      if (!availableOwner(identity)) {
        return { status: 'unavailable', routines: [], message: 'Routine is unavailable right now. Try again.' };
      }
      try {
        return { status: 'ready', routines: await repository.contextForProduct(identity.subject, slug) };
      } catch {
        console.error('Customer Routine context unavailable.');
        return { status: 'unavailable', routines: [], message: 'Routine is unavailable right now. Try again.' };
      }
    },

    async create(identity: CustomerAccessIdentity, input: CustomerRoutineInput): Promise<CustomerRoutineActionResult> {
      if (!availableOwner(identity)) return { status: 'error', message: 'Could not create routine. Try again.' };
      try {
        await repository.create(identity.subject, input);
        return { status: 'created', message: 'Routine created.' };
      } catch {
        console.error('Customer Routine creation unavailable.');
        return { status: 'error', message: 'Could not create routine. Try again.' };
      }
    },

    async update(
      identity: CustomerAccessIdentity,
      routineId: string,
      expectedRevision: number,
      input: CustomerRoutineInput,
    ): Promise<CustomerRoutineActionResult> {
      if (!availableOwner(identity)) return { status: 'error', message: 'Could not update routine. Try again.' };
      try {
        const result = await repository.update(identity.subject, routineId, expectedRevision, input);
        return result === 'updated'
          ? { status: 'updated', message: 'Routine updated.' }
          : { status: 'conflict', message: 'Routine changed. Refresh and try again.' };
      } catch {
        console.error('Customer Routine update unavailable.');
        return { status: 'error', message: 'Could not update routine. Try again.' };
      }
    },

    async remove(identity: CustomerAccessIdentity, routineId: string): Promise<CustomerRoutineActionResult> {
      if (!availableOwner(identity)) return { status: 'error', message: 'Could not delete routine. Try again.' };
      try {
        const result = await repository.remove(identity.subject, routineId);
        return result === 'removed'
          ? { status: 'removed', message: 'Routine deleted.' }
          : { status: 'already_removed', message: 'Routine was already deleted.' };
      } catch {
        console.error('Customer Routine deletion unavailable.');
        return { status: 'error', message: 'Could not delete routine. Try again.' };
      }
    },
  };
}
