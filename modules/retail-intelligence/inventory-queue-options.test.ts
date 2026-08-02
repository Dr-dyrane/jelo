import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseInventoryQueueOptions,
  parseInventoryWorkerOptions,
} from '@/lib/inventory/queue-options';

test('keeps the scheduled inventory queue bounded by default', () => {
  assert.deepEqual(parseInventoryQueueOptions([]), {
    force: false,
    limit: 100,
    lookaheadHours: 24,
  });
  assert.equal(parseInventoryQueueOptions(['25']).limit, 25);
});

test('requires forced refreshes to name a safe scope', () => {
  assert.throws(() => parseInventoryQueueOptions(['--force']), /must be scoped/);
  assert.deepEqual(
    parseInventoryQueueOptions(['--force', '--market', 'ng', '--limit=80', '--lookahead-hours=0']),
    { force: true, market: 'NG', limit: 80, lookaheadHours: 0 },
  );
});

test('accepts a single-product refresh and rejects malformed targets', () => {
  assert.equal(
    parseInventoryQueueOptions(['--force', '--product=cerave-foaming-facial-cleanser']).product,
    'cerave-foaming-facial-cleanser',
  );
  assert.throws(() => parseInventoryQueueOptions(['--force', '--market=NGA']), /two-letter/);
  assert.throws(() => parseInventoryQueueOptions(['--force', '--product=../other']), /canonical slug/);
});

test('scopes inventory workers to a validated market without losing the legacy limit', () => {
  assert.deepEqual(parseInventoryWorkerOptions([]), { limit: 25 });
  assert.deepEqual(parseInventoryWorkerOptions(['10', '--market', 'ng']), {
    limit: 10,
    market: 'NG',
  });
  assert.deepEqual(parseInventoryWorkerOptions(['--limit=80', '--market=US']), {
    limit: 80,
    market: 'US',
  });
  assert.throws(() => parseInventoryWorkerOptions(['10', '--limit=20']), /either positionally/);
  assert.throws(() => parseInventoryWorkerOptions(['--market=NGA']), /two-letter/);
  assert.throws(() => parseInventoryWorkerOptions(['--market=']), /requires a value/);
  assert.throws(() => parseInventoryWorkerOptions(['--market', '']), /requires a value/);
  assert.throws(() => parseInventoryWorkerOptions(['--market', 'NG', '--market=US']), /only one --market/);
  assert.throws(() => parseInventoryWorkerOptions(['--limit=10', '--limit', '20']), /only one --limit/);
  assert.throws(() => parseInventoryWorkerOptions(['--makret=NG']), /Unknown inventory worker option/);
});
