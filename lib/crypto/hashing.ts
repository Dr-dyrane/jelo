import { createHash } from "node:crypto";

/**
 * Deterministic JSON serialization: object keys are sorted alphabetically,
 * undefined values are omitted, and nested structures are handled recursively.
 * This produces a stable string suitable for content-addressed hashing.
 */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined)
      throw new Error("Value contains a non-serializable member.");
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

/**
 * Content-addressed SHA-256 fingerprint of a value within a named domain.
 * The domain prefix prevents identical structures in different contexts
 * from producing the same hash.
 */
export function fingerprint(domain: string, value: unknown): string {
  return createHash("sha256")
    .update(`${domain}\n${stableJson(value)}`)
    .digest("hex");
}

/**
 * Raw SHA-256 hex digest of a string or buffer.
 */
export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
