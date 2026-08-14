# ADR 0014: Customer Shelf and Routine data boundary

- **Status:** Accepted and activated in production
- **Date:** 2026-08-03
- **Decision owner:** Founder
- **Extends:** [ADR 0013](0013-founder-led-jelocare-me.md)

> **Shipped capability baseline:** See
> [`lib/customer/customer-capabilities.ts`](../../lib/customer/customer-capabilities.ts)
> for the single authoritative record of what currently ships. This ADR owns
> the data boundary decision; it does not independently describe shipped
> feature state.

## Outcome

JeloCare Me may persist one customer-owned Shelf row per immutable public
catalogue identity version and one private `customer_product_request` when an
exact active published catalogue identity is not available. A request is never
a canonical or public product. The server checks the active published catalogue
before creation and submission; an exact normalized brand, full pack name, and
printed size/variant match is rejected in favor of the existing product.
Synthetic Amara data remains a local fixture: it never reads from or writes to
PostgreSQL.

Customer routines are also persisted as owner-scoped named lists with 1–20
ordered steps. A step stores its label and instruction plus either one exact
reviewed catalogue identity, one owner-matched private product request, or an
explicit unresolved state. An unresolved legacy reference remains the reviewed
source text and is never converted into an invented catalogue match. Concern
content remains part of the local Synthetic Amara preview only. This decision does not introduce
customer profiles or roles, notes, quantities, purchase claims,
recommendations, notifications, or a general portal schema. It changes no
inventory cron, queue, lease, observation, or manual-refresh behavior.

## Stored data and owner authority

Migration `0034_customer_shelf.sql` creates `customer_shelf_items`. A row stores
only the verified Neon Auth subject (bounded to 320 characters), an immutable
`catalogue_product_identity_versions` foreign key, the saved time, and the
bounded save origin `customer` or `legacy_pages_v1_0`. The composite
owner/version primary key makes saving idempotent. Catalogue brand, name, size,
claims, offers, images, and lifecycle truth remain catalogue-owned.

Every repository operation starts a transaction, pins the search path, attests
the Shelf runtime role, sets transaction-local `app.customer_subject`, and
repeats the owner predicate in SQL. The table has enabled and forced RLS;
missing owner context sees no rows and cannot write. Server actions accept a
public product slug or immutable saved-version ID, never an owner, and
`requireCustomer()` derives the subject.

Additions resolve only the current published active identity version. A
retirement, merge, or successor does not rewrite a saved reference: the
reviewed snapshot remains visible as changed or unavailable and remains
removable.

Migration `0036_customer_product_requests.sql` adds the separately keyed
`customer_product_requests` table. It stores bounded brand, full pack name,
printed size/variant, optional category, retailer label and HTTPS source URL,
the normalized custom entity reference, revision, lifecycle, origin, timestamps,
explicit photo-identification consent, and a nullable matched immutable identity
version. Lifecycle is `draft`, `pending`, `in_review`, `needs_info`, `matched`,
`published`, or `withdrawn`. Customer writes use optimistic revision checks and
stored idempotency keys. Delete means a durable withdrawal: it removes active
demand and private image access, disappears from owner reads, and scrubs brand,
pack, size/variant, category, retailer, URL, custom entity reference, legacy
entry reference, and consent from the owner-linked tombstone. The tombstone
retains only owner/request keys needed for RLS and retry, revision/lifecycle,
origin/timestamps, and an optional non-identifying reviewed canonical match.
Before deletion, matching or publication never rewrites or silently substitutes
the original request.

The request, image metadata, mutation, and cleanup tables all have enabled and
forced owner RLS. Routes derive the customer subject from the verified server
session and their strict bodies reject any owner field. The research-mention
bridge table is instead a privileged internal, de-identified relation: it has
no owner subject or private request fields, no direct table grant to PUBLIC or
`jelocare_shelf_runtime`, and grants `jelocare_app_runtime` only the aggregate
columns `task_id`, `active`, `first_seen_at`, and `last_seen_at`. The app runtime
cannot select its private `request_id` linkage.

Migration `0037_customer_routines.sql` adds `customer_routines` and
`customer_routine_steps`. Both relations repeat the owner subject, enforce the
owner/routine composite foreign key, enable and force RLS, and use the same
transaction-local subject as Shelf. Create and update write every ordered step
inside one transaction; update uses an optimistic revision and delete cascades
only through the selected owner's routine. Server actions accept routine data,
an opaque routine ID, and revision, never an owner.

## Database role and credential boundary

Production has three distinct database authorities:

| Authority | Location | Contract |
| --- | --- | --- |
| Protected migration administrator | Operator workstation or protected release runner only | Supplied as `MIGRATION_DATABASE_URL`; applies migrations and explicit reconciliation operators |
| `jelocare_app_runtime` | Vercel server runtime | `LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; may use the existing public application tables and sequences granted by migration `0035`, but not Shelf rows, Shelf import receipts, or the migration ledger; future tables receive no default grant |
| `jelocare_shelf_runtime` | Vercel server runtime | Same non-privileged role attributes; may use only owner-isolated Shelf/request/image/idempotency/cleanup/routine rows, reviewed catalogue identity columns, and the pinned aggregate-signal bridge |

The operator creates both runtime roles with SQL as `PASSWORD NULL`, then sets
each independent password through an interactive or equivalently protected
secret channel. Passwords never appear in SQL files, source, shell history,
logs, screenshots, chat, or evidence records. Migration
`0035_runtime_database_roles.sql` refuses absent or unsafe roles, pins their
search paths, applies and narrows grants, and creates the private one-off import
receipt table. It creates no default privileges for later tables.
Migration `0036` explicitly revokes its owner-bearing tables from the general
application runtime, exposes no request-research link directly, and grants the
Shelf runtime only the minimum table operations plus one static `SECURITY
DEFINER` bridge. Runtime attestation requires forced RLS on every new
owner-bearing relation, proves the Shelf runtime cannot select the internal
mention table, proves the app runtime cannot select `request_id` but can read
only its four aggregate columns, and requires a security-definer bridge with
pinned `pg_catalog, public` search path, no PUBLIC or app-runtime execute grant,
and an explicit Shelf-runtime execute grant.
Migration `0037` narrows routine access to exact Shelf-runtime CRUD. Runtime
attestation additionally requires forced RLS on both routine relations, the
exact expected Shelf-runtime table privileges, and no app-runtime or PUBLIC
table or column privilege.

Production runtime code also fails closed unless the general connection names
the exact `jelocare_app_runtime` user and the Shelf connection attests the exact
`jelocare_shelf_runtime` current and session role. The Shelf attestation rejects
inheritance, elevated role attributes, the runtime role belonging to any other
role, relation ownership, or a table without enabled and forced RLS. PostgreSQL
17 may grant the creating administrator membership *in* a newly created role;
that incoming administration edge is allowed. It does not let an owner
masquerade as the Shelf runtime because attestation requires both
`session_user` and `current_user` to be the exact runtime login.

No database owner or migration-administrator credential may exist in Vercel.
`DATABASE_URL` (and any retained `POSTGRES_URL` compatibility alias) may resolve
only to `jelocare_app_runtime`; `CUSTOMER_SHELF_DATABASE_URL` may resolve only to
`jelocare_shelf_runtime`. Delete unused provider-generated aliases rather than
leaving an owner URL reconstructable from `POSTGRES_*`, `PG*`, or other split
fields. `MIGRATION_DATABASE_URL` belongs only at the protected operator/release
boundary.

## Reviewed Umeh import

The checked-in `pages-v1.0` manifest contains no mailbox or owner subject. It is
bound to source commit `04c45c87db839d516d0dc91cf93ac690445a9949`, products
hash `17d6d7173dc2a724eaad873afbc43b5b1b325ea87baa3e4faa922214c73b89f3`,
and routine-components hash
`3326dd88e087807ec11223755364ef04aebe2cb61ff65c5021e8211a3d01fe6f`.
All 14 historical product records have exactly one disposition. Five exact
brand/name/size tuples are accepted:

| Legacy ID | Exact reviewed product |
| --- | --- |
| `cosrx` | COSRX · Salicylic Acid Daily Gentle Cleanser · 150 ml |
| `somebymi` | SOME BY MI · AHA·BHA·PHA 30 Days Miracle Toner · 150 ml |
| `anua` | ANUA · Niacinamide 10% + TXA 4% Serum · 30 ml |
| `wonder` | FACE FACTS · Wonder Cream Fragrance Free · 50 ml |
| `ogx` | OGX · Renewing + Argan Oil of Morocco Extra Penetrating Oil · 100 ml |

The other nine records become private pending product requests. Ambiguous Dove
identities and records without one reviewed public binding are never
force-matched or promoted to catalogue truth. Their exact legacy text and
`pages-v1.0` provenance remain attached to the private request until a reviewed
resolution. The manifest is the canonical 5 accepted / 9 pending disposition
list rather than this summary.

The same hash-pinned manifest contains exactly three routines and eleven
ordered steps: Morning (4), Evening (3), and Hair wash (4). Single exact
references bind to one of the five reviewed identities or nine private pending
requests. Generic or multi-product source language remains `unresolved` while
preserving its exact label and instruction.

The development preview projects those records into the bounded request view
model on the server only. Client modules receive sanitized view-model values;
they never import the manifest or fixture, so a production client bundle cannot
carry the nine private identities or retailer URLs.

The importer is an explicit protected operator job, not a seed, build step, or
reusable synchronization path. It is addressed by the verified Auth subject UUID
from `JELOCARE_SHELF_IMPORT_OWNER_SUBJECT`, never by a hard-coded or queried
mailbox. It resolves exactly that verified non-banned Auth row inside the
transaction and never logs or prints the subject. A dry run uses a database
read-only transaction. Apply requires both `--apply` and the exact
owner-addressed `--confirm-receipt-sha256` value, only adds the five reviewed
identities, nine deterministic pending requests, three routines, and eleven
steps, never deletes customer rows, and atomically records their 5/9/3/11
reconciliation counts. A receipt from the
earlier five-item import may advance once from pending count zero to nine; a
receipt-backed upgrade adds only the nine requests and never restores an
accepted Shelf row the customer removed after the earlier import. A
receipt with Shelf/request counts but no routines may advance once to 3/11. A
fully reconciled receipt makes later reruns no-ops, so customer deletion or
withdrawal is not silently reversed.

## Narrow research exception and private photos

A submitted pending request contributes exactly one active, de-identified demand
signal to the existing private `community_research_tasks` product-identity lane.
The bridge copies only normalized brand, full pack name, and printed size/variant
identity text plus the aggregate count. It never copies owner subject, email,
request route, retailer/source details, private notes, image pathname, or image
bytes. A separate inaccessible mention link makes edits, retries, matches,
publication, and withdrawal adjust the count by delta without inflating existing
community-contribution counts. A new active demand signal reopens a completed or
dismissed task into `pending`, advances its positive `resolution_cycle`, and
clears its prior assignment, work state, next action, and current-cycle review
timestamp. Each product resolution is append-only under the composite
`(task_id, resolution_cycle)` key. Existing tasks and resolutions are backfilled
as cycle 1, so reopening never deletes or overwrites prior rationale, outcome,
reviewer, metadata, or reviewed time. The resolver checks and inserts only the
task's locked current cycle; same-cycle retries cannot duplicate evidence.
Current operational joins use the task's current cycle, while historical
Activity outcome counts may include every retained cycle. Replaying an
already-active mention does not reopen it, advance the cycle, or increment the
count, and a terminal zero-signal task stays terminal. Operations reads the
aggregate task by default, not customer/request/photo data.

An optional pack photo is stored only in private Vercel Blob after MIME and byte
limits, Sharp auto-rotation, a bounded resize, metadata/EXIF stripping, and WebP
encoding. PostgreSQL stores the private pathname, not a URL. Reads are owner
gated and no-store. Replace, remove, and request withdrawal enqueue the old
private pathname for durable deletion and retry cleanup. Upload does not imply
research permission: `photo_identification_consent` is a separate explicit
boolean, and authorized product researchers may use the photo for identification
only when it is true. A customer can revoke true consent at every non-withdrawn
lifecycle state through a dedicated optimistic, idempotent mutation that writes
no identity field; enabling consent and editing identity remain limited to the
normal editable lifecycle. This ADR grants no default Ops photo access.

Private request capacity is owner-scoped and serialized inside the same
database transaction. One owner may keep at most 12 requests in `draft`,
`pending`, `in_review`, or `needs_info`, and at most six request rows may have an
active private photo. Exact catalogue matches resolve before the request limit
and therefore do not create a request. Replacing an existing photo remains
allowed at photo capacity; a rejected newly stored Blob is deleted immediately
or entered into the durable cleanup queue. Capacity responses disclose only the
limit kind and count, use a private no-store response, and never log owner or
request contents.

Failed Blob deletion remains queued. The protected operator owns the bounded,
idempotent drain using `MIGRATION_DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`;
successful Blob deletion removes the exact queue row, while failure retains it
for a later retry and reports counts without owner subjects or pathnames. This
is not a Vercel cron and does not alter the inventory scheduled owner.

## Retention, export, and deletion

- Live rows remain until the customer removes an item or clears the Shelf.
- Remove and clear hard-delete live Shelf rows. There is no application trash
  or customer-restorable copy.
- Routine delete hard-deletes the selected owner-scoped routine and its ordered
  steps. Routine create and update do not modify Shelf or request rows.
- The Account sheet exports a no-store JSON attachment containing the immutable
  identity version, exact reviewed snapshot, lifecycle state, save origin, and
  saved time. It contains no owner subject, email, Routine, Concern, or session
  data.
- Neon provider backups follow the configured provider retention policy. They
  are operational recovery material, not an application restore feature and
  not customer-restorable.
- A customer product-request delete soft-withdraws the private record, removes
  its active aggregate signal, revokes image access, and queues its private blob
  for deletion. The bridge then deletes the owner/request research link and the
  owner-linked tombstone scrubs every submitted free-text identity and retailer
  field. The anonymous research task may retain its de-identified product
  identity history without a route back to the customer or request.
- Full provider-account deletion is not implemented. Do not claim that clearing
  the Shelf deletes the Auth account or that provider deletion already
  orchestrates Shelf cleanup.

Private Shelf data never enters public pages or caches, catalogue truth, search
or ranking, advertising or retailer targeting, analytics profiles, screenshots
or logs, or model training. The sole Operations/research exception is the
de-identified product identity text and active aggregate demand count above;
private owner, request route, retailer/source fields, and photos stay excluded
by default.

## Release and rollback floor

Vercel builds verify, build, and may safely promote staged public assets; they
do not receive migration authority or reconcile PostgreSQL. The protected
operator provisions roles, applies migrations and reconciles public data, runs
the database acceptance audit, and performs the one-off import. The exact order
and evidence are owned by the [release process](../operations/RELEASE.md) and
[runbooks](../operations/RUNBOOKS.md#release-the-customer-shelf-boundary).

Migrations `0034`, `0035`, `0036`, and `0037` are additive and are not down-migrated during an
application rollback. The current application has no Shelf activation flag and
no independent recovery-only export/delete mode. Disabling behavior therefore
requires a reviewed role-compatible application release; removing
`CUSTOMER_SHELF_DATABASE_URL` is only an emergency total fail-closed action and
disables Shelf list, add, remove, clear, export, and Routine persistence together. Do not claim
export or deletion remains available after disabling that connection.

After the former database owner credential is rotated, the rollback floor is
the first application revision that accepts the restricted app and Shelf roles.
An older owner-dependent deployment is not a valid rollback target. Preserve
the schema and rows, keep the restricted credentials in place, and forward-fix
or deploy another role-compatible revision. Record the exact floor revision and
database migration ledger in the release evidence.
