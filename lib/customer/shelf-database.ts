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
        shelf_relation.relforcerowsecurity
      from pg_catalog.pg_roles role
      left join pg_catalog.pg_class shelf_relation
        on shelf_relation.oid = pg_catalog.to_regclass('public.customer_shelf_items')
      where role.rolname = current_user
    `;
    if (isCustomerShelfRoleAttestationSafe(attestation)) return;
  } catch {
    // The caller receives the same fail-closed outcome for configuration,
    // catalogue, permission, and connectivity failures.
  }
  throw new Error('Customer Shelf database access is unavailable.');
}
