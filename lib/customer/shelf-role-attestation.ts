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
  requests_relrowsecurity: boolean;
  requests_relforcerowsecurity: boolean;
  images_relrowsecurity: boolean;
  images_relforcerowsecurity: boolean;
  mutations_relrowsecurity: boolean;
  mutations_relforcerowsecurity: boolean;
  cleanup_relrowsecurity: boolean;
  cleanup_relforcerowsecurity: boolean;
  research_mentions_shelf_select: boolean;
  research_mentions_app_request_id_select: boolean;
  research_mentions_app_aggregate_select: boolean;
  signal_bridge_is_security_definer: boolean;
  signal_bridge_search_path_is_pinned: boolean;
  signal_bridge_public_execute: boolean;
  signal_bridge_app_execute: boolean;
  signal_bridge_shelf_execute: boolean;
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
    && attestation.relforcerowsecurity
    && attestation.requests_relrowsecurity
    && attestation.requests_relforcerowsecurity
    && attestation.images_relrowsecurity
    && attestation.images_relforcerowsecurity
    && attestation.mutations_relrowsecurity
    && attestation.mutations_relforcerowsecurity
    && attestation.cleanup_relrowsecurity
    && attestation.cleanup_relforcerowsecurity
    && !attestation.research_mentions_shelf_select
    && !attestation.research_mentions_app_request_id_select
    && attestation.research_mentions_app_aggregate_select
    && attestation.signal_bridge_is_security_definer
    && attestation.signal_bridge_search_path_is_pinned
    && !attestation.signal_bridge_public_execute
    && !attestation.signal_bridge_app_execute
    && attestation.signal_bridge_shelf_execute,
  );
}
