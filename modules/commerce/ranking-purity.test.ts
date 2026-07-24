import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Build-time guard for ADR 0006: store ranking scores only evidence-bound signals,
// never commercial or popularity signals. Scans the ranking source so a future
// wiring mistake (reading affiliate value, /go clicks, ratings, or partner status
// back into the score) fails the build instead of silently shipping.
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'offer-selection.ts'), 'utf8');

const forbidden = [
  'affiliate', 'commission', 'margin',
  'conversion', 'clickthrough', 'clickCount', 'store_click', 'utm',
  'popularity', 'rating', 'reviewCount', 'views',
  'partnership', 'featured', 'sponsored', 'promoted',
];

test('rankOffers references no commercial or popularity signal (ADR 0006)', () => {
  for (const term of forbidden) {
    assert.ok(
      !new RegExp(`\\b${term}\\b`, 'i').test(source),
      `offer-selection.ts must not reference "${term}" — store ranking excludes commercial and popularity signals (ADR 0006)`,
    );
  }
});
