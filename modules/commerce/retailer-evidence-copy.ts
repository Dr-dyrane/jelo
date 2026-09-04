import type { RetailerReference } from "@/data/retailers";
import { hasRegulatorMatch } from "@/modules/commerce/offer-evidence";

function exactOfferSummary(exactOfferCount: number) {
  if (exactOfferCount === 0) return "No fresh exact offer is public here yet.";
  if (exactOfferCount === 1)
    return "1 fresh exact offer supports the products below.";
  return `${exactOfferCount} fresh exact offers support the products below.`;
}

function retailerIdentityEvidenceLabel(retailer: RetailerReference) {
  if (retailer.reviewStatus === "provisional") {
    return "Provisional source record";
  }
  if (retailer.kind === "marketplace") {
    return "Offer checks stay listing-specific";
  }
  if (retailer.identityEvidence?.basis === "brand-source") {
    return "Named by a brand source";
  }
  if (retailer.identityEvidence?.scope === "independent") {
    return "Independent identity record";
  }
  if (retailer.identityEvidence) return "Self-published identity record";
  return "No dated identity evidence";
}

/** Keeps directory evidence provenance aligned with the retailer profile. */
export function buildRetailerDirectoryEvidenceNote(
  retailer: RetailerReference,
) {
  if (
    hasRegulatorMatch({
      reviewStatus: retailer.reviewStatus,
      contentUse: retailer.contentUse,
      identity: retailer.identityEvidence,
      regulatorMatch: retailer.regulatorMatchEvidence,
    })
  ) {
    return "Regulator number matched to an independent register.";
  }

  if (retailer.identityEvidence) {
    return `${retailerIdentityEvidenceLabel(retailer)}. No regulator match.`;
  }
  if (retailer.kind === "marketplace") {
    return "Seller identity is checked per offer when evidence exists.";
  }
  return "No identity or regulator match recorded.";
}

/**
 * Public retailer copy is projected only from the reviewed registry record and
 * current exact offers. Legacy free-text notes are intentionally excluded:
 * they can contain location, service or stock claims without a review window.
 */
export function buildRetailerProfileEvidenceCopy(
  retailer: RetailerReference,
  exactOfferCount: number,
) {
  const offerSummary = exactOfferSummary(exactOfferCount);
  const identityObservedAt = retailer.identityEvidence?.observedAt ?? null;

  if (retailer.reviewStatus === "provisional") {
    return {
      hero: `Provisional registry source. ${offerSummary}`,
      identityLabel: retailerIdentityEvidenceLabel(retailer),
      identityObservedAt,
      limit:
        "Retailer identity, contact, location and service facts remain provisional; only fresh exact offers are public.",
    };
  }

  if (retailer.kind === "marketplace") {
    return {
      hero: `Marketplace registry source. ${offerSummary}`,
      identityLabel: retailerIdentityEvidenceLabel(retailer),
      identityObservedAt,
      limit:
        "Seller identity and brand authorization apply only where an exact offer carries matching evidence.",
    };
  }

  const identityEvidence = retailer.identityEvidence;
  if (identityEvidence?.basis === "brand-source") {
    return {
      hero: `Brand-source identity recorded. ${offerSummary}`,
      identityLabel: retailerIdentityEvidenceLabel(retailer),
      identityObservedAt,
      limit:
        "A brand source recorded this retailer identity. That is not blanket authorization for every brand or listing.",
    };
  }

  if (identityEvidence?.scope === "independent") {
    return {
      hero: `Independent identity record. ${offerSummary}`,
      identityLabel: retailerIdentityEvidenceLabel(retailer),
      identityObservedAt,
      limit:
        "Retailer identity is independently recorded. Current contact, location and service facts require separate reviewed evidence.",
    };
  }

  if (identityEvidence) {
    return {
      hero: `Self-published identity recorded. ${offerSummary}`,
      identityLabel: retailerIdentityEvidenceLabel(retailer),
      identityObservedAt,
      limit:
        "Retailer identity comes from its own published details. Current contact, location and service facts require separate reviewed evidence.",
    };
  }

  return {
    hero: `Registry reference only. ${offerSummary}`,
    identityLabel: retailerIdentityEvidenceLabel(retailer),
    identityObservedAt,
    limit:
      "No dated retailer identity evidence is recorded here. Contact, location and service claims are not inferred.",
  };
}
