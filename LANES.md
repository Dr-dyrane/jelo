# Active implementation lanes

Updated: 2026-08-14

This is the short-lived coordination board for Codex, Devin, and other agents.
`AGENTS.md` owns durable cross-agent rules. `.codex/context-system/work-ledger.md`
owns completed handbacks and release evidence. Remove completed reservations
from this file after integration instead of turning it into another history.

## Integration boundary

- Integration owner: root Codex task.
- Starting revision: `5d4902db135394bef050c9d7682f72346544c8ac`.
- Release authority: follow the existing `ship-after-gates` contract in the
  work ledger. Database mutation still requires the protected operator gate and
  production-shaped rehearsal.
- Existing catalogue edits in the main checkout are user/other-agent owned and
  excluded from this wave.

## Lane reservations

| Lane | State | Integrated scope | Explicit exclusions |
| --- | --- | --- | --- |
| Migration governance | Integrated; release gate pending | Checksummed migration ledger, strict inventory, status/repair/rehearsal/promotion tools, migration docs | Application UI and production mutation before rehearsal |
| Order lifecycle | Integrated; browser/DB gate pending | Guest/member/Ops lifecycle, notifications, tracking, delivery, returns/refunds, `0051_order_lifecycle.sql` | Other `/me` pages and catalogue evidence |
| My JeloCare experience | Integrated; browser gate pending | `/me` home, explore, shelf, routine, product, consult, locations/account visual and interaction system | `/me/orders`, payment, schema and migrations |
| Integration and release | Active | Conflict resolution, broad gates, browser E2E, migration rehearsal evidence, commit/push/deploy | Unrelated catalogue edits and user-owned campaign assets |

## Cross-agent rules

1. Read `AGENTS.md` and this file before editing.
2. Record exact paths and base before starting. An active reservation wins until
   explicitly transferred.
3. Do not edit another lane's reserved paths or stage unrelated dirty files.
4. Draft SQL belongs only in ignored `.migration-rehearsal/`; canonical SQL is
   promoted unchanged after exact-byte Neon rehearsal.
5. Never rewrite, delete, renumber, or manually bless canonical migrations or
   `schema_migrations` rows.
6. Run focused verification inside a lane and one broad integration gate after
   merge. One independent review and one bounded correction are the default.
7. Devin or another agent must update this table before beginning overlapping
   work. Completed reservations are removed after the release ledger is updated.

