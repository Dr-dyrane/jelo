export type MarketPrimaryAction = {
  kind: "directions" | "contact" | "alternative" | "paused";
  label: string;
  enabled: boolean;
};

export type MarketActionLead = {
  kind: "shop" | "direction-alert";
  state:
    | "ready"
    | "purchase-report"
    | "location-lead"
    | "stale"
    | "unavailable"
    | "disputed";
  directions: readonly string[];
  actionEvidence: {
    exactProductIdentity: true;
    retailerLocationVerified: boolean;
    observationReviewed: boolean;
    usableAction: "directions" | "contact" | null;
  };
};

export function deriveMarketPrimaryAction(
  lead: MarketActionLead,
): MarketPrimaryAction {
  if (lead.kind === "direction-alert" || lead.state === "disputed") {
    return { kind: "paused", label: "Directions paused", enabled: false };
  }

  if (lead.state === "stale") {
    return {
      kind: "paused",
      label: "Evidence expired",
      enabled: false,
    };
  }

  if (lead.state === "unavailable") {
    return {
      kind: "alternative",
      label: "No travel action",
      enabled: false,
    };
  }

  const evidence = lead.actionEvidence;
  const isEligible =
    evidence.exactProductIdentity &&
    evidence.retailerLocationVerified &&
    evidence.observationReviewed &&
    evidence.usableAction;

  if (!isEligible) {
    return { kind: "paused", label: "Research record only", enabled: false };
  }

  if (evidence.usableAction === "directions" && lead.directions.length > 0) {
    return {
      kind: "directions",
      label: "View text directions",
      enabled: true,
    };
  }

  if (evidence.usableAction === "contact") {
    return {
      kind: "contact",
      label: "Contact shop",
      enabled: true,
    };
  }

  return { kind: "paused", label: "Research record only", enabled: false };
}
