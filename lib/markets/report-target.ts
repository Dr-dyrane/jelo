import type {
  CurrentMarketFinderLocation,
  MarketFinderContext,
  MarketFinderReadModel,
  MarketFinderResearchLocation,
} from "@/lib/markets/domain";

export type MarketReportDisplayTarget =
  | {
      kind: "current";
      context: MarketFinderContext;
      location: CurrentMarketFinderLocation;
    }
  | {
      kind: "expired";
      context: MarketFinderContext;
      location: MarketFinderResearchLocation;
    };

/**
 * Selects only reportable public records. Current results retain their normal
 * detail journey; renewal is limited to named location records whose exact
 * product observation expired. Warnings and other non-current states never
 * become report targets through this public route.
 */
export function selectMarketReportDisplayTarget(
  model: MarketFinderReadModel,
  locationSlug: string,
): MarketReportDisplayTarget | null {
  if (!model.context) return null;

  if (model.state === "current") {
    const currentLocation = model.locations.find(
      (location) => location.slug === locationSlug,
    );
    if (currentLocation) {
      return {
        kind: "current",
        context: model.context,
        location: currentLocation,
      };
    }
  }

  const expiredLocation = model.researchRecords.find(
    (record): record is MarketFinderResearchLocation =>
      record.kind === "location" &&
      record.slug === locationSlug &&
      record.reason === "evidence-expired",
  );
  if (!expiredLocation) return null;

  return {
    kind: "expired",
    context: model.context,
    location: expiredLocation,
  };
}
