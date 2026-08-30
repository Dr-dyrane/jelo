import { randomUUID } from "node:crypto";
import postgres, { type Sql, type TransactionSql } from "postgres";
import {
  CUSTOMER_SHELF_RUNTIME_ROLE,
  isCustomerShelfRoleAttestationSafe,
  type CustomerShelfRoleAttestation,
} from "@/lib/customer/shelf-role-attestation";

const EXERCISE_ROLLBACK = "--exercise-rollback";

class ExpectedAuditRollback extends Error {}

const INSUFFICIENT_PRIVILEGE = "42501";
const ATTESTATION_FALSE_FIELDS = new Set<keyof CustomerShelfRoleAttestation>([
  "rolinherit",
  "rolsuper",
  "rolcreatedb",
  "rolcreaterole",
  "rolreplication",
  "rolbypassrls",
  "has_role_memberships",
  "app_has_role_memberships",
  "owns_relations",
  "shelf_app_privileges",
  "shelf_public_privileges",
  "requests_app_privileges",
  "images_app_privileges",
  "mutations_app_privileges",
  "cleanup_app_privileges",
  "requests_public_privileges",
  "images_public_privileges",
  "mutations_public_privileges",
  "cleanup_public_privileges",
  "routines_app_privileges",
  "routine_steps_app_privileges",
  "routines_public_privileges",
  "routine_steps_public_privileges",
  "concerns_app_privileges",
  "concerns_public_privileges",
  "research_mentions_shelf_privileges",
  "research_mentions_public_privileges",
  "signal_bridge_public_execute",
  "signal_bridge_app_execute",
  "signal_bridge_shelf_execute_grant_option",
]);

function customerShelfAuditUrl() {
  const candidate = process.env.CUSTOMER_SHELF_DATABASE_URL;
  if (!/^postgres(?:ql)?:\/\//.test(candidate ?? "")) {
    throw new Error(
      "CUSTOMER_SHELF_DATABASE_URL is required for the Shelf role audit.",
    );
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
        from pg_catalog.pg_auth_members app_membership
        where app_membership.member = app_role.oid
      ) as app_has_role_memberships,
      exists (
        select 1
        from pg_catalog.pg_class owned_relation
        where owned_relation.relowner = role.oid
      ) as owns_relations,
      shelf_relation.relrowsecurity,
      shelf_relation.relforcerowsecurity,
      coalesce((
        select pg_catalog.array_agg(
          privilege.privilege_type || ':' || privilege.is_grantable::text
          order by privilege.privilege_type
        )
        from pg_catalog.aclexplode(coalesce(
          shelf_relation.relacl,
          pg_catalog.acldefault('r', shelf_relation.relowner)
        )) privilege
        where privilege.grantee = role.oid
      ), array[]::text[]) = array['DELETE:false', 'INSERT:false', 'SELECT:false']::text[]
      and not exists (
        select 1
        from pg_catalog.pg_attribute attribute
        cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
        where attribute.attrelid = shelf_relation.oid
          and privilege.grantee = role.oid
      ) as shelf_privileges_exact,
      pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'DELETE')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'TRUNCATE')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'REFERENCES')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'TRIGGER')
        or pg_catalog.has_table_privilege(app_role.oid, shelf_relation.oid, 'MAINTAIN')
        or pg_catalog.has_any_column_privilege(app_role.oid, shelf_relation.oid, 'SELECT')
        or pg_catalog.has_any_column_privilege(app_role.oid, shelf_relation.oid, 'INSERT')
        or pg_catalog.has_any_column_privilege(app_role.oid, shelf_relation.oid, 'UPDATE')
        or pg_catalog.has_any_column_privilege(app_role.oid, shelf_relation.oid, 'REFERENCES')
        as shelf_app_privileges,
      exists (
        select 1
        from pg_catalog.aclexplode(coalesce(
          shelf_relation.relacl,
          pg_catalog.acldefault('r', shelf_relation.relowner)
        )) privilege
        where privilege.grantee = 0
      ) or exists (
        select 1
        from pg_catalog.pg_attribute attribute
        cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
        where attribute.attrelid = shelf_relation.oid
          and privilege.grantee = 0
      ) as shelf_public_privileges,
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
      concern_relation.relrowsecurity as concerns_relrowsecurity,
      concern_relation.relforcerowsecurity as concerns_relforcerowsecurity,
      coalesce((
        select pg_catalog.array_agg(
          privilege.privilege_type || ':' || privilege.is_grantable::text
          order by privilege.privilege_type
        )
        from pg_catalog.aclexplode(coalesce(
          concern_relation.relacl,
          pg_catalog.acldefault('r', concern_relation.relowner)
        )) privilege
        where privilege.grantee = role.oid
      ), array[]::text[]) = array['INSERT:false', 'SELECT:false', 'UPDATE:false']::text[]
      and not exists (
        select 1
        from pg_catalog.pg_attribute attribute
        cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
        where attribute.attrelid = concern_relation.oid
          and privilege.grantee = role.oid
      ) as concerns_shelf_privileges_exact,
      pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'DELETE')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'TRUNCATE')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'REFERENCES')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'TRIGGER')
        or pg_catalog.has_table_privilege(app_role.oid, concern_relation.oid, 'MAINTAIN')
        or pg_catalog.has_any_column_privilege(app_role.oid, concern_relation.oid, 'SELECT')
        or pg_catalog.has_any_column_privilege(app_role.oid, concern_relation.oid, 'INSERT')
        or pg_catalog.has_any_column_privilege(app_role.oid, concern_relation.oid, 'UPDATE')
        or pg_catalog.has_any_column_privilege(app_role.oid, concern_relation.oid, 'REFERENCES')
        as concerns_app_privileges,
      exists (
        select 1
        from pg_catalog.aclexplode(coalesce(
          concern_relation.relacl,
          pg_catalog.acldefault('r', concern_relation.relowner)
        )) privilege
        where privilege.grantee = 0
      ) or exists (
        select 1
        from pg_catalog.pg_attribute attribute
        cross join lateral pg_catalog.aclexplode(attribute.attacl) privilege
        where attribute.attrelid = concern_relation.oid
          and privilege.grantee = 0
      ) as concerns_public_privileges,
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
    left join pg_catalog.pg_class concern_relation
      on concern_relation.oid = pg_catalog.to_regclass('public.customer_concerns')
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
  if (!isCustomerShelfRoleAttestationSafe(attestation)) {
    const failedFields = attestation
      ? (
          Object.entries(attestation) as [
            keyof CustomerShelfRoleAttestation,
            boolean,
          ][]
        )
          .filter(
            ([field, value]) => value !== !ATTESTATION_FALSE_FIELDS.has(field),
          )
          .map(([field]) => field)
      : ["missing_attestation"];
    console.error(
      `Customer Shelf role audit failed fields=${failedFields.join(",")}.`,
    );
    throw new Error("Customer Shelf role audit failed.");
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
  await sql.begin("read only", async (transaction) => {
    await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
    const [state] = await transaction<
      {
        customer_subject: string | null;
        visible_count: number;
        visible_request_count: number;
        visible_image_count: number;
        visible_mutation_count: number;
        visible_cleanup_count: number;
        visible_routine_count: number;
        visible_concern_count: number;
      }[]
    >`
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
          from public.customer_product_requests
        ) as visible_request_count,
        (
          select pg_catalog.count(*)::integer
          from public.customer_product_request_images
        ) as visible_image_count,
        (
          select pg_catalog.count(*)::integer
          from public.customer_product_request_mutations
        ) as visible_mutation_count,
        (
          select pg_catalog.count(*)::integer
          from public.customer_product_request_blob_cleanup
        ) as visible_cleanup_count,
        (
          select pg_catalog.count(*)::integer
          from public.customer_routines
        ) as visible_routine_count,
        (
          select pg_catalog.count(*)::integer
          from public.customer_concerns
        ) as visible_concern_count
    `;
    if (
      state?.customer_subject !== null ||
      state.visible_count !== 0 ||
      state.visible_request_count !== 0 ||
      state.visible_image_count !== 0 ||
      state.visible_mutation_count !== 0 ||
      state.visible_cleanup_count !== 0 ||
      state.visible_routine_count !== 0 ||
      state.visible_concern_count !== 0
    ) {
      throw new Error("Customer Shelf pooled subject reset audit failed.");
    }
  });
}

async function exercisePooledSubjectReset(sql: Sql) {
  const probeOwner = `shelf-role-audit:${randomUUID()}`;
  await sql.begin("read only", async (transaction) => {
    await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
    await transaction`select pg_catalog.set_config('app.customer_subject', ${probeOwner}, true)`;
    const [state] = await transaction<{ customer_subject: string | null }[]>`
      select pg_catalog.current_setting('app.customer_subject', true) as customer_subject
    `;
    if (state?.customer_subject !== probeOwner) {
      throw new Error("Customer Shelf transaction-local subject audit failed.");
    }
  });
  await assertNoPooledSubjectOrVisibleShelfRows(sql);
}

async function recordRequestMutation(
  transaction: TransactionSql,
  mutation: {
    owner: string;
    idempotencyKey: string;
    requestId: string;
    operation:
      | "create"
      | "update"
      | "consent_revoke"
      | "submit"
      | "withdraw"
      | "image_replace";
    fingerprint: string;
    resultRevision: number;
  },
) {
  return transaction<{ result_revision: number }[]>`
    insert into public.customer_product_request_mutations (
      owner_subject,
      idempotency_key,
      request_id,
      operation,
      request_fingerprint_sha256,
      result_revision
    ) values (
      ${mutation.owner},
      ${mutation.idempotencyKey},
      ${mutation.requestId},
      ${mutation.operation},
      ${mutation.fingerprint},
      ${mutation.resultRevision}
    )
    on conflict (owner_subject, idempotency_key) do nothing
    returning result_revision
  `;
}

async function exercisePrivateRequestLifecycle(
  transaction: TransactionSql,
  ownerA: string,
  ownerB: string,
) {
  const requestId = randomUUID();
  const createIdempotencyKey = randomUUID();
  const blobPathname = [
    "customer-product-requests",
    randomUUID().replaceAll("-", ""),
    requestId,
    `${randomUUID()}.webp`,
  ].join("/");
  const normalizedEntityRef = `custom:audit-${randomUUID()}`;

  const created = await transaction<
    {
      id: string;
      revision: number;
      photo_identification_consent: boolean;
    }[]
  >`
    insert into public.customer_product_requests (
      id,
      owner_subject,
      brand,
      full_pack_name,
      printed_size_variant,
      category,
      retailer_label,
      source_url,
      normalized_entity_ref,
      photo_identification_consent
    ) values (
      ${requestId},
      ${ownerA},
      'Audit brand',
      'Rolled-back product request',
      '50 ml',
      'Audit category',
      'Synthetic retailer',
      'https://example.invalid/private-request-audit',
      ${normalizedEntityRef},
      true
    )
    returning id, revision, photo_identification_consent
  `;
  if (
    created.length !== 1 ||
    created[0]?.id !== requestId ||
    created[0].revision !== 0 ||
    !created[0].photo_identification_consent
  ) {
    throw new Error("Customer product request create audit failed.");
  }

  const createMutation = {
    owner: ownerA,
    idempotencyKey: createIdempotencyKey,
    requestId,
    operation: "create" as const,
    fingerprint: "a".repeat(64),
    resultRevision: 0,
  };
  const firstCreateMutation = await recordRequestMutation(
    transaction,
    createMutation,
  );
  const replayedCreateMutation = await recordRequestMutation(
    transaction,
    createMutation,
  );
  if (firstCreateMutation.length !== 1 || replayedCreateMutation.length !== 0) {
    throw new Error("Customer product request idempotency audit failed.");
  }

  const updated = await transaction<{ revision: number }[]>`
    update public.customer_product_requests
    set full_pack_name = 'Updated rolled-back product request',
        retailer_label = 'Updated synthetic retailer',
        revision = revision + 1,
        updated_at = now()
    where owner_subject = ${ownerA}
      and id = ${requestId}
      and revision = 0
      and lifecycle_state = 'draft'
    returning revision
  `;
  const staleUpdate = await transaction<{ revision: number }[]>`
    update public.customer_product_requests
    set revision = revision + 1,
        updated_at = now()
    where owner_subject = ${ownerA}
      and id = ${requestId}
      and revision = 0
    returning revision
  `;
  if (updated[0]?.revision !== 1 || staleUpdate.length !== 0) {
    throw new Error("Customer product request optimistic update audit failed.");
  }
  const updateMutation = await recordRequestMutation(transaction, {
    owner: ownerA,
    idempotencyKey: randomUUID(),
    requestId,
    operation: "update",
    fingerprint: "b".repeat(64),
    resultRevision: 1,
  });
  if (updateMutation.length !== 1) {
    throw new Error("Customer product request update mutation audit failed.");
  }

  const insertedImage = await transaction<
    {
      request_id: string;
      media_type: string;
      byte_size: number;
      pixel_width: number;
      pixel_height: number;
    }[]
  >`
    insert into public.customer_product_request_images (
      request_id,
      owner_subject,
      blob_pathname,
      media_type,
      byte_size,
      pixel_width,
      pixel_height,
      content_sha256
    ) values (
      ${requestId},
      ${ownerA},
      ${blobPathname},
      'image/webp',
      1024,
      640,
      480,
      ${"c".repeat(64)}
    )
    returning request_id, media_type, byte_size, pixel_width, pixel_height
  `;
  if (
    insertedImage[0]?.request_id !== requestId ||
    insertedImage[0].media_type !== "image/webp" ||
    insertedImage[0].byte_size !== 1024 ||
    insertedImage[0].pixel_width !== 640 ||
    insertedImage[0].pixel_height !== 480
  ) {
    throw new Error("Customer product request image metadata audit failed.");
  }
  const imageRevision = await transaction<{ revision: number }[]>`
    update public.customer_product_requests
    set revision = revision + 1,
        updated_at = now()
    where owner_subject = ${ownerA}
      and id = ${requestId}
      and revision = 1
    returning revision
  `;
  if (imageRevision[0]?.revision !== 2) {
    throw new Error("Customer product request image revision audit failed.");
  }
  const imageMutation = await recordRequestMutation(transaction, {
    owner: ownerA,
    idempotencyKey: randomUUID(),
    requestId,
    operation: "image_replace",
    fingerprint: "c".repeat(64),
    resultRevision: 2,
  });
  if (imageMutation.length !== 1) {
    throw new Error("Customer product request image mutation audit failed.");
  }

  const consentRevoked = await transaction<
    {
      revision: number;
      photo_identification_consent: boolean;
      identity_is_preserved: boolean;
    }[]
  >`
    update public.customer_product_requests
    set photo_identification_consent = false,
        revision = revision + 1,
        updated_at = now()
    where owner_subject = ${ownerA}
      and id = ${requestId}
      and revision = 2
    returning
      revision,
      photo_identification_consent,
      brand = 'Audit brand'
        and full_pack_name = 'Updated rolled-back product request'
        and normalized_entity_ref = ${normalizedEntityRef}
        as identity_is_preserved
  `;
  if (
    consentRevoked[0]?.revision !== 3 ||
    consentRevoked[0].photo_identification_consent ||
    !consentRevoked[0].identity_is_preserved
  ) {
    throw new Error("Customer product request consent revoke audit failed.");
  }
  const consentMutation = await recordRequestMutation(transaction, {
    owner: ownerA,
    idempotencyKey: randomUUID(),
    requestId,
    operation: "consent_revoke",
    fingerprint: "d".repeat(64),
    resultRevision: 3,
  });
  if (consentMutation.length !== 1) {
    throw new Error("Customer product request consent mutation audit failed.");
  }

  const submitted = await transaction<{ revision: number }[]>`
    update public.customer_product_requests
    set lifecycle_state = 'pending',
        submitted_at = now(),
        revision = revision + 1,
        updated_at = now()
    where owner_subject = ${ownerA}
      and id = ${requestId}
      and revision = 3
      and lifecycle_state = 'draft'
    returning revision
  `;
  if (submitted[0]?.revision !== 4) {
    throw new Error("Customer product request submit audit failed.");
  }
  const submitMutation = await recordRequestMutation(transaction, {
    owner: ownerA,
    idempotencyKey: randomUUID(),
    requestId,
    operation: "submit",
    fingerprint: "e".repeat(64),
    resultRevision: 4,
  });
  if (submitMutation.length !== 1) {
    throw new Error("Customer product request submit mutation audit failed.");
  }
  await transaction`select public.sync_customer_product_request_research_signal(${requestId})`;
  await transaction`select public.sync_customer_product_request_research_signal(${requestId})`;

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
  const [ownerBVisibility] = await transaction<
    {
      requests: number;
      images: number;
      mutations: number;
      cleanup: number;
    }[]
  >`
    select
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_requests
        where owner_subject = ${ownerA}
      ) as requests,
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_request_images
        where owner_subject = ${ownerA}
      ) as images,
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_request_mutations
        where owner_subject = ${ownerA}
      ) as mutations,
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_request_blob_cleanup
        where owner_subject = ${ownerA}
      ) as cleanup
  `;
  if (
    ownerBVisibility?.requests !== 0 ||
    ownerBVisibility.images !== 0 ||
    ownerBVisibility.mutations !== 0 ||
    ownerBVisibility.cleanup !== 0
  ) {
    throw new Error("Customer product request read isolation audit failed.");
  }
  const crossOwnerRequestUpdate = await transaction<{ id: string }[]>`
    update public.customer_product_requests
    set revision = revision + 1
    where owner_subject = ${ownerA}
      and id = ${requestId}
    returning id
  `;
  const crossOwnerImageDelete = await transaction<{ request_id: string }[]>`
    delete from public.customer_product_request_images
    where owner_subject = ${ownerA}
      and request_id = ${requestId}
    returning request_id
  `;
  if (
    crossOwnerRequestUpdate.length !== 0 ||
    crossOwnerImageDelete.length !== 0
  ) {
    throw new Error(
      "Customer product request mutation isolation audit failed.",
    );
  }
  await expectPrivilegeDenial(
    transaction,
    "forged request insert",
    (savepoint) => savepoint`
    insert into public.customer_product_requests (
      owner_subject,
      brand,
      full_pack_name,
      printed_size_variant,
      normalized_entity_ref
    ) values (
      ${ownerA},
      'Forged audit brand',
      'Forged audit product',
      '10 ml',
      ${`custom:audit-${randomUUID()}`}
    )
  `,
  );

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
  const deletedImage = await transaction<
    { request_id: string; blob_pathname: string }[]
  >`
    delete from public.customer_product_request_images
    where owner_subject = ${ownerA}
      and request_id = ${requestId}
    returning request_id, blob_pathname
  `;
  if (
    deletedImage[0]?.request_id !== requestId ||
    deletedImage[0].blob_pathname !== blobPathname
  ) {
    throw new Error("Customer product request image removal audit failed.");
  }
  const queuedCleanup = await transaction<{ request_id: string }[]>`
    insert into public.customer_product_request_blob_cleanup (
      owner_subject,
      request_id,
      blob_pathname
    ) values (${ownerA}, ${requestId}, ${deletedImage[0].blob_pathname})
    returning request_id
  `;
  if (queuedCleanup[0]?.request_id !== requestId) {
    throw new Error("Customer product request cleanup enqueue audit failed.");
  }
  const withdrawn = await transaction<
    {
      revision: number;
      lifecycle_state: string;
      scrubbed: boolean;
    }[]
  >`
    update public.customer_product_requests
    set lifecycle_state = 'withdrawn',
        brand = null,
        full_pack_name = null,
        printed_size_variant = null,
        category = null,
        retailer_label = null,
        source_url = null,
        normalized_entity_ref = null,
        origin_reference = null,
        photo_identification_consent = false,
        revision = revision + 1,
        updated_at = now()
    where owner_subject = ${ownerA}
      and id = ${requestId}
      and revision = 4
    returning
      revision,
      lifecycle_state::text,
      brand is null
        and full_pack_name is null
        and printed_size_variant is null
        and category is null
        and retailer_label is null
        and source_url is null
        and normalized_entity_ref is null
        and origin_reference is null
        and photo_identification_consent = false
        as scrubbed
  `;
  if (
    withdrawn[0]?.revision !== 5 ||
    withdrawn[0].lifecycle_state !== "withdrawn" ||
    !withdrawn[0].scrubbed
  ) {
    throw new Error("Customer product request withdrawal scrub audit failed.");
  }
  const withdrawMutation = await recordRequestMutation(transaction, {
    owner: ownerA,
    idempotencyKey: randomUUID(),
    requestId,
    operation: "withdraw",
    fingerprint: "f".repeat(64),
    resultRevision: 5,
  });
  if (withdrawMutation.length !== 1) {
    throw new Error(
      "Customer product request withdrawal mutation audit failed.",
    );
  }
  await transaction`select public.sync_customer_product_request_research_signal(${requestId})`;

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
  const [ownerBCleanupVisibility] = await transaction<{ cleanup: number }[]>`
    select pg_catalog.count(*)::integer as cleanup
    from public.customer_product_request_blob_cleanup
    where owner_subject = ${ownerA}
      and request_id = ${requestId}
  `;
  const crossOwnerCleanupDelete = await transaction<{ request_id: string }[]>`
    delete from public.customer_product_request_blob_cleanup
    where owner_subject = ${ownerA}
      and request_id = ${requestId}
    returning request_id
  `;
  if (
    ownerBCleanupVisibility?.cleanup !== 0 ||
    crossOwnerCleanupDelete.length !== 0
  ) {
    throw new Error("Customer product request cleanup isolation audit failed.");
  }

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
  const [withdrawalState] = await transaction<
    {
      images: number;
      cleanup: number;
      mutations: number;
    }[]
  >`
    select
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_request_images
        where owner_subject = ${ownerA}
          and request_id = ${requestId}
      ) as images,
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_request_blob_cleanup
        where owner_subject = ${ownerA}
          and request_id = ${requestId}
      ) as cleanup,
      (
        select pg_catalog.count(*)::integer
        from public.customer_product_request_mutations
        where owner_subject = ${ownerA}
          and request_id = ${requestId}
      ) as mutations
  `;
  if (
    withdrawalState?.images !== 0 ||
    withdrawalState.cleanup !== 1 ||
    withdrawalState.mutations !== 6
  ) {
    throw new Error(
      "Customer product request withdrawal cleanup audit failed.",
    );
  }
}

async function exerciseConcernOwnerCrud(
  transaction: TransactionSql,
  ownerA: string,
  ownerB: string,
) {
  const concernId = randomUUID();
  const concernSlug = `audit-${randomUUID()}`;

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
  const ownerConcernCreate = await transaction<{ id: string }[]>`
    insert into public.customer_concerns (
      id,
      owner_subject,
      concern_slug,
      origin
    ) values (
      ${concernId},
      ${ownerA},
      ${concernSlug},
      'synthetic-development'
    )
    returning id
  `;
  if (ownerConcernCreate.length !== 1)
    throw new Error("Customer Concern owner create audit failed.");

  const ownerConcernRead = await transaction<{ count: number }[]>`
    select pg_catalog.count(*)::integer as count
    from public.customer_concerns
    where owner_subject = ${ownerA}
      and id = ${concernId}
      and removed_at is null
  `;
  if (ownerConcernRead[0]?.count !== 1)
    throw new Error("Customer Concern owner read audit failed.");

  const ownerConcernRemove = await transaction<{ id: string }[]>`
    update public.customer_concerns
    set removed_at = now()
    where owner_subject = ${ownerA}
      and id = ${concernId}
      and removed_at is null
    returning id
  `;
  if (ownerConcernRemove.length !== 1)
    throw new Error("Customer Concern owner remove audit failed.");

  const ownerConcernRestore = await transaction<{ id: string }[]>`
    update public.customer_concerns
    set removed_at = null,
        saved_at = now()
    where owner_subject = ${ownerA}
      and id = ${concernId}
      and removed_at is not null
    returning id
  `;
  if (ownerConcernRestore.length !== 1)
    throw new Error("Customer Concern owner restore audit failed.");

  await expectPrivilegeDenial(
    transaction,
    "forged concern owner insert",
    (savepoint) => savepoint`
      insert into public.customer_concerns (
        owner_subject,
        concern_slug,
        origin
      ) values (
        ${ownerB},
        ${`forged-${randomUUID()}`},
        'synthetic-development'
      )
    `,
  );

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
  const crossOwnerConcernRead = await transaction<{ count: number }[]>`
    select pg_catalog.count(*)::integer as count
    from public.customer_concerns
    where owner_subject = ${ownerA}
      and id = ${concernId}
  `;
  if (crossOwnerConcernRead[0]?.count !== 0)
    throw new Error("Customer Concern cross-owner read audit failed.");

  const crossOwnerConcernUpdate = await transaction<{ id: string }[]>`
    update public.customer_concerns
    set removed_at = now()
    where owner_subject = ${ownerA}
      and id = ${concernId}
    returning id
  `;
  if (crossOwnerConcernUpdate.length !== 0)
    throw new Error("Customer Concern cross-owner update audit failed.");

  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
  const ownerConcernClear = await transaction<{ id: string }[]>`
    update public.customer_concerns
    set removed_at = now()
    where owner_subject = ${ownerA}
      and id = ${concernId}
      and removed_at is null
    returning id
  `;
  if (ownerConcernClear.length !== 1)
    throw new Error("Customer Concern owner clear audit failed.");
}

async function assertNoRolledBackOwnerRows(
  sql: Sql,
  owners: readonly string[],
) {
  for (const owner of owners) {
    await sql.begin("read only", async (transaction) => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const [state] = await transaction<
        {
          shelf: number;
          requests: number;
          images: number;
          mutations: number;
          cleanup: number;
          routines: number;
          routine_steps: number;
          concerns: number;
        }[]
      >`
        select
          (select pg_catalog.count(*)::integer from public.customer_shelf_items) as shelf,
          (select pg_catalog.count(*)::integer from public.customer_product_requests) as requests,
          (select pg_catalog.count(*)::integer from public.customer_product_request_images) as images,
          (select pg_catalog.count(*)::integer from public.customer_product_request_mutations) as mutations,
          (select pg_catalog.count(*)::integer from public.customer_product_request_blob_cleanup) as cleanup,
          (select pg_catalog.count(*)::integer from public.customer_routines) as routines,
          (select pg_catalog.count(*)::integer from public.customer_routine_steps) as routine_steps,
          (select pg_catalog.count(*)::integer from public.customer_concerns) as concerns
      `;
      if (!state || Object.values(state).some((count) => count !== 0)) {
        throw new Error("Customer Shelf rollback verification audit failed.");
      }
    });
  }
}

async function exerciseRolledBackIsolation(sql: Sql) {
  await exercisePooledSubjectReset(sql);
  const ownerA = `shelf-role-audit:${randomUUID()}`;
  const ownerB = `shelf-role-audit:${randomUUID()}`;
  try {
    await sql.begin(async (transaction) => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await roleAttestation(transaction);
      await expectPrivilegeDenial(
        transaction,
        "private receipt access",
        (savepoint) => savepoint`
        select pg_catalog.count(*)
        from public.customer_shelf_import_receipts
      `,
      );
      const [identity] = await transaction<{ identity_version_id: string }[]>`
        select version.identity_version_id
        from public.catalogue_product_identity_versions version
        join public.products product on product.id = version.product_id
        where version.lifecycle_state = 'active'
          and product.is_published = true
        order by version.identity_version_id
        limit 1
      `;
      if (!identity)
        throw new Error(
          "Customer Shelf role audit could not resolve an active identity.",
        );

      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
      const firstAdd = await transaction<
        { product_identity_version_id: string }[]
      >`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (${ownerA}, ${identity.identity_version_id}, 'customer')
        on conflict (owner_subject, product_identity_version_id) do nothing
        returning product_identity_version_id
      `;
      if (firstAdd.length !== 1)
        throw new Error("Customer Shelf first add audit failed.");
      const duplicateAdd = await transaction<
        { product_identity_version_id: string }[]
      >`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (${ownerA}, ${identity.identity_version_id}, 'customer')
        on conflict (owner_subject, product_identity_version_id) do nothing
        returning product_identity_version_id
      `;
      if (duplicateAdd.length !== 0)
        throw new Error("Customer Shelf duplicate add audit failed.");
      const visibleToA = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_shelf_items
        where owner_subject = ${ownerA}
      `;
      if (visibleToA[0]?.count !== 1)
        throw new Error("Customer Shelf owner visibility audit failed.");

      await expectPrivilegeDenial(
        transaction,
        "forged owner insert",
        (savepoint) => savepoint`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (${ownerB}, ${identity.identity_version_id}, 'customer')
      `,
      );
      await expectPrivilegeDenial(
        transaction,
        "update privilege",
        (savepoint) => savepoint`
        update public.customer_shelf_items
        set saved_at = saved_at
        where owner_subject = ${ownerA}
          and product_identity_version_id = ${identity.identity_version_id}
      `,
      );
      await expectPrivilegeDenial(
        transaction,
        "truncate privilege",
        (savepoint) => savepoint`
        truncate table public.customer_shelf_items
      `,
      );

      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
      const visibleToB = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_shelf_items
        where owner_subject = ${ownerA}
      `;
      if (visibleToB[0]?.count !== 0)
        throw new Error("Customer Shelf isolation audit failed.");
      const forgedOwnerRows = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_shelf_items
        where owner_subject = ${ownerB}
      `;
      if (forgedOwnerRows[0]?.count !== 0)
        throw new Error("Customer Shelf forged owner isolation audit failed.");
      const crossOwnerDelete = await transaction<
        { product_identity_version_id: string }[]
      >`
        delete from public.customer_shelf_items
        where owner_subject = ${ownerA}
          and product_identity_version_id = ${identity.identity_version_id}
        returning product_identity_version_id
      `;
      if (crossOwnerDelete.length !== 0)
        throw new Error("Customer Shelf delete isolation audit failed.");

      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerA}, true)`;
      const ownerDelete = await transaction<
        { product_identity_version_id: string }[]
      >`
        delete from public.customer_shelf_items
        where owner_subject = ${ownerA}
          and product_identity_version_id = ${identity.identity_version_id}
        returning product_identity_version_id
      `;
      if (ownerDelete.length !== 1)
        throw new Error("Customer Shelf owner delete audit failed.");

      await exercisePrivateRequestLifecycle(transaction, ownerA, ownerB);

      const routineId = randomUUID();
      const routineStepId = randomUUID();
      const routineInsert = await transaction<{ id: string }[]>`
        insert into public.customer_routines (id, owner_subject, name, origin)
        values (${routineId}, ${ownerA}, 'Audit routine', 'customer')
        returning id
      `;
      if (routineInsert.length !== 1)
        throw new Error("Customer Routine create audit failed.");
      const routineStepInsert = await transaction<{ id: string }[]>`
        insert into public.customer_routine_steps (
          id, routine_id, owner_subject, position, label, instruction, reference_state
        ) values (
          ${routineStepId}, ${routineId}, ${ownerA}, 1, 'Audit step', 'Rolled back.', 'none'
        )
        returning id
      `;
      if (routineStepInsert.length !== 1)
        throw new Error("Customer Routine step create audit failed.");

      await expectPrivilegeDenial(
        transaction,
        "forged routine insert",
        (savepoint) => savepoint`
        insert into public.customer_routines (owner_subject, name, origin)
        values (${ownerB}, 'Forged routine', 'customer')
      `,
      );
      await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerB}, true)`;
      const routinesVisibleToB = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_routines
        where owner_subject = ${ownerA}
      `;
      if (routinesVisibleToB[0]?.count !== 0)
        throw new Error("Customer Routine read isolation audit failed.");
      const crossOwnerRoutineUpdate = await transaction<{ id: string }[]>`
        update public.customer_routines
        set name = 'Cross-owner update'
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (crossOwnerRoutineUpdate.length !== 0)
        throw new Error("Customer Routine update isolation audit failed.");
      const crossOwnerRoutineDelete = await transaction<{ id: string }[]>`
        delete from public.customer_routines
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (crossOwnerRoutineDelete.length !== 0)
        throw new Error("Customer Routine delete isolation audit failed.");

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
      if (ownerRoutineUpdate.length !== 1)
        throw new Error("Customer Routine owner update audit failed.");
      const ownerRoutineDelete = await transaction<{ id: string }[]>`
        delete from public.customer_routines
        where owner_subject = ${ownerA}
          and id = ${routineId}
        returning id
      `;
      if (ownerRoutineDelete.length !== 1)
        throw new Error("Customer Routine owner delete audit failed.");
      const remainingRoutineSteps = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_routine_steps
        where owner_subject = ${ownerA}
          and routine_id = ${routineId}
      `;
      if (remainingRoutineSteps[0]?.count !== 0)
        throw new Error("Customer Routine cascade audit failed.");
      await exerciseConcernOwnerCrud(transaction, ownerA, ownerB);
      throw new ExpectedAuditRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedAuditRollback)) throw error;
  }
  await assertNoRolledBackOwnerRows(sql, [ownerA, ownerB]);
  await assertNoPooledSubjectOrVisibleShelfRows(sql);
}

async function main() {
  const options = process.argv.slice(2);
  if (options.some((option) => option !== EXERCISE_ROLLBACK)) {
    throw new Error(`Only ${EXERCISE_ROLLBACK} is supported.`);
  }
  const sql = postgres(customerShelfAuditUrl(), { max: 1, prepare: false });
  try {
    await roleAttestation(sql);
    if (options.includes(EXERCISE_ROLLBACK))
      await exerciseRolledBackIsolation(sql);
    console.log(
      options.includes(EXERCISE_ROLLBACK)
        ? "Customer Shelf role and rolled-back owner isolation audit passed."
        : "Customer Shelf role attestation passed.",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "unavailable";
  const routine =
    typeof error === "object" && error && "routine" in error
      ? String(error.routine)
      : "unavailable";
  console.error(
    `Customer Shelf role audit failed (code=${code}; routine=${routine}).`,
  );
  process.exitCode = 1;
});
