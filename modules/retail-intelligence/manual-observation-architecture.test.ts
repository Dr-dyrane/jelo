import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const script = readFileSync(resolve(root, 'scripts/record-manual-inventory-observation.ts'), 'utf8');
const writer = readFileSync(resolve(root, 'lib/inventory/manual-observation.ts'), 'utf8');

test('manual observation stays private and separate from the fetch worker', () => {
  assert.doesNotMatch(script, /refresh-worker|processInventoryRefresh|fetch\s*\(/);
  assert.doesNotMatch(writer, /insert\s+into\s+offers/i);
  assert.doesNotMatch(writer, /^\s*match_kind\s*=/im);
  assert.doesNotMatch(writer, /is_published\s*=/i);
});

test('manual observation updates only the resolved offer and its active refresh job', () => {
  assert.match(writer, /where o\.id = \$\{offer\.id\}[\s\S]*and o\.match_kind = 'exact'/);
  assert.match(writer, /where offer_id = \$\{offer\.id\}[\s\S]*status in \('queued', 'processing'\)/);
  assert.match(writer, /verification_method = 'manual'/);
  assert.match(writer, /insert into offer_price_history/);
});
