# Private member role and rehearsal evidence

Date: 2026-08-13

This record captures the completed datastore portion of the JeloCare Me
protected rollout. It is evidence for the current release boundary, not a claim
that every private-member production gate is complete.

## Governing decisions

- [ADR 0013](../../adr/0013-founder-led-jelocare-me.md) and
  [ADR 0014](../../adr/0014-customer-shelf-data-boundary.md) govern this
  rollout. ADR 0012 is superseded; its former G0 and staged-member-count gates
  are not current release requirements.
- Public browsing remains account-free. Private reads and writes derive the
  owner from a verified session and use the dedicated Shelf database role.
- Database migrations are operator-only and never run in a Vercel build.

## Production evidence

- The strengthened lifecycle audit shipped in commit `ba02400` and deployment
  `dpl_6TWkQ6QN5mo1RL4zyjq9zPKFhhGo` reached READY on the production alias.
- The former `jelocare_shelf_runtime` credential appeared in transient local
  tool output. It was immediately treated as compromised, rotated and
  invalidated; the replacement was injected into the production secret without
  printing or persisting it. No credential value is retained in this record.
- The current production role attestation passed through
  `npm run customer:shelf:audit`. It verifies the exact dedicated role, forced
  RLS, table and function privileges, application-role denials, and PUBLIC
  denials covered by the audit.
- Production records migrations `0034` through `0046`, including
  `0046_fix_customer_request_signal_bridge.sql`.
- The private import receipt remains exactly one completed receipt with five
  accepted Shelf identities, nine pending private requests, three routines,
  and eleven routine steps. No owner subject or private row content was read
  into this evidence.
- Signed-out production checks at the same release returned the expected
  private no-store/noindex response for `/me` and `401` for private APIs.

## Rehearsal evidence

The existing production-shaped Neon preview branch
`br-snowy-violet-avrypoto` was used for the writable rehearsal. The exact
checked-in audit completed its forced-rollback path successfully:

```text
Customer Shelf role and rolled-back owner isolation audit passed.
```

That path exercised two random owner subjects, Shelf and Routine writes,
private request mutation replay, image metadata, consent, submission, research
signal retry, withdrawal scrub, cleanup visibility, and cross-owner denial. It
then forced rollback and verified zero rows for both synthetic owners. No
production customer row or Blob object was changed.

## Migration incident and correction

The rehearsal exposed a PostgreSQL error in the migration `0036` research
signal bridge: `pg_catalog.greatest` was resolved as a schema-qualified function
instead of the built-in SQL expression. Migration `0046` replaces only that
expression with `greatest`, while preserving the function signature, owner
check, security-definer boundary, pinned search path, and restricted grants.

Production also contained the complete `0045` schema without its migration
ledger row after an earlier non-atomic application. Before reconciliation, the
operator compared every expected column, default, constraint, foreign key,
index, owner, RLS state, and privilege against the checked-in migration. A
guarded transaction then recorded only the matching `0045` ledger row under the
same advisory lock used by the migration runner. The normal atomic runner
subsequently skipped `0045` and applied `0046` with its ledger row.

The runbook now explicitly forbids splitting a migration into auto-committed
MCP statements or manually adding a ledger row during normal operation.

## Authenticated member smoke

One isolated production smoke completed through the real email-OTP flow. It
covered a temporary Shelf add and reload, temporary Routine create/update and
delete, Shelf export initiation, an explicit dismissal of the clear-Shelf
confirmation, sign-out, and the signed-out `/me` redirect. The known
pre-existing Shelf item remained after the clean clear-cancel proof.

The first temporary Shelf removal exposed an application validation defect:
deterministic catalogue identity UUIDs can contain version and variant nibbles
outside the RFC 1-5 subset. Commit `517f59d` changed only that input validator,
and production deployment `dpl_J3AhyZhFTNoKc6XfTAmTNsStKM68` reached READY on
the public aliases. The same temporary item then removed successfully, stayed
removed in the server-rendered member state, and produced no new
`Customer Shelf removal unavailable` runtime log. No launch Shelf item was
intentionally removed by the smoke; the known pre-existing item was restored
before the final clean proof and remained present afterward.

## Remaining production gates

- Remove the remaining Vercel owner-capable Neon integration alias, preserve
  the restricted application alias, account for Preview behavior, redeploy,
  and rotate or revoke the former owner credential through a protected channel.
- Declare the accepted rollback floor after the credential-boundary release.
- Close the private-request review-to-resolution operating loop.
- Collect the minimum private-service SLO window and configure alerts and
  recovery evidence.

Until those items are complete, describe the private datastore boundary as
provisioned and rehearsed—not as a fully completed JeloCare Me production
rollout.
