export type RetailerPartnershipApprovalResearchBoundary = Readonly<{
  approvalEffect: "application-status-only";
  researchHandoff: "blocked";
  blocker: "community-research-requires-community-or-customer-signal";
  canonicalWrite: false;
  includesPii: false;
  publicClaim: false;
}>;

/**
 * Partnership approval validates only the private application decision. The
 * current research queue is signal-backed, so an application cannot enter it
 * until a dedicated, attributable non-community handoff contract exists.
 */
export const retailerPartnershipApprovalResearchBoundary = {
  approvalEffect: "application-status-only",
  researchHandoff: "blocked",
  blocker: "community-research-requires-community-or-customer-signal",
  canonicalWrite: false,
  includesPii: false,
  publicClaim: false,
} as const satisfies RetailerPartnershipApprovalResearchBoundary;
