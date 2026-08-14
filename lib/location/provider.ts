import "server-only";

import type { LocationSuggestion } from "./model";
import { suggestNigeriaLocations as suggestWithGeoapify } from "./geoapify";
import { suggestNigeriaLocationsWithMapbox } from "./mapbox";
import { suggestNigeriaLocationsWithNominatim } from "./nominatim";

export type LocationSuggestionProvider =
  "geoapify" | "mapbox" | "openstreetmap";

export type LocationSuggestionResult = {
  suggestions: LocationSuggestion[];
  provider: LocationSuggestionProvider;
};

/**
 * Provider chain: Geoapify → Mapbox → OpenStreetMap Nominatim.
 *
 * Each provider is Nigeria-filtered and bounded to 5 suggestions. Providers
 * are tried in order when configured. If a provider fails or returns no
 * results, the next is attempted. If all fail, throws so the route can
 * return the manual-entry fallback message.
 */
export async function suggestNigerianLocations(input: {
  query: string;
  city?: string;
  state?: string;
}): Promise<LocationSuggestionResult> {
  // 1. Geoapify (when GEOAPIFY_API_KEY is set)
  if (process.env.GEOAPIFY_API_KEY?.trim()) {
    try {
      const suggestions = await suggestWithGeoapify(input);
      if (suggestions.length) return { suggestions, provider: "geoapify" };
    } catch {
      // Geoapify failed — fall through to Mapbox.
    }
  }

  // 2. Mapbox (when MAPBOX_TOKEN is set)
  if (process.env.MAPBOX_TOKEN?.trim()) {
    try {
      const suggestions = await suggestNigeriaLocationsWithMapbox(input);
      if (suggestions.length) return { suggestions, provider: "mapbox" };
    } catch {
      // Mapbox failed — fall through to Nominatim.
    }
  }

  // 3. OpenStreetMap Nominatim (keyless last resort)
  const suggestions = await suggestNigeriaLocationsWithNominatim(input);
  return { suggestions, provider: "openstreetmap" };
}
