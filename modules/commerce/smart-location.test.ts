import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CustomerAccessIdentity } from "../../lib/customer/access-policy";
import { createCustomerLocationService } from "../../lib/customer/location-service";
import type { CustomerLocationRepository } from "../../lib/customer/location-repository";
import { mapGeoapifySuggestions } from "../../lib/location/geoapify";
import { mapMapboxSuggestions } from "../../lib/location/mapbox";
import { mapNominatimSuggestions } from "../../lib/location/nominatim";
import type { SavedCustomerLocation } from "../../lib/location/model";
import {
  NIGERIA_STATES,
  normalizeNigeriaState,
} from "../../lib/location/nigeria";
import { savedCustomerLocationInputSchema } from "../../lib/location/schema";

const identity = (subject: string): CustomerAccessIdentity => ({
  subject,
  email: null,
  emailVerified: true,
  name: null,
  displayName: null,
  preferredFirstName: null,
  source: "session",
});

function memoryRepository(): CustomerLocationRepository {
  const rows = new Map<string, SavedCustomerLocation[]>();
  return {
    async list(owner) {
      return rows.get(owner) ?? [];
    },
    async create(owner, input) {
      const location: SavedCustomerLocation = {
        id: `11111111-1111-4111-8111-${String((rows.get(owner)?.length ?? 0) + 1).padStart(12, "0")}`,
        label: input.label,
        kind: input.kind,
        address: input.address,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        isDefault: input.isDefault,
        revision: 1,
        updatedAt: "2026-08-13T12:00:00.000Z",
      };
      rows.set(owner, [location, ...(rows.get(owner) ?? [])]);
      return location;
    },
    async update(owner, input) {
      const current = rows.get(owner) ?? [];
      const match = current.find(
        (location) =>
          location.id === input.id && location.revision === input.revision,
      );
      if (!match) return null;
      const location = {
        ...match,
        ...input,
        revision: match.revision + 1,
        updatedAt: "2026-08-13T12:01:00.000Z",
      };
      rows.set(
        owner,
        current.map((item) => (item.id === input.id ? location : item)),
      );
      return location;
    },
    async remove(owner, id, revision) {
      const current = rows.get(owner) ?? [];
      const next = current.filter(
        (location) => location.id !== id || location.revision !== revision,
      );
      rows.set(owner, next);
      return next.length !== current.length;
    },
  };
}

test("Nigeria location inputs are bounded and use the canonical 36 states plus FCT", () => {
  assert.equal(NIGERIA_STATES.length, 37);
  assert.equal(normalizeNigeriaState("Lagos State"), "Lagos");
  assert.equal(normalizeNigeriaState("FCT"), "Federal Capital Territory");
  assert.equal(normalizeNigeriaState("Unknown"), null);
  assert.equal(
    savedCustomerLocationInputSchema.safeParse({
      label: "Home",
      kind: "delivery",
      address: "12 Adeola Odeku Street",
      city: "Lagos",
      state: "Lagos",
      postalCode: "101241",
      isDefault: true,
    }).success,
    true,
  );
  assert.equal(
    savedCustomerLocationInputSchema.safeParse({
      label: "Home",
      kind: "delivery",
      address: "12 Adeola Odeku Street",
      city: "Lagos",
      state: "Not a Nigerian state",
      isDefault: true,
    }).success,
    false,
  );
});

test("Geoapify mapping keeps only complete Nigerian suggestions and removes duplicates", () => {
  const suggestions = mapGeoapifySuggestions({
    features: [
      {
        properties: {
          place_id: "a",
          country_code: "ng",
          formatted: "12 Adeola Odeku Street, Lagos, Nigeria",
          address_line1: "12 Adeola Odeku Street",
          city: "Lagos",
          state: "Lagos State",
          postcode: "101241",
        },
      },
      {
        properties: {
          place_id: "b",
          country_code: "ng",
          formatted: "12 Adeola Odeku Street, Lagos, Nigeria",
          address_line1: "12 Adeola Odeku Street",
          city: "Lagos",
          state: "Lagos",
        },
      },
      {
        properties: {
          place_id: "c",
          country_code: "gh",
          formatted: "Accra",
          address_line1: "Accra",
          city: "Accra",
          state: "Greater Accra",
        },
      },
    ],
  });
  assert.deepEqual(suggestions, [
    {
      id: "a",
      label: "12 Adeola Odeku Street, Lagos, Nigeria",
      address: "12 Adeola Odeku Street",
      city: "Lagos",
      state: "Lagos",
      postalCode: "101241",
    },
  ]);
});

test("saved locations remain owner-isolated and use optimistic revisions", async () => {
  const service = createCustomerLocationService(memoryRepository());
  const ownerA = identity("customer:a");
  const ownerB = identity("customer:b");
  const created = await service.save(ownerA, {
    label: "Home",
    kind: "delivery",
    address: "12 Adeola Odeku Street",
    city: "Lagos",
    state: "Lagos",
    postalCode: "",
    isDefault: true,
  });
  assert.equal(created.status, "saved");
  assert.equal((await service.read(ownerA)).locations.length, 1);
  assert.equal((await service.read(ownerB)).locations.length, 0);
  const stale = await service.save(ownerA, {
    ...created.location,
    revision: 99,
  });
  assert.equal(stale.status, "conflict");
  const removed = await service.remove(
    ownerA,
    created.location!.id,
    created.location!.revision,
  );
  assert.equal(removed.status, "removed");
});

test("saved-location migration and UI preserve the private/manual-fallback boundary", () => {
  const migration = readFileSync(
    "db/migrations/0043_customer_saved_locations.sql",
    "utf8",
  );
  const route = readFileSync("app/api/locations/suggest/route.ts", "utf8");
  const fields = readFileSync(
    "components/location/smart-location-fields.tsx",
    "utf8",
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /current_setting\('app\.customer_subject', true\)/);
  assert.match(
    migration,
    /revoke all privileges on table public\.customer_saved_locations from jelocare_app_runtime/,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.customer_saved_locations to jelocare_shelf_runtime/,
  );
  assert.match(route, /sameSiteRequest/);
  assert.match(route, /private, no-store/);
  assert.match(fields, /role="combobox"/);
  assert.match(fields, /aria-activedescendant/);
  assert.match(fields, /Keep typing manually/);
  assert.match(
    fields,
    /Powered by Geoapify|OpenStreetMap contributors|© Mapbox/,
  );
});

test("Nominatim mapping keeps only complete Nigerian suggestions and removes duplicates", () => {
  const suggestions = mapNominatimSuggestions([
    {
      place_id: 1,
      display_name: "12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
      address: {
        road: "12 Adeola Odeku Street",
        suburb: "Victoria Island",
        city: "Lagos",
        state: "Lagos",
        postcode: "101241",
        country_code: "ng",
      },
    },
    {
      place_id: 2,
      display_name: "12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
      address: {
        road: "12 Adeola Odeku Street",
        suburb: "Victoria Island",
        city: "Lagos",
        state: "Lagos State",
        country_code: "ng",
      },
    },
    {
      place_id: 3,
      display_name: "Accra, Ghana",
      address: {
        road: "Independence Avenue",
        city: "Accra",
        state: "Greater Accra",
        country_code: "gh",
      },
    },
  ]);
  assert.deepEqual(suggestions, [
    {
      id: "osm-1-12 adeola odeku street, victoria island\u0000lagos\u0000lagos",
      label: "12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
      address: "12 Adeola Odeku Street, Victoria Island",
      city: "Lagos",
      state: "Lagos",
      postalCode: "101241",
    },
  ]);
});

test("Mapbox mapping keeps only complete Nigerian suggestions and removes duplicates", () => {
  const suggestions = mapMapboxSuggestions({
    features: [
      {
        id: "address-123",
        place_name: "12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
        text: "12 Adeola Odeku Street",
        address: "12 Adeola Odeku Street",
        context: [
          { locality: "Victoria Island" },
          { place: "Lagos" },
          { region: "Lagos" },
          { postcode: "101241" },
          { country: { iso_alpha_2: "NG", name: "Nigeria" } },
        ],
      },
      {
        id: "address-456",
        place_name: "12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
        text: "12 Adeola Odeku Street",
        address: "12 Adeola Odeku Street",
        context: [
          { locality: "Victoria Island" },
          { place: "Lagos" },
          { region: "Lagos State" },
          { country: { iso_alpha_2: "NG", name: "Nigeria" } },
        ],
      },
      {
        id: "address-789",
        place_name: "Independence Avenue, Accra, Ghana",
        text: "Independence Avenue",
        context: [
          { place: "Accra" },
          { region: "Greater Accra" },
          { country: { iso_alpha_2: "GH", name: "Ghana" } },
        ],
      },
    ],
  });
  assert.deepEqual(suggestions, [
    {
      id: "address-123",
      label: "12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
      address: "12 Adeola Odeku Street",
      city: "Victoria Island",
      state: "Lagos",
      postalCode: "101241",
    },
  ]);
});

test("the provider orchestrator tries Geoapify, then Mapbox, then OpenStreetMap", async () => {
  const provider = await import("../../lib/location/provider");
  assert.match(
    provider.suggestNigerianLocations.toString(),
    /geoapify|Geoapify/,
  );
  assert.match(provider.suggestNigerianLocations.toString(), /mapbox|Mapbox/i);
  assert.match(
    provider.suggestNigerianLocations.toString(),
    /nominatim|Nominatim|openstreetmap/i,
  );
});
