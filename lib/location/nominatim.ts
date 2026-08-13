import "server-only";

import type { LocationSuggestion } from "./model";
import { normalizeNigeriaState } from "./nigeria";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  cycleway?: string;
  residential?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

type NominatimResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
  type?: string;
  class?: string;
};

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function composeAddress(address: NominatimAddress): string {
  const parts = [
    address.road ||
      address.pedestrian ||
      address.footway ||
      address.path ||
      address.cycleway ||
      address.residential,
    address.neighbourhood || address.suburb,
  ].filter(Boolean);
  return parts.join(", ").trim();
}

function composeCity(address: NominatimAddress): string {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.city_district ||
    address.county ||
    ""
  ).trim();
}

export function mapNominatimSuggestions(
  results: NominatimResult[],
): LocationSuggestion[] {
  const seen = new Set<string>();
  const suggestions: LocationSuggestion[] = [];
  for (const [index, result] of results.entries()) {
    const address = result.address;
    if (!address || address.country_code?.toLowerCase() !== "ng") continue;
    const street = composeAddress(address);
    const city = boundedText(composeCity(address), 120);
    const state = normalizeNigeriaState(boundedText(address.state, 120));
    const label = boundedText(result.display_name, 600);
    if (!street || !city || !state || !label) continue;
    const signature = `${street}\u0000${city}\u0000${state}`.toLocaleLowerCase(
      "en",
    );
    if (seen.has(signature)) continue;
    seen.add(signature);
    suggestions.push({
      id: `osm-${result.place_id ?? index}-${signature}`,
      label,
      address: street,
      city,
      state,
      postalCode: boundedText(address.postcode, 20),
    });
  }
  return suggestions.slice(0, 5);
}

export async function suggestNigeriaLocationsWithNominatim(input: {
  query: string;
  city?: string;
  state?: string;
}): Promise<LocationSuggestion[]> {
  const text = [input.query, input.city, input.state, "Nigeria"]
    .filter(Boolean)
    .join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", text);
  url.searchParams.set("countrycodes", "ng");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "en");
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      // Nominatim usage policy requires a valid HTTP Referer or User-Agent
      // identifying the application.
      "User-Agent": "JeloCare/1.0 (https://www.jelocare.com)",
    },
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("location_provider_failed");
  return mapNominatimSuggestions((await response.json()) as NominatimResult[]);
}
