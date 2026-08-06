import 'server-only';

import type { TransactionSql } from 'postgres';
import {
  assertCustomerShelfRlsRole,
  getCustomerShelfPostgresClient,
} from './shelf-database';
import type { CustomerRoutineInput } from './routine-input';
import { parseCustomerRoutineInput } from './routine-input';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';

export type CustomerRoutineOrigin = 'customer' | 'legacy_pages_v1_0';
export type CustomerRoutineStepReferenceState = 'none' | 'catalogue' | 'product_request' | 'unresolved';

export type CustomerRoutineRecord = {
  id: string;
  revision: number;
  name: string;
  origin: CustomerRoutineOrigin;
  createdAt: string;
  updatedAt: string;
  steps: readonly {
    id: string;
    position: number;
    label: string;
    instruction: string;
    referenceState: CustomerRoutineStepReferenceState;
    productIdentityVersionId: string | null;
    productRequestId: string | null;
    productLifecycleState: 'active' | 'merged' | 'retired' | 'superseded' | null;
    currentProductSlug: string | null;
    currentProductPublished: boolean;
  }[];
};

export type CustomerRoutineRepository = {
  list(ownerSubject: string): Promise<CustomerRoutineRecord[]>;
  summary(ownerSubject: string): Promise<{ routineCount: number; stepCount: number }>;
  contextForProduct(ownerSubject: string, slug: string): Promise<CustomerRoutineRecord[]>;
  create(ownerSubject: string, input: CustomerRoutineInput): Promise<string>;
  update(
    ownerSubject: string,
    routineId: string,
    expectedRevision: number,
    input: CustomerRoutineInput,
  ): Promise<'updated' | 'conflict'>;
  remove(ownerSubject: string, routineId: string): Promise<'removed' | 'already_removed'>;
};

type RoutineRow = {
  id: string;
  revision: number;
  name: string;
  origin: CustomerRoutineOrigin;
  created_at: Date | string;
  updated_at: Date | string;
};

type RoutineStepRow = {
  id: string;
  routine_id: string;
  position: number;
  label: string;
  instruction: string;
  reference_state: CustomerRoutineStepReferenceState;
  product_identity_version_id: string | null;
  product_request_id: string | null;
  product_lifecycle_state: CustomerRoutineRecord['steps'][number]['productLifecycleState'];
  current_product_slug: string | null;
  current_product_published: boolean | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredOwnerSubject(ownerSubject: string) {
  const value = ownerSubject.trim();
  if (!isValidCustomerShelfOwnerSubject(value)) throw new Error('Routine owner is unavailable.');
  return value;
}

function requiredSlug(slug: string) {
  const value = slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 180) {
    throw new Error('Product is unavailable.');
  }
  return value;
}

function requiredRoutineId(routineId: string) {
  const value = routineId.trim();
  if (!UUID.test(value)) throw new Error('Routine is unavailable.');
  return value;
}

function requiredRevision(revision: number) {
  if (!Number.isInteger(revision) || revision < 0) throw new Error('Routine revision is invalid.');
  return revision;
}

function requiredInput(input: CustomerRoutineInput) {
  return parseCustomerRoutineInput(
    input.name,
    input.steps.map(step => (
      step.instruction ? `${step.label} | ${step.instruction}` : step.label
    )).join('\n'),
  );
}

async function prepareOwnerTransaction(transaction: TransactionSql, owner: string) {
  await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
  await assertCustomerShelfRlsRole(transaction);
  await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
}

async function insertCustomerSteps(
  transaction: TransactionSql,
  owner: string,
  routineId: string,
  input: CustomerRoutineInput,
) {
  for (const [index, step] of input.steps.entries()) {
    await transaction`
      insert into public.customer_routine_steps (
        routine_id,
        owner_subject,
        position,
        label,
        instruction,
        reference_state
      ) values (
        ${routineId},
        ${owner},
        ${index + 1},
        ${step.label},
        ${step.instruction},
        'none'
      )
    `;
  }
}

export const postgresCustomerRoutineRepository: CustomerRoutineRepository = {
  async list(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await prepareOwnerTransaction(transaction, owner);
      const routines = await transaction<RoutineRow[]>`
        select id, revision, name, origin, created_at, updated_at
        from public.customer_routines
        where owner_subject = ${owner}
        order by created_at, id
      `;
      if (!routines.length) return [];
      const routineIds = routines.map(routine => routine.id);
      const steps = await transaction<RoutineStepRow[]>`
        select
          step.id,
          step.routine_id,
          step.position,
          step.label,
          step.instruction,
          step.reference_state,
          step.product_identity_version_id,
          step.product_request_id,
          version.lifecycle_state as product_lifecycle_state,
          product.slug as current_product_slug,
          product.is_published as current_product_published
        from public.customer_routine_steps step
        left join public.catalogue_product_identity_versions version
          on version.identity_version_id = step.product_identity_version_id
        left join public.products product
          on product.id = version.product_id
        where step.owner_subject = ${owner}
          and step.routine_id = any(${routineIds}::uuid[])
        order by step.routine_id, step.position, step.id
      `;
      const stepsByRoutine = new Map<string, CustomerRoutineRecord['steps'][number][]>();
      for (const step of steps) {
        const mapped = {
          id: step.id,
          position: step.position,
          label: step.label,
          instruction: step.instruction,
          referenceState: step.reference_state,
          productIdentityVersionId: step.product_identity_version_id,
          productRequestId: step.product_request_id,
          productLifecycleState: step.product_lifecycle_state,
          currentProductSlug: step.current_product_slug,
          currentProductPublished: step.current_product_published === true,
        };
        const owned = stepsByRoutine.get(step.routine_id) ?? [];
        owned.push(mapped);
        stepsByRoutine.set(step.routine_id, owned);
      }
      return routines.map(routine => ({
        id: routine.id,
        revision: routine.revision,
        name: routine.name,
        origin: routine.origin,
        createdAt: new Date(routine.created_at).toISOString(),
        updatedAt: new Date(routine.updated_at).toISOString(),
        steps: stepsByRoutine.get(routine.id) ?? [],
      }));
    });
  },

  async summary(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await prepareOwnerTransaction(transaction, owner);
      const rows = await transaction<{ routine_count: number; step_count: number }[]>`
        select
          count(distinct r.id)::int as routine_count,
          count(s.id)::int as step_count
        from public.customer_routines r
        left join public.customer_routine_steps s
          on s.routine_id = r.id and s.owner_subject = ${owner}
        where r.owner_subject = ${owner}
      `;
      return {
        routineCount: rows[0]?.routine_count ?? 0,
        stepCount: rows[0]?.step_count ?? 0,
      };
    });
  },

  async contextForProduct(ownerSubject, slug) {
    const owner = requiredOwnerSubject(ownerSubject);
    const productSlug = requiredSlug(slug);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await prepareOwnerTransaction(transaction, owner);
      const routines = await transaction<RoutineRow[]>`
        select distinct r.id, r.revision, r.name, r.origin, r.created_at, r.updated_at
        from public.customer_routines r
        join public.customer_routine_steps s on s.routine_id = r.id
        left join public.catalogue_product_identity_versions version
          on version.identity_version_id = s.product_identity_version_id
        left join public.products product on product.id = version.product_id
        where r.owner_subject = ${owner}
          and (version.slug_at_review = ${productSlug} or product.slug = ${productSlug})
        order by r.created_at, r.id
      `;
      if (!routines.length) return [];
      const routineIds = routines.map(routine => routine.id);
      const steps = await transaction<RoutineStepRow[]>`
        select
          step.id,
          step.routine_id,
          step.position,
          step.label,
          step.instruction,
          step.reference_state,
          step.product_identity_version_id,
          step.product_request_id,
          version.lifecycle_state as product_lifecycle_state,
          product.slug as current_product_slug,
          product.is_published as current_product_published
        from public.customer_routine_steps step
        left join public.catalogue_product_identity_versions version
          on version.identity_version_id = step.product_identity_version_id
        left join public.products product
          on product.id = version.product_id
        where step.owner_subject = ${owner}
          and step.routine_id = any(${routineIds}::uuid[])
        order by step.routine_id, step.position, step.id
      `;
      const stepsByRoutine = new Map<string, CustomerRoutineRecord['steps'][number][]>();
      for (const step of steps) {
        const mapped = {
          id: step.id,
          position: step.position,
          label: step.label,
          instruction: step.instruction,
          referenceState: step.reference_state,
          productIdentityVersionId: step.product_identity_version_id,
          productRequestId: step.product_request_id,
          productLifecycleState: step.product_lifecycle_state,
          currentProductSlug: step.current_product_slug,
          currentProductPublished: step.current_product_published === true,
        };
        const owned = stepsByRoutine.get(step.routine_id) ?? [];
        owned.push(mapped);
        stepsByRoutine.set(step.routine_id, owned);
      }
      return routines.map(routine => ({
        id: routine.id,
        revision: routine.revision,
        name: routine.name,
        origin: routine.origin,
        createdAt: new Date(routine.created_at).toISOString(),
        updatedAt: new Date(routine.updated_at).toISOString(),
        steps: stepsByRoutine.get(routine.id) ?? [],
      }));
    });
  },

  async create(ownerSubject, unsafeInput) {
    const owner = requiredOwnerSubject(ownerSubject);
    const input = requiredInput(unsafeInput);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await prepareOwnerTransaction(transaction, owner);
      const [routine] = await transaction<{ id: string }[]>`
        insert into public.customer_routines (owner_subject, name, origin)
        values (${owner}, ${input.name}, 'customer')
        returning id
      `;
      if (!routine) throw new Error('Routine could not be created.');
      await insertCustomerSteps(transaction, owner, routine.id, input);
      return routine.id;
    });
  },

  async update(ownerSubject, routineId, expectedRevision, unsafeInput) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredRoutineId(routineId);
    const revision = requiredRevision(expectedRevision);
    const input = requiredInput(unsafeInput);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await prepareOwnerTransaction(transaction, owner);
      const updated = await transaction<{ id: string }[]>`
        update public.customer_routines
        set name = ${input.name},
            revision = revision + 1,
            updated_at = now()
        where owner_subject = ${owner}
          and id = ${id}
          and revision = ${revision}
        returning id
      `;
      if (!updated[0]) return 'conflict';
      await transaction`
        delete from public.customer_routine_steps
        where owner_subject = ${owner}
          and routine_id = ${id}
      `;
      await insertCustomerSteps(transaction, owner, id, input);
      return 'updated';
    });
  },

  async remove(ownerSubject, routineId) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredRoutineId(routineId);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await prepareOwnerTransaction(transaction, owner);
      const removed = await transaction<{ id: string }[]>`
        delete from public.customer_routines
        where owner_subject = ${owner}
          and id = ${id}
        returning id
      `;
      return removed.length === 1 ? 'removed' : 'already_removed';
    });
  },
};
