export const CUSTOMER_SHELF_RUNTIME_ROLE = 'jelocare_shelf_runtime';

export type CustomerShelfRoleAttestation = {
  current_role_is_exact: boolean;
  session_role_is_exact: boolean;
  rolcanlogin: boolean;
  rolinherit: boolean;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  has_role_memberships: boolean;
  owns_relations: boolean;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
};

export function isCustomerShelfRoleAttestationSafe(
  attestation: CustomerShelfRoleAttestation | undefined,
) {
  return Boolean(
    attestation
    && attestation.current_role_is_exact
    && attestation.session_role_is_exact
    && attestation.rolcanlogin
    && !attestation.rolinherit
    && !attestation.rolsuper
    && !attestation.rolcreatedb
    && !attestation.rolcreaterole
    && !attestation.rolreplication
    && !attestation.rolbypassrls
    && !attestation.has_role_memberships
    && !attestation.owns_relations
    && attestation.relrowsecurity
    && attestation.relforcerowsecurity,
  );
}
