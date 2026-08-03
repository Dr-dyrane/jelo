import { createHash } from 'node:crypto';

export const LEGACY_SHELF_TARGET_MAILBOX_ENV = 'JELOCARE_SHELF_IMPORT_TARGET_MAILBOX';

export type LegacyShelfImportOptions = {
  apply: boolean;
  normalizedMailbox: string;
  targetConfirmationSha256: string | null;
};

export function normalizeLegacyShelfTargetMailbox(value: string | undefined): string {
  const normalized = value?.normalize('NFKC').trim().toLowerCase() ?? '';
  if (
    !normalized
    || normalized.length > 254
    || /[\p{Cc}\p{Cf}\s]/u.test(normalized)
    || !/^[^@]+@[^@]+\.[^@]+$/u.test(normalized)
  ) {
    throw new Error(`${LEGACY_SHELF_TARGET_MAILBOX_ENV} must contain one normalized mailbox.`);
  }
  return normalized;
}

export function targetMailboxConfirmationSha256(normalizedMailbox: string): string {
  return createHash('sha256').update(normalizedMailbox, 'utf8').digest('hex');
}

export function parseLegacyShelfImportOptions(
  args: readonly string[],
  environment: Record<string, string | undefined>,
): LegacyShelfImportOptions {
  const allowed = args.every(argument => (
    argument === '--apply' || argument.startsWith('--confirm-target-sha256=')
  ));
  if (!allowed) throw new Error('Only --apply and --confirm-target-sha256 are supported.');

  const normalizedMailbox = normalizeLegacyShelfTargetMailbox(
    environment[LEGACY_SHELF_TARGET_MAILBOX_ENV],
  );
  const confirmations = args
    .filter(argument => argument.startsWith('--confirm-target-sha256='))
    .map(argument => argument.slice('--confirm-target-sha256='.length));
  if (confirmations.length > 1) throw new Error('Provide one target confirmation.');
  const targetConfirmationSha256 = confirmations[0] ?? null;
  const apply = args.includes('--apply');

  if (apply) {
    const expected = targetMailboxConfirmationSha256(normalizedMailbox);
    if (targetConfirmationSha256 !== expected) {
      throw new Error('Apply requires the exact redacted target mailbox confirmation hash.');
    }
  }

  return { apply, normalizedMailbox, targetConfirmationSha256 };
}

export function selectExactlyOneVerifiedTarget(
  candidates: readonly { id: string }[],
): string {
  if (candidates.length !== 1 || !candidates[0]?.id) {
    throw new Error('Target resolution did not produce exactly one verified, active account.');
  }
  return candidates[0].id;
}
