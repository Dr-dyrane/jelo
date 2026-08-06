import assert from 'node:assert/strict';
import test from 'node:test';
import { handoffEventSchema, recordHandoffEvent } from '@/lib/analytics/handoff-events';

test('handoffEventSchema accepts valid viewed event', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'cosrx-salicylic-acid-daily-gentle-cleanser',
    retailer: 'Beauty by Daz',
    market: 'NG',
    interaction: 'viewed',
  });
  assert.ok(result.success, 'Valid viewed event should parse');
});

test('handoffEventSchema accepts valid continue event', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'US',
    interaction: 'continue',
  });
  assert.ok(result.success, 'Valid continue event should parse');
});

test('handoffEventSchema accepts valid alternative event', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'NG',
    interaction: 'alternative',
  });
  assert.ok(result.success, 'Valid alternative event should parse');
});

test('handoffEventSchema accepts valid cancelled event', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'NG',
    interaction: 'cancelled',
  });
  assert.ok(result.success, 'Valid cancelled event should parse');
});

test('handoffEventSchema rejects invalid interaction type', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'NG',
    interaction: 'invalid',
  });
  assert.ok(!result.success, 'Invalid interaction should be rejected');
});

test('handoffEventSchema rejects invalid market', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'EU',
    interaction: 'viewed',
  });
  assert.ok(!result.success, 'Invalid market should be rejected');
});

test('handoffEventSchema rejects empty product slug', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: '',
    retailer: 'Test Retailer',
    market: 'NG',
    interaction: 'viewed',
  });
  assert.ok(!result.success, 'Empty product slug should be rejected');
});

test('handoffEventSchema rejects extra fields (strict)', () => {
  const result = handoffEventSchema.safeParse({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'NG',
    interaction: 'viewed',
    extraField: 'should be rejected',
  });
  assert.ok(!result.success, 'Extra fields should be rejected');
});

test('recordHandoffEvent does not throw without database config', async () => {
  // Without Postgres config, this should be a silent no-op
  await recordHandoffEvent({
    productSlug: 'test-product',
    retailer: 'Test Retailer',
    market: 'NG',
    interaction: 'viewed',
  });
  // If it doesn't throw, the test passes
  assert.ok(true, 'recordHandoffEvent should not throw without DB config');
});
