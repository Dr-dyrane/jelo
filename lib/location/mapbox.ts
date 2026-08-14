import "server-only";

import type { LocationSuggestion } from "./model";
import { normalizeNigeriaState } from "./nigeria";

type MapboxContext = {
  street?: string;
  locality?: string;
  place?: string;
  district?: string;
  region?: string;
  postcode?: string;
  country?: { iso_alpha_2?: string; name?: string };
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  place_type?: string[];
  text?: string;
  address?: string;
  context?: MapboxContext[];
};

type MapboxResponse = { features?: MapboxFeature[] };

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function contextValue(
  context: MapboxContext[] | undefined,
  key: keyof MapboxContext,
): string {
  if (!context) return "";
  for (const item of context) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && "name" in value) {
      const name = (value as { name?: string }).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return "";
}

function isNigeria(context: MapboxContext[] | undefined): boolean {
  if (!context) return false;
  for (const item of context) {
    if (item.country?.iso_alpha_2?.toLowerCase() === "ng") return true;
  }
  return false;
}

export function mapMapboxSuggestions(
  payload: MapboxResponse,
): LocationSuggestion[] {
  const seen = new Set<string>();
  const suggestions: LocationSuggestion[] = [];
  for (const [index, feature] of (payload.features ?? []).entries()) {
    const context = feature.context;
    if (!isNigeria(context)) continue;
    const street =
      boundedText(feature.address, 300) ||
      boundedText(feature.text, 300) ||
      contextValue(context, "street");
    const city =
      contextValue(context, "locality") ||
      contextValue(context, "place") ||
      contextValue(context, "district");
    const state = normalizeNigeriaState(contextValue(context, "region"));
    const label = boundedText(feature.place_name, 600);
    if (!street || !city || !state || !label) continue;
    const signature = `${street}\u0000${city}\u0000${state}`.toLocaleLowerCase(
      "en",
    );
    if (seen.has(signature)) continue;
    seen.add(signature);
    suggestions.push({
      id: boundedText(feature.id, 180) || `mapbox-${index}-${signature}`,
      label,
      address: street,
      city,
      state,
      postalCode: boundedText(contextValue(context, "postcode"), 20),
    });
  }
  return suggestions.slice(0, 5);
}

export async function suggestNigeriaLocationsWithMapbox(input: {
  query: string;
  city?: string;
  state?: string;
}): Promise<LocationSuggestion[]> {
  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token) throw new Error("location_provider_unavailable");
  const text = [input.query, input.city, input.state, "Nigeria"]
    .filter(Boolean)
    .join(", ");
  const url = new URL(
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
      encodeURIComponent(text) +
      ".json",
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "ng");
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("types", "address,place,locality,district");
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("location_provider_failed");
  return mapMapboxSuggestions((await response.json()) as MapboxResponse);
}
