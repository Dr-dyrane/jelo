export const CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_DEFAULT_LIMIT = 20;
export const CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_MAX_LIMIT = 100;
export const CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_CONFIRMATION = 'drain-private-product-request-blobs';

const PRIVATE_PRODUCT_REQUEST_BLOB_PATH =
  /^customer-product-requests\/[a-f0-9]{32}\/[0-9a-f-]{36}\/[a-f0-9-]+\.webp$/;

export function isPrivateCustomerProductRequestBlobPathname(value: string) {
  return value.length <= 512 && PRIVATE_PRODUCT_REQUEST_BLOB_PATH.test(value);
}

function optionValue(args: readonly string[], name: string) {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name} value.`);
  return value;
}

export function parseCustomerProductRequestBlobCleanupOptions(args: readonly string[]) {
  const supported = new Set(['--apply', '--limit', '--confirm']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!supported.has(argument)) throw new Error(`Unknown cleanup option: ${argument}`);
    if (argument === '--limit' || argument === '--confirm') index += 1;
  }

  const apply = args.includes('--apply');
  const rawLimit = optionValue(args, 'limit');
  const limit = rawLimit === undefined
    ? CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_DEFAULT_LIMIT
    : Number(rawLimit);
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_MAX_LIMIT
  ) {
    throw new Error(
      `Cleanup limit must be between 1 and ${CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_MAX_LIMIT}.`,
    );
  }

  const confirmation = optionValue(args, 'confirm');
  if (apply && confirmation !== CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_CONFIRMATION) {
    throw new Error('Apply requires the exact private Blob cleanup confirmation.');
  }
  if (!apply && confirmation !== undefined) {
    throw new Error('Cleanup confirmation is accepted only with --apply.');
  }
  return { apply, limit };
}
