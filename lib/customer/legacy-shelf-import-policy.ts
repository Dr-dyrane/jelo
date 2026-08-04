import { createHash } from 'node:crypto';

export const LEGACY_SHELF_OWNER_SUBJECT_ENV = 'JELOCARE_SHELF_IMPORT_OWNER_SUBJECT';

export type LegacyShelfImportOptions = {
  apply: boolean;
  ownerSubject: string;
  targetReceiptSha256: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function normalizeLegacyShelfOwnerSubject(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!UUID.test(normalized)) {
    throw new Error(`${LEGACY_SHELF_OWNER_SUBJECT_ENV} must contain one customer subject UUID.`);
  }
  return normalized;
}

export function targetImportReceiptSha256(ownerSubject: string): string {
  return createHash('sha256')
    .update('jelocare-shelf-import-receipt-v1\0pages-v1.0\0', 'utf8')
    .update(normalizeLegacyShelfOwnerSubject(ownerSubject), 'utf8')
    .digest('hex');
}

export function parseLegacyShelfImportOptions(
  args: readonly string[],
  environment: Record<string, string | undefined>,
): LegacyShelfImportOptions {
  const allowed = args.every(argument => (
    argument === '--apply' || argument.startsWith('--confirm-receipt-sha256=')
  ));
  if (!allowed) throw new Error('Only --apply and --confirm-receipt-sha256 are supported.');

  const ownerSubject = normalizeLegacyShelfOwnerSubject(
    environment[LEGACY_SHELF_OWNER_SUBJECT_ENV],
  );
  const confirmations = args
    .filter(argument => argument.startsWith('--confirm-receipt-sha256='))
    .map(argument => argument.slice('--confirm-receipt-sha256='.length));
  if (confirmations.length > 1) throw new Error('Provide one target import receipt.');
  const targetReceiptSha256 = confirmations[0] ?? null;
  const apply = args.includes('--apply');

  if (apply && targetReceiptSha256 !== targetImportReceiptSha256(ownerSubject)) {
    throw new Error('Apply requires the exact owner-addressed import receipt hash.');
  }

  return { apply, ownerSubject, targetReceiptSha256 };
}

export function selectExactlyOneVerifiedTarget(
  candidates: readonly { id: string }[],
): string {
  if (candidates.length !== 1 || candidates[0]?.id !== candidates[0].id.trim()) {
    throw new Error('Target resolution did not produce exactly one verified, active account.');
  }
  return normalizeLegacyShelfOwnerSubject(candidates[0].id);
}
