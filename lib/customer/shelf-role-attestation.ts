export const CUSTOMER_SHELF_RUNTIME_ROLE = "jelocare_shelf_runtime";

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
  app_has_role_memberships: boolean;
  owns_relations: boolean;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  shelf_privileges_exact: boolean;
  shelf_app_privileges: boolean;
  shelf_public_privileges: boolean;
  requests_relrowsecurity: boolean;
  requests_relforcerowsecurity: boolean;
  images_relrowsecurity: boolean;
  images_relforcerowsecurity: boolean;
  mutations_relrowsecurity: boolean;
  mutations_relforcerowsecurity: boolean;
  cleanup_relrowsecurity: boolean;
  cleanup_relforcerowsecurity: boolean;
  requests_shelf_privileges_exact: boolean;
  images_shelf_privileges_exact: boolean;
  mutations_shelf_privileges_exact: boolean;
  cleanup_shelf_privileges_exact: boolean;
  requests_app_privileges: boolean;
  images_app_privileges: boolean;
  mutations_app_privileges: boolean;
  cleanup_app_privileges: boolean;
  requests_public_privileges: boolean;
  images_public_privileges: boolean;
  mutations_public_privileges: boolean;
  cleanup_public_privileges: boolean;
  routines_relrowsecurity: boolean;
  routines_relforcerowsecurity: boolean;
  routine_steps_relrowsecurity: boolean;
  routine_steps_relforcerowsecurity: boolean;
  routines_shelf_privileges_exact: boolean;
  routine_steps_shelf_privileges_exact: boolean;
  routines_app_privileges: boolean;
  routine_steps_app_privileges: boolean;
  routines_public_privileges: boolean;
  routine_steps_public_privileges: boolean;
  concerns_relrowsecurity: boolean;
  concerns_relforcerowsecurity: boolean;
  concerns_shelf_privileges_exact: boolean;
  concerns_app_privileges: boolean;
  concerns_public_privileges: boolean;
  research_mentions_shelf_privileges: boolean;
  research_mentions_app_privileges_exact: boolean;
  research_mentions_public_privileges: boolean;
  signal_bridge_is_security_definer: boolean;
  signal_bridge_search_path_is_pinned: boolean;
  signal_bridge_public_execute: boolean;
  signal_bridge_app_execute: boolean;
  signal_bridge_shelf_execute: boolean;
  signal_bridge_shelf_execute_grant_option: boolean;
};

export function isCustomerShelfRoleAttestationSafe(
  attestation: CustomerShelfRoleAttestation | undefined,
) {
  return Boolean(
    attestation &&
    attestation.current_role_is_exact === true &&
    attestation.session_role_is_exact === true &&
    attestation.rolcanlogin === true &&
    attestation.rolinherit === false &&
    attestation.rolsuper === false &&
    attestation.rolcreatedb === false &&
    attestation.rolcreaterole === false &&
    attestation.rolreplication === false &&
    attestation.rolbypassrls === false &&
    attestation.has_role_memberships === false &&
    attestation.app_has_role_memberships === false &&
    attestation.owns_relations === false &&
    attestation.relrowsecurity === true &&
    attestation.relforcerowsecurity === true &&
    attestation.shelf_privileges_exact === true &&
    attestation.shelf_app_privileges === false &&
    attestation.shelf_public_privileges === false &&
    attestation.requests_relrowsecurity === true &&
    attestation.requests_relforcerowsecurity === true &&
    attestation.images_relrowsecurity === true &&
    attestation.images_relforcerowsecurity === true &&
    attestation.mutations_relrowsecurity === true &&
    attestation.mutations_relforcerowsecurity === true &&
    attestation.cleanup_relrowsecurity === true &&
    attestation.cleanup_relforcerowsecurity === true &&
    attestation.requests_shelf_privileges_exact === true &&
    attestation.images_shelf_privileges_exact === true &&
    attestation.mutations_shelf_privileges_exact === true &&
    attestation.cleanup_shelf_privileges_exact === true &&
    attestation.requests_app_privileges === false &&
    attestation.images_app_privileges === false &&
    attestation.mutations_app_privileges === false &&
    attestation.cleanup_app_privileges === false &&
    attestation.requests_public_privileges === false &&
    attestation.images_public_privileges === false &&
    attestation.mutations_public_privileges === false &&
    attestation.cleanup_public_privileges === false &&
    attestation.routines_relrowsecurity === true &&
    attestation.routines_relforcerowsecurity === true &&
    attestation.routine_steps_relrowsecurity === true &&
    attestation.routine_steps_relforcerowsecurity === true &&
    attestation.routines_shelf_privileges_exact === true &&
    attestation.routine_steps_shelf_privileges_exact === true &&
    attestation.routines_app_privileges === false &&
    attestation.routine_steps_app_privileges === false &&
    attestation.routines_public_privileges === false &&
    attestation.routine_steps_public_privileges === false &&
    attestation.concerns_relrowsecurity === true &&
    attestation.concerns_relforcerowsecurity === true &&
    attestation.concerns_shelf_privileges_exact === true &&
    attestation.concerns_app_privileges === false &&
    attestation.concerns_public_privileges === false &&
    attestation.research_mentions_shelf_privileges === false &&
    attestation.research_mentions_app_privileges_exact === true &&
    attestation.research_mentions_public_privileges === false &&
    attestation.signal_bridge_is_security_definer === true &&
    attestation.signal_bridge_search_path_is_pinned === true &&
    attestation.signal_bridge_public_execute === false &&
    attestation.signal_bridge_app_execute === false &&
    attestation.signal_bridge_shelf_execute === true &&
    attestation.signal_bridge_shelf_execute_grant_option === false,
  );
}
