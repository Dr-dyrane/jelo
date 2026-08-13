# ADR 0017: Private saved locations and optional geocoding

- **Status:** Accepted for implementation; protected activation pending
- **Date:** 2026-08-13
- **Decision owner:** Founder
- **Extends:** [ADR 0014](0014-customer-shelf-data-boundary.md), [ADR 0016](0016-retailer-scoped-assisted-procurement.md)

## Decision

JeloCare may store up to eight owner-isolated delivery or billing locations for
a signed-in customer. Guest checkout remains complete without an account and
without geocoding. A saved delivery location is copied into the existing
retailer-scoped order address fields only after the customer selects it; the
order does not retain a saved-location identifier.

Smart Nigerian address suggestions use Geoapify only through a same-site,
server-side proxy. The provider key is never browser-visible. The experience
must keep a manual address field, canonical Nigerian state selection and city
entry operational when the provider is absent, limited, timed out or disabled.

## Stored and disclosed data

The private relation stores owner subject, label, delivery/billing kind,
address line, city, state, optional postcode, default marker, optimistic
revision and timestamps. It stores no coordinates, provider place ID, raw
provider response or order relationship. Delete physically removes the row.

The suggestion provider receives the typed address fragment plus optional
city/state context and Nigeria. The interface discloses this before a customer
uses suggestions. JeloCare application code does not log or cache the query.

Operations keeps its existing ADR 0016 projection: the copied delivery address
needed for a quote. Operations receives no billing location, private location
ID, coordinates, provider ID or saved-location collection.

## Authority and release

`customer_saved_locations` enables and forces owner RLS. Server actions derive
the owner from Neon Auth and accept no owner field. `jelocare_app_runtime` and
PUBLIC have no privilege; `jelocare_shelf_runtime` receives bounded CRUD.

Activation requires migration `0043`, the existing restricted Shelf runtime,
the existing production Upstash pair, server-only `GEOAPIFY_API_KEY`, and the
release checks in [Smart delivery and saved locations](../commerce/SMART_LOCATIONS.md).
Removing the provider key is the immediate suggestion rollback and cannot
disable manual checkout.
