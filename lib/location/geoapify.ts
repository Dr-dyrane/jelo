import "server-only";

import type { LocationSuggestion } from "./model";
import { normalizeNigeriaState } from "./nigeria";

type GeoapifyFeature = {
  properties?: {
    place_id?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
};

type GeoapifyResponse = { features?: GeoapifyFeature[] };

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function mapGeoapifySuggestions(
  payload: GeoapifyResponse,
): LocationSuggestion[] {
  const seen = new Set<string>();
  const suggestions: LocationSuggestion[] = [];
  for (const [index, feature] of (payload.features ?? []).entries()) {
    const properties = feature.properties;
    if (!properties || properties.country_code?.toLowerCase() !== "ng")
      continue;
    const address = boundedText(
      properties.address_line1 || properties.formatted,
      500,
    );
    const city = boundedText(
      properties.city ||
        properties.town ||
        properties.village ||
        properties.county,
      120,
    );
    const state = normalizeNigeriaState(boundedText(properties.state, 120));
    const label = boundedText(properties.formatted, 600);
    if (!address || !city || !state || !label) continue;
    const signature = `${address}\u0000${city}\u0000${state}`.toLocaleLowerCase(
      "en",
    );
    if (seen.has(signature)) continue;
    seen.add(signature);
    suggestions.push({
      id:
        boundedText(properties.place_id, 180) ||
        `geoapify-${index}-${signature}`,
      label,
      address,
      city,
      state,
      postalCode: boundedText(properties.postcode, 20),
    });
  }
  return suggestions.slice(0, 5);
}

export function hasLocationSuggestionProvider() {
  return Boolean(process.env.GEOAPIFY_API_KEY?.trim());
}

export async function suggestNigeriaLocations(input: {
  query: string;
  city?: string;
  state?: string;
}): Promise<LocationSuggestion[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("location_provider_unavailable");
  const text = [input.query, input.city, input.state, "Nigeria"]
    .filter(Boolean)
    .join(", ");
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", text);
  url.searchParams.set("filter", "countrycode:ng");
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", "5");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("apiKey", apiKey);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("location_provider_failed");
  return mapGeoapifySuggestions((await response.json()) as GeoapifyResponse);
}
