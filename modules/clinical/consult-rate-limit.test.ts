import assert from 'node:assert/strict';
import test from 'node:test';
import { checkConsultRateLimit } from '@/lib/consult/security';

const request = new Request('https://www.jelocare.com/api/consult', {
  headers: {
    'x-forwarded-for': '203.0.113.7',
  },
});

test('consult rate limiting fails closed in production when configuration is absent', async () => {
  const decision = await checkConsultRateLimit(request, {
    limiter: null,
    environment: 'production',
  });

  assert.deepEqual(decision, {
    allowed: false,
    retryAfterSeconds: 3600,
  });
});

test('consult rate limiting permits missing local configuration only outside production', async () => {
  const decision = await checkConsultRateLimit(request, {
    limiter: null,
    environment: 'test',
  });

  assert.deepEqual(decision, {
    allowed: true,
    retryAfterSeconds: 0,
  });
});

test('consult rate limiting preserves provider allow and deny decisions', async () => {
  const reset = 1_000_000;
  const now = () => reset - 10_000;
  const allow = await checkConsultRateLimit(request, {
    limiter: {
      limit: async () => ({ success: true, reset }),
    },
    now,
  });
  const deny = await checkConsultRateLimit(request, {
    limiter: {
      limit: async () => ({ success: false, reset }),
    },
    now,
  });

  assert.equal(allow.allowed, true);
  assert.equal(deny.allowed, false);
});

test('consult rate limiting calculates a bounded Retry-After from the provider reset', async () => {
  const now = 1_000_000;
  const future = await checkConsultRateLimit(request, {
    limiter: {
      limit: async () => ({ success: false, reset: now + 5_001 }),
    },
    now: () => now,
  });
  const elapsed = await checkConsultRateLimit(request, {
    limiter: {
      limit: async () => ({ success: false, reset: now - 1 }),
    },
    now: () => now,
  });

  assert.equal(future.retryAfterSeconds, 6);
  assert.equal(elapsed.retryAfterSeconds, 1);
});

test('consult rate limiting fails closed with a short retry when its provider fails', async () => {
  let logged = false;
  const decision = await checkConsultRateLimit(request, {
    limiter: {
      limit: async () => {
        throw new Error('provider unavailable');
      },
    },
    onProviderError: () => {
      logged = true;
    },
  });

  assert.deepEqual(decision, {
    allowed: false,
    retryAfterSeconds: 60,
  });
  assert.equal(logged, true);
});
