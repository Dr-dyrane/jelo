import "server-only";

import type { LocationSuggestion } from "./model";
import { suggestNigeriaLocations as suggestWithGeoapify } from "./geoapify";
import { suggestNigeriaLocationsWithNominatim } from "./nominatim";

export type LocationSuggestionProvider = "geoapify" | "openstreetmap";

export type LocationSuggestionResult = {
  suggestions: LocationSuggestion[];
  provider: LocationSuggestionProvider;
};

/**
 * Tries the primary provider (Geoapify) when configured, then falls back to
 * the keyless OpenStreetMap Nominatim provider. Both are Nigeria-filtered and
 * bounded to 5 suggestions. If both fail, throws so the route can return the
 * manual-entry fallback message.
 */
export async function suggestNigerianLocations(input: {
  query: string;
  city?: string;
  state?: string;
}): Promise<LocationSuggestionResult> {
  if (process.env.GEOAPIFY_API_KEY?.trim()) {
    try {
      const suggestions = await suggestWithGeoapify(input);
      if (suggestions.length) return { suggestions, provider: "geoapify" };
      // Geoapify returned nothing — try OSM before giving up.
    } catch {
      // Geoapify failed — fall through to OSM.
    }
  }

  const suggestions = await suggestNigeriaLocationsWithNominatim(input);
  return { suggestions, provider: "openstreetmap" };
}
