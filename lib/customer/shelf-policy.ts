import type { CustomerAccessIdentity } from './access-policy';
import type { CustomerShelfRecord, CustomerShelfRepository } from './shelf-repository';

export type CustomerShelfActionResult = {
  status: 'saved' | 'already_saved' | 'removed' | 'already_removed' | 'cleared' | 'conflict' | 'error';
  message: string;
};

export type CustomerShelfReadResult =
  | { status: 'ready'; items: CustomerShelfRecord[] }
  | { status: 'unavailable'; items: []; message: string };

export type CustomerShelfCountResult =
  | { status: 'ready'; count: number }
  | { status: 'unavailable'; count: 0; message: string };

export type CustomerShelfContextResult =
  | { status: 'ready'; items: CustomerShelfRecord[] }
  | { status: 'unavailable'; items: []; message: string };

export function isValidCustomerShelfOwnerSubject(ownerSubject: unknown): ownerSubject is string {
  return typeof ownerSubject === 'string'
    && ownerSubject === ownerSubject.trim()
    && ownerSubject.length > 0
    && ownerSubject.length <= 320;
}

export function createCustomerShelfService(repository: CustomerShelfRepository) {
  return {
    async read(identity: CustomerAccessIdentity): Promise<CustomerShelfReadResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'unavailable', items: [], message: 'Synthetic Shelf is local preview data.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'unavailable', items: [], message: 'Shelf is unavailable right now. Try again.' };
      }
      try {
        return { status: 'ready', items: await repository.list(identity.subject) };
      } catch {
        console.error('Customer Shelf read unavailable.');
        return { status: 'unavailable', items: [], message: 'Shelf is unavailable right now. Try again.' };
      }
    },

    async count(identity: CustomerAccessIdentity): Promise<CustomerShelfCountResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'unavailable', count: 0, message: 'Synthetic Shelf is local preview data.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'unavailable', count: 0, message: 'Shelf is unavailable right now. Try again.' };
      }
      try {
        return { status: 'ready', count: await repository.count(identity.subject) };
      } catch {
        console.error('Customer Shelf count unavailable.');
        return { status: 'unavailable', count: 0, message: 'Shelf is unavailable right now. Try again.' };
      }
    },

    async contextForProduct(identity: CustomerAccessIdentity, slug: string): Promise<CustomerShelfContextResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'unavailable', items: [], message: 'Synthetic Shelf is local preview data.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'unavailable', items: [], message: 'Shelf is unavailable right now. Try again.' };
      }
      try {
        return { status: 'ready', items: await repository.contextForProduct(identity.subject, slug) };
      } catch {
        console.error('Customer Shelf context unavailable.');
        return { status: 'unavailable', items: [], message: 'Shelf is unavailable right now. Try again.' };
      }
    },

    async add(identity: CustomerAccessIdentity, slug: string): Promise<CustomerShelfActionResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'error', message: 'Synthetic Shelf cannot be changed.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'error', message: 'Could not save. Try again.' };
      }
      try {
        const outcome = await repository.addCurrentBySlug(identity.subject, slug);
        if (outcome === 'added') return { status: 'saved', message: 'Saved to Shelf.' };
        if (outcome === 'already_saved') return { status: 'already_saved', message: 'Already on Shelf.' };
        return { status: 'conflict', message: 'Product changed. Refresh and try again.' };
      } catch {
        console.error('Customer Shelf save unavailable.');
        return { status: 'error', message: 'Could not save. Try again.' };
      }
    },

    async remove(identity: CustomerAccessIdentity, identityVersionId: string): Promise<CustomerShelfActionResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'error', message: 'Synthetic Shelf cannot be changed.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'error', message: 'Could not remove. Try again.' };
      }
      try {
        const outcome = await repository.remove(identity.subject, identityVersionId);
        return outcome === 'removed'
          ? { status: 'removed', message: 'Removed from Shelf.' }
          : { status: 'already_removed', message: 'Already removed.' };
      } catch {
        console.error('Customer Shelf removal unavailable.');
        return { status: 'error', message: 'Could not remove. Try again.' };
      }
    },

    async clear(identity: CustomerAccessIdentity): Promise<CustomerShelfActionResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'error', message: 'Synthetic Shelf cannot be changed.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'error', message: 'Could not clear Shelf. Try again.' };
      }
      try {
        const removed = await repository.clear(identity.subject);
        return {
          status: 'cleared',
          message: removed === 1 ? 'Shelf cleared. 1 product removed.' : `Shelf cleared. ${removed} products removed.`,
        };
      } catch {
        console.error('Customer Shelf clear unavailable.');
        return { status: 'error', message: 'Could not clear Shelf. Try again.' };
      }
    },
  };
}
