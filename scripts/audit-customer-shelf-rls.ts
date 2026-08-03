import { randomUUID } from 'node:crypto';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import {
  CUSTOMER_SHELF_RUNTIME_ROLE,
  isCustomerShelfRoleAttestationSafe,
  type CustomerShelfRoleAttestation,
} from '@/lib/customer/shelf-role-attestation';

const EXERCISE_ROLLBACK = '--exercise-rollback';

class ExpectedAuditRollback extends Error {}

const INSUFFICIENT_PRIVILEGE = '42501';

function customerShelfAuditUrl() {
  const candidate = process.env.CUSTOMER_SHELF_DATABASE_URL;
  if (!/^postgres(?:ql)?:\/\//.test(candidate ?? '')) {
    throw new Error('CUSTOMER_SHELF_DATABASE_URL is required for the Shelf role audit.');
  }
  return candidate!;
}

async function roleAttestation(sql: Sql | TransactionSql) {
  const [attestation] = await sql<CustomerShelfRoleAttestation[]>`
    select
      current_user = ${CUSTOMER_SHELF_RUNTIME_ROLE} as current_role_is_exact,
      session_user = ${CUSTOMER_SHELF_RUNTIME_ROLE} as session_role_is_exact,
      role.rolcanlogin,
      role.rolinherit,
      role.rolsuper,
      role.rolcreatedb,
      role.rolcreaterole,
      role.rolreplication,
      role.rolbypassrls,
      exists (
        select 1
        from pg_catalog.pg_auth_members membership
        where membership.member = role.oid
      ) as has_role_memberships,
      exists (
        select 1
        from pg_catalog.pg_class owned_relation
        where owned_relation.relowner = role.oid
      ) as owns_relations,
      shelf_relation.relrowsecurity,
      shelf_relation.relforcerowsecurity
    from pg_catalog.pg_roles role
    left join pg_catalog.pg_class shelf_relation
      on shelf_relation.oid = pg_catalog.to_regclass('public.customer_shelf_items')
    where role.rolname = current_user
  `;
  if (!isCustomerShelfRoleAttestationSafe(attestation)) {
    throw new Error('Customer Shelf role audit failed.');
  }
}

async function expectPrivilegeDenial(
  transaction: TransactionSql,
  label: string,
  operation: (savepoint: TransactionSql) => Promise<unknown>,
) {
  try {
    await transaction.savepoint(operation);
  } catch (error) {
    if ((error as { code?: unknown }).code === INSUFFICIENT_PRIVILEGE) return;
    throw error;
  }
  throw new Error(`Customer Shelf ${label} audit failed.`);
}

async function assertNoPooledSubjectOrVisibleShelfRows(sql: Sql) {
  await sql.begin('read only', async transaction => {
    await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
    const [state] = await transaction<{ customer_subject: string | null; visible_count: number }[]>`
      select
        pg_catalog.nullif(
          pg_catalog.current_setting('app.customer_subject', true),
          ''
        ) as customer_subject,
        (
          select pg_catalog.count(*)::integer
          from public.customer_shelf_items
        ) as visible_count
    `;
    if (state?.customer_subject !== null || state.visible_count !== 0) {
      throw new Error('Customer Shelf pooled subject reset audit failed.');
    }
  });
}

async function exercisePooledSubjectReset(sql: Sql) {
  const probeOwner = `shelf-role-audit:${randomUUID()}`;
  await sql.begin('read only', async transaction => {
    await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
    await transaction`select pg_catalog.set_config('app.customer_subject', ${probeOwner}, true)`;
    const [state] = await transaction<{ customer_subject: string | null }[]>`
      select pg_catalog.current_setting('app.customer_subject', true) as customer_subject
    `;
    if (state?.customer_subject !== probeOwner) {
      throw new Error('Customer Shelf transaction-local subject audit failed.');
    }
  });
  await assertNoPooledSubjectOrVisibleShelfRows(sql);
}

async function exerciseRolledBackIsolation(sql: Sql) {
  await exercisePooledSubjectReset(sql);
  try {
    await sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await roleAttestation(transaction);
      await expectPrivilegeDenial(transaction, 'private receipt access', savepoint => savepoint`
        select pg_catalog.count(*)
        from public.customer_shelf_import_receipts
      `);
      const [identity] = await transaction<{ identity_version_id: string }[]>`
        select version.identity_version_id
        from public.catalogue_product_identity_versions version
        join public.products product on product.id = version.product_id
        where version.lifecycle_state = 'active'
          and product.is_published = true
        order by version.identity_version_id
        limit 1
      `;
      if (!identity) throw new Error('Customer Shelf role audit could not resolve an active identity.');

      const ownerA = `shelf-role-audit:${randomUUID()}`;
      const ownerB = `shelf-role-audit:${randomUUID()}`;
      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
      const firstAdd = await transaction<{ product_identity_version_id: string }[]>`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (${ownerA}, ${identity.identity_version_id}, 'customer')
        on conflict (owner_subject, product_identity_version_id) do nothing
        returning product_identity_version_id
      `;
      if (firstAdd.length !== 1) throw new Error('Customer Shelf first add audit failed.');
      const duplicateAdd = await transaction<{ product_identity_version_id: string }[]>`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (${ownerA}, ${identity.identity_version_id}, 'customer')
        on conflict (owner_subject, product_identity_version_id) do nothing
        returning product_identity_version_id
      `;
      if (duplicateAdd.length !== 0) throw new Error('Customer Shelf duplicate add audit failed.');
      const visibleToA = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_shelf_items
        where owner_subject = ${ownerA}
      `;
      if (visibleToA[0]?.count !== 1) throw new Error('Customer Shelf owner visibility audit failed.');

      await expectPrivilegeDenial(transaction, 'forged owner insert', savepoint => savepoint`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (${ownerB}, ${identity.identity_version_id}, 'customer')
      `);
      await expectPrivilegeDenial(transaction, 'update privilege', savepoint => savepoint`
        update public.customer_shelf_items
        set saved_at = saved_at
        where owner_subject = ${ownerA}
          and product_identity_version_id = ${identity.identity_version_id}
      `);
      await expectPrivilegeDenial(transaction, 'truncate privilege', savepoint => savepoint`
        truncate table public.customer_shelf_items
      `);

      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
      const visibleToB = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_shelf_items
        where owner_subject = ${ownerA}
      `;
      if (visibleToB[0]?.count !== 0) throw new Error('Customer Shelf isolation audit failed.');
      const forgedOwnerRows = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_shelf_items
        where owner_subject = ${ownerB}
      `;
      if (forgedOwnerRows[0]?.count !== 0) throw new Error('Customer Shelf forged owner isolation audit failed.');
      const crossOwnerDelete = await transaction<{ product_identity_version_id: string }[]>`
        delete from public.customer_shelf_items
        where owner_subject = ${ownerA}
          and product_identity_version_id = ${identity.identity_version_id}
        returning product_identity_version_id
      `;
      if (crossOwnerDelete.length !== 0) throw new Error('Customer Shelf delete isolation audit failed.');

      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
      const ownerDelete = await transaction<{ product_identity_version_id: string }[]>`
        delete from public.customer_shelf_items
        where owner_subject = ${ownerA}
          and product_identity_version_id = ${identity.identity_version_id}
        returning product_identity_version_id
      `;
      if (ownerDelete.length !== 1) throw new Error('Customer Shelf owner delete audit failed.');
      throw new ExpectedAuditRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedAuditRollback)) throw error;
  }
  await assertNoPooledSubjectOrVisibleShelfRows(sql);
}

async function main() {
  const options = process.argv.slice(2);
  if (options.some(option => option !== EXERCISE_ROLLBACK)) {
    throw new Error(`Only ${EXERCISE_ROLLBACK} is supported.`);
  }
  const sql = postgres(customerShelfAuditUrl(), { max: 1, prepare: false });
  try {
    await roleAttestation(sql);
    if (options.includes(EXERCISE_ROLLBACK)) await exerciseRolledBackIsolation(sql);
    console.log(options.includes(EXERCISE_ROLLBACK)
      ? 'Customer Shelf role and rolled-back owner isolation audit passed.'
      : 'Customer Shelf role attestation passed.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error('Customer Shelf role audit failed.');
  process.exitCode = 1;
});
