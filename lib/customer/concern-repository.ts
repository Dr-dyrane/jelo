import 'server-only';

import {
  assertCustomerShelfRlsRole,
  getCustomerShelfPostgresClient,
} from './shelf-database';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';

export type CustomerConcernOrigin = 'customer' | 'synthetic-development';

export type CustomerConcernRecord = {
  concernSlug: string;
  savedAt: string;
  origin: CustomerConcernOrigin;
};

export type CustomerConcernRepository = {
  list(ownerSubject: string): Promise<CustomerConcernRecord[]>;
  add(ownerSubject: string, concernSlug: string): Promise<'added' | 'already_saved'>;
  remove(ownerSubject: string, concernSlug: string): Promise<'removed' | 'already_removed'>;
  clear(ownerSubject: string): Promise<number>;
};

type CustomerConcernRow = {
  concern_slug: string;
  saved_at: Date | string;
  origin: CustomerConcernOrigin;
};

function requiredOwnerSubject(ownerSubject: string) {
  const value = ownerSubject.trim();
  if (!isValidCustomerShelfOwnerSubject(value)) throw new Error('Customer Concern owner is unavailable.');
  return value;
}

function requiredConcernSlug(concernSlug: string) {
  const value = concernSlug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 80) {
    throw new Error('Concern is unavailable.');
  }
  return value;
}

function mapConcernRow(row: CustomerConcernRow): CustomerConcernRecord {
  return {
    concernSlug: row.concern_slug,
    savedAt: new Date(row.saved_at).toISOString(),
    origin: row.origin,
  };
}

export const postgresCustomerConcernRepository: CustomerConcernRepository = {
  async list(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const rows = await transaction<CustomerConcernRow[]>`
        select concern_slug, saved_at, origin
        from public.customer_concerns
        where owner_subject = ${owner}
          and removed_at is null
        order by saved_at desc, concern_slug
      `;
      return rows.map(mapConcernRow);
    });
  },

  async add(ownerSubject, concernSlug) {
    const owner = requiredOwnerSubject(ownerSubject);
    const slug = requiredConcernSlug(concernSlug);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const [reactivated] = await transaction<{ reactivated: boolean }[]>`
        update public.customer_concerns
          set removed_at = null, saved_at = now(), origin = 'customer'
          where owner_subject = ${owner}
            and concern_slug = ${slug}
            and removed_at is not null
        returning true as reactivated
      `;
      if (reactivated) return 'added';
      const [inserted] = await transaction<{ inserted: boolean }[]>`
        insert into public.customer_concerns (owner_subject, concern_slug, origin)
          values (${owner}, ${slug}, 'customer')
          on conflict (owner_subject, concern_slug) where removed_at is null
          do nothing
          returning true as inserted
      `;
      return inserted ? 'added' : 'already_saved';
    });
  },

  async remove(ownerSubject, concernSlug) {
    const owner = requiredOwnerSubject(ownerSubject);
    const slug = requiredConcernSlug(concernSlug);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const [removed] = await transaction<{ removed: boolean }[]>`
        update public.customer_concerns
          set removed_at = now()
          where owner_subject = ${owner}
            and concern_slug = ${slug}
            and removed_at is null
        returning true as removed
      `;
      return removed ? 'removed' : 'already_removed';
    });
  },

  async clear(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const rows = await transaction<{ cleared: boolean }[]>`
        update public.customer_concerns
          set removed_at = now()
          where owner_subject = ${owner}
            and removed_at is null
        returning true as cleared
      `;
      return rows.length;
    });
  },
};
