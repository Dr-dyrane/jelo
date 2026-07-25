// Time humanization for the operator console. Pure and server-safe.

export function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : '—';
}

// Compact relative time for triage recency: 'just now' | '5m ago' | '3h ago' |
// 'yesterday' | '2 days ago'; falls back to an absolute short date past ~30 days.
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const seconds = Math.round((now.getTime() - then) / 1000);
  const past = seconds >= 0;
  const magnitude = Math.abs(seconds);
  const phrase = (unit: string) => (past ? `${unit} ago` : `in ${unit}`);

  if (magnitude < 45) return 'just now';
  const minutes = Math.round(magnitude / 60);
  if (minutes < 60) return phrase(`${minutes}m`);
  const hours = Math.round(magnitude / 3600);
  if (hours < 24) return phrase(`${hours}h`);
  const days = Math.round(magnitude / 86400);
  if (days === 1) return past ? 'yesterday' : 'tomorrow';
  if (days <= 30) return phrase(`${days} days`);
  return shortDate(iso);
}
