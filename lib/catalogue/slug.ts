/**
 * Stable URL/database segment for a catalogue brand. Keep this deliberately
 * narrow: every persisted brand path must be ASCII, lowercase, and portable.
 */
export function catalogueBrandSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
