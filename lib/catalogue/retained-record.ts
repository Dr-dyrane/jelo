import { createHash } from 'node:crypto';

export type CatalogueRetainedRecord = {
  locator: string;
  byteStart: number;
  byteEnd: number;
  sourceText: string;
  sourceFragmentSha256: string;
};

const sha256Pattern = /^[0-9a-f]{64}$/;

function normalizedEvidenceText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * A brand value is identity evidence only when the cited text is an explicit Brand, Vendor, or
 * Manufacturer field. Merely finding the same token in a description or marketing paragraph is
 * deliberately insufficient.
 */
export function sourceTextNamesCatalogueBrandField(
  sourceText: string,
  value: string,
) {
  const normalizedSourceText = normalizedEvidenceText(sourceText);
  const normalizedValue = normalizedEvidenceText(value);
  if (!normalizedValue) return false;
  return [
    'brand',
    'brand name',
    'vendor',
    'manufacturer',
    'manufacturer name',
  ].some(label => normalizedSourceText === `${label} ${normalizedValue}`);
}

export function catalogueRetainedRecordShapeValid(
  record: CatalogueRetainedRecord | undefined,
) {
  return Boolean(
    record
    && typeof record.locator === 'string'
    && record.locator.trim().length >= 3
    && Number.isSafeInteger(record.byteStart)
    && record.byteStart >= 0
    && Number.isSafeInteger(record.byteEnd)
    && record.byteEnd > record.byteStart
    && typeof record.sourceText === 'string'
    && record.sourceText.length >= 3
    && sha256Pattern.test(record.sourceFragmentSha256),
  );
}

/**
 * Reopens the exact byte range retained by a reviewer. Returning `undefined` instead of a
 * best-effort fragment is deliberate: every downstream field must be proven inside one exact
 * product/offer record, never assembled from unrelated page regions.
 */
export function verifiedCatalogueRetainedRecord(
  responseBytes: Buffer,
  record: CatalogueRetainedRecord,
) {
  if (
    !catalogueRetainedRecordShapeValid(record)
    || record.byteEnd > responseBytes.byteLength
  ) return undefined;

  const fragment = responseBytes.subarray(record.byteStart, record.byteEnd);
  if (
    fragment.toString('utf8') !== record.sourceText
    || createHash('sha256').update(fragment).digest('hex') !== record.sourceFragmentSha256
  ) return undefined;
  return fragment;
}
