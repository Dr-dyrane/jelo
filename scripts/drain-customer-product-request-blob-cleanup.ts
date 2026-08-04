import { del } from '@vercel/blob';
import postgres, { type TransactionSql } from 'postgres';
import {
  isPrivateCustomerProductRequestBlobPathname,
  parseCustomerProductRequestBlobCleanupOptions,
} from '@/lib/customer/product-request-cleanup-policy';
import { requireAdminDatabaseUrl } from './lib/admin-database';

type CleanupRow = {
  owner_subject: string;
  request_id: string;
  blob_pathname: string;
};

type CleanupBatchResult = {
  selected: number;
  deleted: number;
  failed: number;
};

async function applyCleanupBatch(
  transaction: TransactionSql,
  limit: number,
): Promise<CleanupBatchResult> {
  const rows = await transaction<CleanupRow[]>`
    select owner_subject, request_id, blob_pathname
    from public.customer_product_request_blob_cleanup
    order by queued_at, blob_pathname
    limit ${limit}
    for update skip locked
  `;
  let deleted = 0;
  let failed = 0;
  for (const row of rows) {
    if (!isPrivateCustomerProductRequestBlobPathname(row.blob_pathname)) {
      failed += 1;
      continue;
    }
    try {
      await del(row.blob_pathname);
      const completed = await transaction<{ blob_pathname: string }[]>`
        delete from public.customer_product_request_blob_cleanup
        where owner_subject = ${row.owner_subject}
          and request_id = ${row.request_id}
          and blob_pathname = ${row.blob_pathname}
        returning blob_pathname
      `;
      if (completed.length === 1) deleted += 1;
      else failed += 1;
    } catch {
      // The durable row is intentionally retained for a later bounded retry.
      failed += 1;
    }
  }
  return { selected: rows.length, deleted, failed };
}

async function queuedCount(sql: ReturnType<typeof postgres>) {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from public.customer_product_request_blob_cleanup
  `;
  return row?.count ?? 0;
}

async function main() {
  const options = parseCustomerProductRequestBlobCleanupOptions(process.argv.slice(2));
  const connectionString = requireAdminDatabaseUrl();
  if (options.apply && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required to apply private Blob cleanup.');
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    const eligible = await queuedCount(sql);
    if (!options.apply) {
      console.log(
        `DRY RUN: eligible=${eligible}; batch=${Math.min(eligible, options.limit)}; deleted=0; failed=0; remaining=${eligible}.`,
      );
      return;
    }

    const result = await sql.begin(transaction => applyCleanupBatch(transaction, options.limit));
    const remaining = await queuedCount(sql);
    console.log(
      `APPLIED: eligible=${eligible}; selected=${result.selected}; deleted=${result.deleted}; failed=${result.failed}; remaining=${remaining}.`,
    );
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error('Private product-request Blob cleanup failed. No owner or pathname was printed.');
  process.exitCode = 1;
});
