// Opaque-id humanization: a short head for display, the full value for copy.
export function idChip(id: string): { short: string; full: string } {
  return { short: id.slice(0, 8), full: id };
}
