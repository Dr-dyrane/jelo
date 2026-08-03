# ADR 0014: Customer Shelf data boundary

- **Status:** Accepted; operator activation and production evidence remain
- **Date:** 2026-08-03
- **Decision owner:** Founder
- **Extends:** [ADR 0013](0013-founder-led-jelocare-me.md)

## Outcome

JeloCare Me may persist one customer-owned Shelf row per immutable public
catalogue identity version. The launch cohort is one reviewed Umeh account plus
the explicit synthetic development preview. Synthetic Amara data remains a
server-only local fixture: it never reads from or writes to PostgreSQL.

Shelf is the only persisted JeloCare Me scope in this phase. Routine and Concern
content remains part of the local Synthetic Amara preview only; real-account
Routine and Concern data is not persisted. This decision does not introduce
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

## Database role and credential boundary

Production has three distinct database authorities:

| Authority | Location | Contract |
| --- | --- | --- |
| Protected migration administrator | Operator workstation or protected release runner only | Supplied as `MIGRATION_DATABASE_URL`; applies migrations and explicit reconciliation operators |
| `jelocare_app_runtime` | Vercel server runtime | `LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; may use the existing public application tables and sequences granted by migration `0035`, but not Shelf rows, Shelf import receipts, or the migration ledger; future tables receive no default grant |
| `jelocare_shelf_runtime` | Vercel server runtime | Same non-privileged role attributes; may use only the Shelf table and the reviewed catalogue identity columns needed by the Shelf repository |

The operator creates both runtime roles with SQL as `PASSWORD NULL`, then sets
each independent password through an interactive or equivalently protected
secret channel. Passwords never appear in SQL files, source, shell history,
logs, screenshots, chat, or evidence records. Migration
`0035_runtime_database_roles.sql` refuses absent or unsafe roles, pins their
search paths, applies and narrows grants, and creates the private one-off import
receipt table. It creates no default privileges for later tables.

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

The other nine records are explicitly rejected; ambiguous Dove identities and
records without one reviewed public binding are never force-matched. The
manifest is the canonical disposition list rather than this summary.

The importer is an explicit protected operator job, not a seed, build step, or
reusable synchronization path. It receives the target mailbox only from the
runtime `JELOCARE_SHELF_IMPORT_TARGET_MAILBOX` environment variable, resolves
exactly one verified non-banned Auth row inside the transaction, and never logs
or prints the mailbox or subject. A dry run uses a database read-only
transaction. Apply requires both `--apply` and the exact target-mailbox SHA-256
confirmation, only adds missing accepted identities, never deletes Shelf rows,
and atomically records the one-off receipt. Once the receipt exists, a rerun
reports `already-completed` and performs no inserts, so a later customer removal
cannot be silently reversed.

## Retention, export, and deletion

- Live rows remain until the customer removes an item or clears the Shelf.
- Remove and clear hard-delete live Shelf rows. There is no application trash
  or customer-restorable copy.
- The Account sheet exports a no-store JSON attachment containing the immutable
  identity version, exact reviewed snapshot, lifecycle state, save origin, and
  saved time. It contains no owner subject, email, Routine, Concern, or session
  data.
- Neon provider backups follow the configured provider retention policy. They
  are operational recovery material, not an application restore feature and
  not customer-restorable.
- Full provider-account deletion is not implemented. Do not claim that clearing
  the Shelf deletes the Auth account or that provider deletion already
  orchestrates Shelf cleanup.

Private Shelf data never enters Operations, public pages or caches, catalogue
truth, search or ranking, advertising or retailer targeting, community
research, analytics profiles, screenshots or logs, or model training.

## Release and rollback floor

Vercel builds verify, build, and may safely promote staged public assets; they
do not receive migration authority or reconcile PostgreSQL. The protected
operator provisions roles, applies migrations and reconciles public data, runs
the database acceptance audit, and performs the one-off import. The exact order
and evidence are owned by the [release process](../operations/RELEASE.md) and
[runbooks](../operations/RUNBOOKS.md#release-the-customer-shelf-boundary).

Migrations `0034` and `0035` are additive and are not down-migrated during an
application rollback. The current application has no Shelf activation flag and
no independent recovery-only export/delete mode. Disabling behavior therefore
requires a reviewed role-compatible application release; removing
`CUSTOMER_SHELF_DATABASE_URL` is only an emergency total fail-closed action and
disables Shelf list, add, remove, clear, and export together. Do not claim
export or deletion remains available after disabling that connection.

After the former database owner credential is rotated, the rollback floor is
the first application revision that accepts the restricted app and Shelf roles.
An older owner-dependent deployment is not a valid rollback target. Preserve
the schema and rows, keep the restricted credentials in place, and forward-fix
or deploy another role-compatible revision. Record the exact floor revision and
database migration ledger in the release evidence.
