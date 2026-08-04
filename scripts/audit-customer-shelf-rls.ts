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
const ATTESTATION_FALSE_FIELDS = new Set<keyof CustomerShelfRoleAttestation>([
  'rolinherit',
  'rolsuper',
  'rolcreatedb',
  'rolcreaterole',
  'rolreplication',
  'rolbypassrls',
  'has_role_memberships',
  'owns_relations',
  'routines_app_privileges',
  'routine_steps_app_privileges',
  'routines_public_privileges',
  'routine_steps_public_privileges',
  'research_mentions_shelf_select',
  'research_mentions_app_request_id_select',
  'signal_bridge_public_execute',
  'signal_bridge_app_execute',
]);

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
      shelf_relation.relforcerowsecurity,
      request_relation.relrowsecurity as requests_relrowsecurity,
      request_relation.relforcerowsecurity as requests_relforcerowsecurity,
      image_relation.relrowsecurity as images_relrowsecurity,
      image_relation.relforcerowsecurity as images_relforcerowsecurity,
      mutation_relation.relrowsecurity as mutations_relrowsecurity,
      mutation_relation.relforcerowsecurity as mutations_relforcerowsecurity,
      cleanup_relation.relrowsecurity as cleanup_relrowsecurity,
      cleanup_relation.relforcerowsecurity as cleanup_relforcerowsecurity,
      routine_relation.relrowsecurity as routines_relrowsecurity,
      routine_relation.relforcerowsecurity as routines_relforcerowsecurity,
      routine_step_relation.relrowsecurity as routine_steps_relrowsecurity,
      routine_step_relation.relforcerowsecurity as routine_steps_relforcerowsecurity,
      pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'SELECT')
        and pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'INSERT')
        and pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'UPDATE')
        and pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'DELETE')
        and not pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'TRUNCATE')
        and not pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'REFERENCES')
        and not pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_relation.oid, 'TRIGGER')
        as routines_shelf_privileges_exact,
      pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'SELECT')
        and pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'INSERT')
        and pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'UPDATE')
        and pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'DELETE')
        and not pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'TRUNCATE')
        and not pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'REFERENCES')
        and not pg_catalog.has_table_privilege(${CUSTOMER_SHELF_RUNTIME_ROLE}, routine_step_relation.oid, 'TRIGGER')
        as routine_steps_shelf_privileges_exact,
      pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'DELETE')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'TRUNCATE')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'REFERENCES')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_relation.oid, 'TRIGGER')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_relation.oid, 'SELECT')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_relation.oid, 'INSERT')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_relation.oid, 'UPDATE')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_relation.oid, 'REFERENCES')
        as routines_app_privileges,
      pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'DELETE')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'TRUNCATE')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'REFERENCES')
        or pg_catalog.has_table_privilege('jelocare_app_runtime', routine_step_relation.oid, 'TRIGGER')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_step_relation.oid, 'SELECT')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_step_relation.oid, 'INSERT')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_step_relation.oid, 'UPDATE')
        or pg_catalog.has_any_column_privilege('jelocare_app_runtime', routine_step_relation.oid, 'REFERENCES')
        as routine_steps_app_privileges,
      exists (
        select 1
        from pg_catalog.aclexplode(coalesce(
          routine_relation.relacl,
          pg_catalog.acldefault('r', routine_relation.relowner)
        )) privilege
        where privilege.grantee = 0
      ) or exists (
        select 1
        from pg_catalog.pg_attribute attribute
        cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
        where attribute.attrelid = routine_relation.oid
          and privilege.grantee = 0
      ) as routines_public_privileges,
      exists (
        select 1
        from pg_catalog.aclexplode(coalesce(
          routine_step_relation.relacl,
          pg_catalog.acldefault('r', routine_step_relation.relowner)
        )) privilege
        where privilege.grantee = 0
      ) or exists (
        select 1
        from pg_catalog.pg_attribute attribute
        cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
        where attribute.attrelid = routine_step_relation.oid
          and privilege.grantee = 0
      ) as routine_steps_public_privileges,
      pg_catalog.has_table_privilege(
        ${CUSTOMER_SHELF_RUNTIME_ROLE}, mention_relation.oid, 'SELECT'
      ) as research_mentions_shelf_select,
      pg_catalog.has_column_privilege(
        'jelocare_app_runtime', mention_relation.oid, 'request_id', 'SELECT'
      ) as research_mentions_app_request_id_select,
      pg_catalog.has_column_privilege(
        'jelocare_app_runtime', mention_relation.oid, 'task_id', 'SELECT'
      )
      and pg_catalog.has_column_privilege(
        'jelocare_app_runtime', mention_relation.oid, 'active', 'SELECT'
      )
      and pg_catalog.has_column_privilege(
        'jelocare_app_runtime', mention_relation.oid, 'first_seen_at', 'SELECT'
      )
      and pg_catalog.has_column_privilege(
        'jelocare_app_runtime', mention_relation.oid, 'last_seen_at', 'SELECT'
      ) as research_mentions_app_aggregate_select,
      signal_bridge.prosecdef as signal_bridge_is_security_definer,
      coalesce(signal_bridge.proconfig, array[]::text[])
        @> array['search_path=pg_catalog, public']::text[]
        as signal_bridge_search_path_is_pinned,
      exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(signal_bridge.proacl, pg_catalog.acldefault('f', signal_bridge.proowner))
        ) privilege
        where privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      ) as signal_bridge_public_execute,
      pg_catalog.has_function_privilege(
        'jelocare_app_runtime', signal_bridge.oid, 'EXECUTE'
      ) as signal_bridge_app_execute,
      pg_catalog.has_function_privilege(
        ${CUSTOMER_SHELF_RUNTIME_ROLE}, signal_bridge.oid, 'EXECUTE'
      ) as signal_bridge_shelf_execute
    from pg_catalog.pg_roles role
    left join pg_catalog.pg_class shelf_relation
      on shelf_relation.oid = pg_catalog.to_regclass('public.customer_shelf_items')
    left join pg_catalog.pg_class request_relation
      on request_relation.oid = pg_catalog.to_regclass('public.customer_product_requests')
    left join pg_catalog.pg_class image_relation
      on image_relation.oid = pg_catalog.to_regclass('public.customer_product_request_images')
    left join pg_catalog.pg_class mutation_relation
      on mutation_relation.oid = pg_catalog.to_regclass('public.customer_product_request_mutations')
    left join pg_catalog.pg_class cleanup_relation
      on cleanup_relation.oid = pg_catalog.to_regclass('public.customer_product_request_blob_cleanup')
    left join pg_catalog.pg_class routine_relation
      on routine_relation.oid = pg_catalog.to_regclass('public.customer_routines')
    left join pg_catalog.pg_class routine_step_relation
      on routine_step_relation.oid = pg_catalog.to_regclass('public.customer_routine_steps')
    left join pg_catalog.pg_class mention_relation
      on mention_relation.oid = pg_catalog.to_regclass('public.customer_product_request_research_mentions')
    left join pg_catalog.pg_proc signal_bridge
      on signal_bridge.oid = pg_catalog.to_regprocedure(
        'public.sync_customer_product_request_research_signal(uuid)'
      )
    where role.rolname = current_user
  `;
  if (!isCustomerShelfRoleAttestationSafe(attestation)) {
    const failedFields = attestation
      ? (Object.entries(attestation) as [keyof CustomerShelfRoleAttestation, boolean][])
          .filter(([field, value]) => value !== !ATTESTATION_FALSE_FIELDS.has(field))
          .map(([field]) => field)
      : ['missing_attestation'];
    console.error(`Customer Shelf role audit failed fields=${failedFields.join(',')}.`);
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
    const [state] = await transaction<{
      customer_subject: string | null;
      visible_count: number;
      visible_routine_count: number;
    }[]>`
      select
        nullif(
          pg_catalog.current_setting('app.customer_subject', true),
          ''
        ) as customer_subject,
        (
          select pg_catalog.count(*)::integer
          from public.customer_shelf_items
        ) as visible_count,
        (
          select pg_catalog.count(*)::integer
          from public.customer_routines
        ) as visible_routine_count
    `;
    if (
      state?.customer_subject !== null
      || state.visible_count !== 0
      || state.visible_routine_count !== 0
    ) {
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

      const routineId = randomUUID();
      const routineStepId = randomUUID();
      const routineInsert = await transaction<{ id: string }[]>`
        insert into public.customer_routines (id, owner_subject, name, origin)
        values (${routineId}, ${ownerA}, 'Audit routine', 'customer')
        returning id
      `;
      if (routineInsert.length !== 1) throw new Error('Customer Routine create audit failed.');
      const routineStepInsert = await transaction<{ id: string }[]>`
        insert into public.customer_routine_steps (
          id, routine_id, owner_subject, position, label, instruction, reference_state
        ) values (
          ${routineStepId}, ${routineId}, ${ownerA}, 1, 'Audit step', 'Rolled back.', 'none'
        )
        returning id
      `;
      if (routineStepInsert.length !== 1) throw new Error('Customer Routine step create audit failed.');

      await expectPrivilegeDenial(transaction, 'forged routine insert', savepoint => savepoint`
        insert into public.customer_routines (owner_subject, name, origin)
        values (${ownerB}, 'Forged routine', 'customer')
      `);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
      const routinesVisibleToB = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_routines
        where owner_subject = ${ownerA}
      `;
      if (routinesVisibleToB[0]?.count !== 0) throw new Error('Customer Routine read isolation audit failed.');
      const crossOwnerRoutineUpdate = await transaction<{ id: string }[]>`
        update public.customer_routines
        set name = 'Cross-owner update'
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (crossOwnerRoutineUpdate.length !== 0) throw new Error('Customer Routine update isolation audit failed.');
      const crossOwnerRoutineDelete = await transaction<{ id: string }[]>`
        delete from public.customer_routines
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (crossOwnerRoutineDelete.length !== 0) throw new Error('Customer Routine delete isolation audit failed.');

      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
      const ownerRoutineUpdate = await transaction<{ id: string }[]>`
        update public.customer_routines
        set name = 'Updated audit routine',
            revision = revision + 1,
            updated_at = now()
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (ownerRoutineUpdate.length !== 1) throw new Error('Customer Routine owner update audit failed.');
      const ownerRoutineDelete = await transaction<{ id: string }[]>`
        delete from public.customer_routines
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (ownerRoutineDelete.length !== 1) throw new Error('Customer Routine owner delete audit failed.');
      const remainingRoutineSteps = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_routine_steps
        where owner_subject = ${ownerA}
          and routine_id = ${routineId}
      `;
      if (remainingRoutineSteps[0]?.count !== 0) throw new Error('Customer Routine cascade audit failed.');
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

main().catch((error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : 'unavailable';
  const routine = typeof error === 'object' && error && 'routine' in error
    ? String(error.routine)
    : 'unavailable';
  console.error(`Customer Shelf role audit failed (code=${code}; routine=${routine}).`);
  process.exitCode = 1;
});
