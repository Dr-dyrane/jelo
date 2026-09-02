import type { Sql } from "postgres";

/** Serializes every runtime canonical-retailer identity read/write cell. */
export async function acquireCanonicalRetailerIdentityLock(sql: Sql) {
  await sql`
    select pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('jelocare:canonical-retailer'),
      pg_catalog.hashtext('identity-write')
    )
  `;
}
