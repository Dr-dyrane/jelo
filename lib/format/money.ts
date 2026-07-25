// Naira formatting for the operator console. Mirrors the public inline format
// (app/(ops)/ops/observations/page.tsx) so review and display never disagree.
export function money(ngn: number | null): string {
  return ngn != null ? `₦${ngn.toLocaleString('en-NG')}` : '—';
}
