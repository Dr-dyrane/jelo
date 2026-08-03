import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const script = readFileSync(resolve(root, 'scripts/record-manual-inventory-observation.ts'), 'utf8');
const writer = readFileSync(resolve(root, 'lib/inventory/manual-observation.ts'), 'utf8');
const catalogueSeed = readFileSync(resolve(root, 'scripts/seed-catalogue.ts'), 'utf8');

test('manual observation stays private and separate from the fetch worker', () => {
  assert.doesNotMatch(script, /refresh-worker|processInventoryRefresh|fetch\s*\(/);
  assert.doesNotMatch(writer, /insert\s+into\s+offers/i);
  assert.doesNotMatch(writer, /^\s*match_kind\s*=/im);
  assert.doesNotMatch(writer, /set\s+is_published\s*=/i);
});

test('manual observation updates only the resolved offer and its active refresh job', () => {
  assert.match(writer, /where o\.id = \$\{offer\.id\}[\s\S]*and o\.match_kind = 'exact'/);
  assert.match(writer, /and o\.url = \$\{offer\.url\}[\s\S]*and o\.market_code = \$\{offer\.market_code\}/);
  assert.match(writer, /p\.is_published = true/);
  assert.match(writer, /where offer_id = \$\{offer\.id\}[\s\S]*status in \('queued', 'processing'\)/);
  assert.match(writer, /verification_method = 'manual'/);
  assert.match(writer, /insert into offer_price_history/);
});

test('manual observation authority is attributable and fails closed', () => {
  assert.match(script, /const operator = await resolveManualInventoryOperator\(sql\)/);
  assert.match(script, /applyManualObservation\(sql, offer, command, operator\)/);
  assert.match(writer, /role in \('operator', 'admin'\)/);
  assert.match(writer, /insert into moderation_audit_log/);
  assert.match(writer, /\$\{operator\.auth_subject\}, 'commerce_signal', 'promote'/);
  assert.match(writer, /kind: 'manual_inventory_observation'/);
  assert.match(writer, /canonical_write, rationale, metadata/);
});

test('manual observations can select a market-specific exact offer and survive catalogue reseeds', () => {
  assert.match(writer, /o\.market_code = \$\{command\.marketCode \?\? null\}/);
  for (const field of [
    'available',
    'price_minor',
    'currency_code',
    'checked_at',
    'inventory_status',
    'verification_method',
    'verification_note',
    'last_verified_at',
    'verification_expires_at',
    'observed_title',
    'observed_size',
    'canonical_url',
  ]) {
    assert.match(
      catalogueSeed,
      new RegExp(`${field} = case when offers\\.verification_method in \\('retailer_page', 'api', 'manual'\\)`),
    );
  }
});
