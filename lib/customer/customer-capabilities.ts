/**
 * Current capability record for JeloCare Me.
 *
 * This is the single authoritative baseline for what the customer portal
 * currently ships. Documentation files (ADR 0014, JELOCARE_ME.md, the
 * product roadmap, the production roadmap, and the dock design contract)
 * must agree with this record rather than describing shipped state
 * independently.
 *
 * The contract does not control runtime flags. Its purpose is to give
 * docs and release tests one truthful baseline.
 *
 * Update this record when a capability ships or is deliberately withdrawn.
 * Do not split the same status across multiple documents.
 */
export const customerCapabilities = {
  /** Owner-isolated Shelf persistence with immutable-version references. */
  shelfPersistence: true,
  /** Owner-isolated Routine persistence with 1–20 ordered steps. */
  routinePersistence: true,
  /** Owner-isolated private missing-product requests with lifecycle. */
  privateProductRequests: true,
  /** Explore partitions the full eligible projection without a fixed cap. */
  completeExploreProjection: true,
  /** Global report helper links to /contribute from the Account sheet. */
  globalReportHelper: true,
  /** Member Product preserves allowlisted parent through OTP. */
  memberProductOtpContinuation: true,

  /** Customer-controlled canonical Concerns are not yet shipped. */
  customerConcerns: false,
  /** Authenticated Ask Me reuses the deterministic public safety and guidance authority. */
  authenticatedGuidance: true,
  /** Guest-first, one-retailer assisted procurement with manual verified quotes. */
  assistedProcurement: true,
  /** Explicitly opted-in order-service notifications ship in-app and by email. */
  notifications: true,
  /** Owner-isolated reusable delivery and billing locations. */
  savedLocations: true,
  /** Basket/refill timing decisions are not shipped. */
  basketTiming: false,
  /** Per-owner request/upload limits are not yet enforced. */
  requestLimits: false,
  /** Private-safe telemetry is not yet implemented. */
  privateTelemetry: false,
  /** Expired-session recovery is not yet implemented. */
  sessionRecovery: false,
} as const;

export type CustomerCapabilityKey = keyof typeof customerCapabilities;
