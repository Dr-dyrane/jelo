import "server-only";

import postgres from "postgres";
import {
  CUSTOMER_SHELF_RUNTIME_ROLE,
  isCustomerShelfRoleAttestationSafe,
  type CustomerShelfRoleAttestation,
} from "./shelf-role-attestation";

let shelfClient: ReturnType<typeof postgres> | undefined;

export function getCustomerShelfPostgresClient() {
  const connectionString = process.env.CUSTOMER_SHELF_DATABASE_URL;
  if (!/^postgres(?:ql)?:\/\//.test(connectionString ?? "")) {
    throw new Error(
      "CUSTOMER_SHELF_DATABASE_URL is required for private Shelf access.",
    );
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
        coalesce((
          select pg_catalog.array_agg(
            privilege.privilege_type || ':' || privilege.is_grantable::text
            order by privilege.privilege_type
          )
          from pg_catalog.aclexplode(coalesce(
            request_relation.relacl,
            pg_catalog.acldefault('r', request_relation.relowner)
          )) privilege
          where privilege.grantee = role.oid
        ), array[]::text[]) = array['INSERT:false', 'SELECT:false', 'UPDATE:false']::text[]
        and not exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = request_relation.oid
            and privilege.grantee = role.oid
        ) as requests_shelf_privileges_exact,
        coalesce((
          select pg_catalog.array_agg(
            privilege.privilege_type || ':' || privilege.is_grantable::text
            order by privilege.privilege_type
          )
          from pg_catalog.aclexplode(coalesce(
            image_relation.relacl,
            pg_catalog.acldefault('r', image_relation.relowner)
          )) privilege
          where privilege.grantee = role.oid
        ), array[]::text[]) = array['DELETE:false', 'INSERT:false', 'SELECT:false', 'UPDATE:false']::text[]
        and not exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = image_relation.oid
            and privilege.grantee = role.oid
        ) as images_shelf_privileges_exact,
        coalesce((
          select pg_catalog.array_agg(
            privilege.privilege_type || ':' || privilege.is_grantable::text
            order by privilege.privilege_type
          )
          from pg_catalog.aclexplode(coalesce(
            mutation_relation.relacl,
            pg_catalog.acldefault('r', mutation_relation.relowner)
          )) privilege
          where privilege.grantee = role.oid
        ), array[]::text[]) = array['INSERT:false', 'SELECT:false']::text[]
        and not exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = mutation_relation.oid
            and privilege.grantee = role.oid
        ) as mutations_shelf_privileges_exact,
        coalesce((
          select pg_catalog.array_agg(
            privilege.privilege_type || ':' || privilege.is_grantable::text
            order by privilege.privilege_type
          )
          from pg_catalog.aclexplode(coalesce(
            cleanup_relation.relacl,
            pg_catalog.acldefault('r', cleanup_relation.relowner)
          )) privilege
          where privilege.grantee = role.oid
        ), array[]::text[]) = array['DELETE:false', 'INSERT:false', 'SELECT:false']::text[]
        and not exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = cleanup_relation.oid
            and privilege.grantee = role.oid
        ) as cleanup_shelf_privileges_exact,
        pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'SELECT')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'INSERT')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'UPDATE')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'DELETE')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege(app_role.oid, request_relation.oid, 'MAINTAIN')
          or pg_catalog.has_any_column_privilege(app_role.oid, request_relation.oid, 'SELECT')
          or pg_catalog.has_any_column_privilege(app_role.oid, request_relation.oid, 'INSERT')
          or pg_catalog.has_any_column_privilege(app_role.oid, request_relation.oid, 'UPDATE')
          or pg_catalog.has_any_column_privilege(app_role.oid, request_relation.oid, 'REFERENCES')
          as requests_app_privileges,
        pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'SELECT')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'INSERT')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'UPDATE')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'DELETE')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege(app_role.oid, image_relation.oid, 'MAINTAIN')
          or pg_catalog.has_any_column_privilege(app_role.oid, image_relation.oid, 'SELECT')
          or pg_catalog.has_any_column_privilege(app_role.oid, image_relation.oid, 'INSERT')
          or pg_catalog.has_any_column_privilege(app_role.oid, image_relation.oid, 'UPDATE')
          or pg_catalog.has_any_column_privilege(app_role.oid, image_relation.oid, 'REFERENCES')
          as images_app_privileges,
        pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'SELECT')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'INSERT')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'UPDATE')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'DELETE')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege(app_role.oid, mutation_relation.oid, 'MAINTAIN')
          or pg_catalog.has_any_column_privilege(app_role.oid, mutation_relation.oid, 'SELECT')
          or pg_catalog.has_any_column_privilege(app_role.oid, mutation_relation.oid, 'INSERT')
          or pg_catalog.has_any_column_privilege(app_role.oid, mutation_relation.oid, 'UPDATE')
          or pg_catalog.has_any_column_privilege(app_role.oid, mutation_relation.oid, 'REFERENCES')
          as mutations_app_privileges,
        pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'SELECT')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'INSERT')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'UPDATE')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'DELETE')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege(app_role.oid, cleanup_relation.oid, 'MAINTAIN')
          or pg_catalog.has_any_column_privilege(app_role.oid, cleanup_relation.oid, 'SELECT')
          or pg_catalog.has_any_column_privilege(app_role.oid, cleanup_relation.oid, 'INSERT')
          or pg_catalog.has_any_column_privilege(app_role.oid, cleanup_relation.oid, 'UPDATE')
          or pg_catalog.has_any_column_privilege(app_role.oid, cleanup_relation.oid, 'REFERENCES')
          as cleanup_app_privileges,
        exists (
          select 1
          from pg_catalog.aclexplode(coalesce(
            request_relation.relacl,
            pg_catalog.acldefault('r', request_relation.relowner)
          )) privilege
          where privilege.grantee = 0
        ) or exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = request_relation.oid
            and privilege.grantee = 0
        ) as requests_public_privileges,
        exists (
          select 1
          from pg_catalog.aclexplode(coalesce(
            image_relation.relacl,
            pg_catalog.acldefault('r', image_relation.relowner)
          )) privilege
          where privilege.grantee = 0
        ) or exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = image_relation.oid
            and privilege.grantee = 0
        ) as images_public_privileges,
        exists (
          select 1
          from pg_catalog.aclexplode(coalesce(
            mutation_relation.relacl,
            pg_catalog.acldefault('r', mutation_relation.relowner)
          )) privilege
          where privilege.grantee = 0
        ) or exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = mutation_relation.oid
            and privilege.grantee = 0
        ) as mutations_public_privileges,
        exists (
          select 1
          from pg_catalog.aclexplode(coalesce(
            cleanup_relation.relacl,
            pg_catalog.acldefault('r', cleanup_relation.relowner)
          )) privilege
          where privilege.grantee = 0
        ) or exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = cleanup_relation.oid
            and privilege.grantee = 0
        ) as cleanup_public_privileges,
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
        pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'SELECT')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'INSERT')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'UPDATE')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'DELETE')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege(role.oid, mention_relation.oid, 'MAINTAIN')
          or pg_catalog.has_any_column_privilege(role.oid, mention_relation.oid, 'SELECT')
          or pg_catalog.has_any_column_privilege(role.oid, mention_relation.oid, 'INSERT')
          or pg_catalog.has_any_column_privilege(role.oid, mention_relation.oid, 'UPDATE')
          or pg_catalog.has_any_column_privilege(role.oid, mention_relation.oid, 'REFERENCES')
          as research_mentions_shelf_privileges,
        not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'SELECT')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'INSERT')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'UPDATE')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'DELETE')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'TRUNCATE')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'REFERENCES')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'TRIGGER')
        and not pg_catalog.has_table_privilege(app_role.oid, mention_relation.oid, 'MAINTAIN')
        and not pg_catalog.has_any_column_privilege(app_role.oid, mention_relation.oid, 'INSERT')
        and not pg_catalog.has_any_column_privilege(app_role.oid, mention_relation.oid, 'UPDATE')
        and not pg_catalog.has_any_column_privilege(app_role.oid, mention_relation.oid, 'REFERENCES')
        and not pg_catalog.has_column_privilege(
          app_role.oid, mention_relation.oid, 'request_id', 'SELECT'
        )
        and coalesce((
          select pg_catalog.array_agg(
            attribute.attname || ':' || privilege.privilege_type || ':'
              || privilege.is_grantable::text
            order by attribute.attname, privilege.privilege_type
          )
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = mention_relation.oid
            and privilege.grantee = app_role.oid
        ), array[]::text[]) = array[
          'active:SELECT:false',
          'first_seen_at:SELECT:false',
          'last_seen_at:SELECT:false',
          'task_id:SELECT:false'
        ]::text[] as research_mentions_app_privileges_exact,
        exists (
          select 1
          from pg_catalog.aclexplode(coalesce(
            mention_relation.relacl,
            pg_catalog.acldefault('r', mention_relation.relowner)
          )) privilege
          where privilege.grantee = 0
        ) or exists (
          select 1
          from pg_catalog.pg_attribute attribute
          cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
          where attribute.attrelid = mention_relation.oid
            and privilege.grantee = 0
        ) as research_mentions_public_privileges,
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
        ) as signal_bridge_shelf_execute,
        pg_catalog.has_function_privilege(
          ${CUSTOMER_SHELF_RUNTIME_ROLE},
          signal_bridge.oid,
          'EXECUTE WITH GRANT OPTION'
        ) as signal_bridge_shelf_execute_grant_option
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
      left join pg_catalog.pg_roles app_role
        on app_role.rolname = 'jelocare_app_runtime'
      where role.rolname = current_user
    `;
    if (isCustomerShelfRoleAttestationSafe(attestation)) return;
  } catch {
    // The caller receives the same fail-closed outcome for configuration,
    // catalogue, permission, and connectivity failures.
  }
  throw new Error("Customer Shelf database access is unavailable.");
}
