function nonEmptyText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Research mentions span two context versions:
 *
 * - the original migration copied submitted selection objects;
 * - current writes store their labels directly.
 *
 * Keep the report tolerant of both shapes. In particular, never coerce a JSON
 * object with `String(value)`: that turns useful submitted language into
 * "[object Object]" (or a serialized JSON object in PostgreSQL).
 */
export function firstSubmittedBrandLabel(contextValues: unknown): string | null {
  const values = Array.isArray(contextValues) ? contextValues : [contextValues];

  for (const value of values) {
    const direct = nonEmptyText(value);
    if (direct) return direct;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const record = value as Record<string, unknown>;
    const label = nonEmptyText(record.label)
      ?? nonEmptyText(record.raw)
      ?? nonEmptyText(record.rawValue)
      ?? nonEmptyText(record.raw_value);
    if (label) return label;
  }

  return null;
}
