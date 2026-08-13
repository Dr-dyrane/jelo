# Smart delivery and saved locations

Updated: 2026-08-13
Status: Implemented locally; migration and provider configuration required before release

## Customer outcome

Guest checkout remains the primary path. A customer can type a Nigerian
delivery address manually, choose a canonical state, and optionally select a
smart address suggestion. Signing in is never required to submit an order
request.

Signed-in customers may separately keep up to eight reusable delivery or
billing locations at `/me/locations`. Checkout offers saved **delivery**
locations as a convenience. Selecting one copies its bounded display fields
into the order request; the order does not retain a link back to the private
saved-location row.

## Provider decision

JeloCare uses Geoapify Address Autocomplete through
`POST /api/locations/suggest`:

- `GEOAPIFY_API_KEY` is server-only and never appears in browser JavaScript;
- provider requests are filtered to `countrycode:ng`;
- client requests wait 500 ms after typing and begin at four characters;
- the shared Upstash boundary allows at most 4 provider requests/second
  across the application and 30 requests/minute per hashed network;
- provider and route responses use `no-store`; and
- the interface includes the required “Powered by Geoapify” attribution.

Geoapify's published free plan currently includes 3,000 credits/day, permits
limited commercial use without a card, allows up to 5 requests/second, and
provides no free-plan SLA. This is an optional enhancement, not an availability
dependency. A missing key, quota, timeout, provider error, or rate limit leaves
manual address, state, city, and postcode entry fully usable.

OpenStreetMap's public Nominatim endpoint is deliberately not used. Its public
usage policy prohibits autocomplete and asks clients not to submit personal or
confidential data.

Primary references:

- [Geoapify Address Autocomplete](https://www.geoapify.com/address-autocomplete/)
- [Geoapify pricing and attribution](https://www.geoapify.com/pricing/)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)

## Private-data boundary

`customer_saved_locations` belongs only to the authenticated customer runtime:

- owner subject is derived from the verified Neon Auth session;
- forced PostgreSQL RLS repeats the owner predicate on every read and write;
- `jelocare_app_runtime` and `PUBLIC` receive no relation privilege;
- `jelocare_shelf_runtime` receives only bounded CRUD;
- mutations accept no owner field and use optimistic revisions;
- deletion is physical, and no tombstone retains the address;
- JeloCare stores label, kind, address line, city, state, optional postcode,
  default state and timestamps—no latitude, longitude, provider place ID or
  raw provider response; and
- saved locations do not enter public routes, catalogue, analytics or campaign
  records.

The suggestion provider receives the address fragment, selected city/state
context and `Nigeria`. The UI discloses this before selection. JeloCare neither
logs nor caches provider queries in application code.

Operations continues to see only the delivery address already required by ADR 0016. No saved-location identifier, billing record, provider identifier or raw
suggestion is added to the Operations projection.

## Release sequence

1. Apply `0043_customer_saved_locations.sql` with the protected migration
   administrator.
2. Set `GEOAPIFY_API_KEY` and `LOCATION_RATE_LIMIT_SECRET` in Vercel Preview and
   Production. Confirm the existing Upstash pair is present.
3. Deploy the application revision.
4. Verify guest manual checkout with the provider disabled.
5. Verify keyboard and touch suggestion selection with the provider enabled.
6. Sign in, add/edit/default/delete both kinds at `/me/locations`, then reuse a
   delivery location at checkout.
7. Confirm a second account cannot see or mutate the first account's rows and
   confirm `/ops/orders` contains only the copied order delivery fields.

Rollback the application without dropping the table. Remove the Geoapify key
to disable suggestions immediately; manual checkout remains available.
