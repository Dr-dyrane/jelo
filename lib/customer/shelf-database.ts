import 'server-only';

import postgres from 'postgres';
import {
  CUSTOMER_SHELF_RUNTIME_ROLE,
  isCustomerShelfRoleAttestationSafe,
  type CustomerShelfRoleAttestation,
} from './shelf-role-attestation';

let shelfClient: ReturnType<typeof postgres> | undefined;

export function getCustomerShelfPostgresClient() {
  const connectionString = process.env.CUSTOMER_SHELF_DATABASE_URL;
  if (!/^postgres(?:ql)?:\/\//.test(connectionString ?? '')) {
    throw new Error('CUSTOMER_SHELF_DATABASE_URL is required for private Shelf access.');
  }
  if (!shelfClient) {
    shelfClient = postgres(connectionString!, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return shelfClient;
}

export async function assertCustomerShelfRlsRole(
  transaction: ReturnType<typeof getCustomerShelfPostgresClient>,
) {
  try {
    const [attestation] = await transaction<CustomerShelfRoleAttestation[]>`
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
            coalesce(
              signal_bridge.proacl,
              pg_catalog.acldefault('f', signal_bridge.proowner)
            )
          ) privilege
          where privilege.grantee = 0
            and privilege.privilege_type = 'EXECUTE'
        ) as signal_bridge_public_execute,
        pg_catalog.has_function_privilege(
          'jelocare_app_runtime',
          signal_bridge.oid,
          'EXECUTE'
        ) as signal_bridge_app_execute,
        pg_catalog.has_function_privilege(
          ${CUSTOMER_SHELF_RUNTIME_ROLE},
          signal_bridge.oid,
          'EXECUTE'
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
      left join pg_catalog.pg_class mention_relation
        on mention_relation.oid = pg_catalog.to_regclass('public.customer_product_request_research_mentions')
      left join pg_catalog.pg_proc signal_bridge
        on signal_bridge.oid = pg_catalog.to_regprocedure(
          'public.sync_customer_product_request_research_signal(uuid)'
        )
      where role.rolname = current_user
    `;
    if (isCustomerShelfRoleAttestationSafe(attestation)) return;
  } catch {
    // The caller receives the same fail-closed outcome for configuration,
    // catalogue, permission, and connectivity failures.
  }
  throw new Error('Customer Shelf database access is unavailable.');
}
