import type { CustomerAccessIdentity } from './access-policy';
import type { Concern } from '@/data/knowledge';
import { concerns } from '@/data/knowledge';
import type { CustomerConcernRecord, CustomerConcernRepository } from './concern-repository';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';

export type CustomerConcernReadResult =
  | { status: 'ready'; concerns: CustomerConcernRecord[] }
  | { status: 'unavailable'; concerns: []; message: string };

export type CustomerConcernActionResult = {
  status: 'saved' | 'removed' | 'cleared' | 'error';
  concernSlug?: string;
  message: string;
};

const concernBySlug = new Map<string, Concern>(
  concerns.map(concern => [concern.slug, concern]),
);

function isEligibleConcernSlug(slug: string): boolean {
  const concern = concernBySlug.get(slug);
  return Boolean(concern && concern.kind === 'concern');
}

export function createCustomerConcernService(repository: CustomerConcernRepository) {
  return {
    async read(identity: CustomerAccessIdentity): Promise<CustomerConcernReadResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'unavailable', concerns: [], message: 'Synthetic concerns are local preview data.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'unavailable', concerns: [], message: 'Concerns are unavailable right now. Try again.' };
      }
      try {
        return { status: 'ready', concerns: await repository.list(identity.subject) };
      } catch {
        console.error('Customer Concern read unavailable.');
        return { status: 'unavailable', concerns: [], message: 'Concerns are unavailable right now. Try again.' };
      }
    },

    async add(identity: CustomerAccessIdentity, concernSlug: string): Promise<CustomerConcernActionResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'error', concernSlug, message: 'Synthetic concerns cannot be changed.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'error', concernSlug, message: 'Could not save concern. Try again.' };
      }
      if (!isEligibleConcernSlug(concernSlug)) {
        return { status: 'error', concernSlug, message: 'That concern is not available to save.' };
      }
      try {
        const outcome = await repository.add(identity.subject, concernSlug);
        return outcome === 'added'
          ? { status: 'saved', concernSlug, message: 'Concern saved.' }
          : { status: 'saved', concernSlug, message: 'Concern already saved.' };
      } catch {
        console.error('Customer Concern save unavailable.');
        return { status: 'error', concernSlug, message: 'Could not save concern. Try again.' };
      }
    },

    async remove(identity: CustomerAccessIdentity, concernSlug: string): Promise<CustomerConcernActionResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'error', concernSlug, message: 'Synthetic concerns cannot be changed.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'error', concernSlug, message: 'Could not remove concern. Try again.' };
      }
      try {
        const outcome = await repository.remove(identity.subject, concernSlug);
        return outcome === 'removed'
          ? { status: 'removed', concernSlug, message: 'Concern removed.' }
          : { status: 'removed', concernSlug, message: 'Concern already removed.' };
      } catch {
        console.error('Customer Concern removal unavailable.');
        return { status: 'error', concernSlug, message: 'Could not remove concern. Try again.' };
      }
    },

    async clear(identity: CustomerAccessIdentity): Promise<CustomerConcernActionResult> {
      if (identity.source === 'synthetic-development') {
        return { status: 'error', message: 'Synthetic concerns cannot be changed.' };
      }
      if (!isValidCustomerShelfOwnerSubject(identity.subject)) {
        return { status: 'error', message: 'Could not clear concerns. Try again.' };
      }
      try {
        const removed = await repository.clear(identity.subject);
        return {
          status: 'cleared',
          message: removed === 1 ? 'Concerns cleared. 1 concern removed.' : `Concerns cleared. ${removed} concerns removed.`,
        };
      } catch {
        console.error('Customer Concern clear unavailable.');
        return { status: 'error', message: 'Could not clear concerns. Try again.' };
      }
    },
  };
}
