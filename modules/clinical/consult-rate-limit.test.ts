import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkConsultRateLimit } from '@/lib/consult/security';

const request = new Request('https://www.jelocare.com/api/consult', {
  headers: {
    'x-forwarded-for': '203.0.113.7',
  },
});

test('consult rate limiting fails closed in production when configuration is absent', async () => {
  const decision = await checkConsultRateLimit(request, {}, {
    limiter: null,
    environment: 'production',
  });

  assert.deepEqual(decision, {
    allowed: false,
    retryAfterSeconds: 3600,
  });
});

test('consult rate limiting permits missing local configuration only outside production', async () => {
  const decision = await checkConsultRateLimit(request, {}, {
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
  const allow = await checkConsultRateLimit(request, {}, {
    limiter: {
      limit: async () => ({ success: true, reset }),
    },
    now,
  });
  const deny = await checkConsultRateLimit(request, {}, {
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
  const future = await checkConsultRateLimit(request, {}, {
    limiter: {
      limit: async () => ({ success: false, reset: now + 5_001 }),
    },
    now: () => now,
  });
  const elapsed = await checkConsultRateLimit(request, {}, {
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
  const decision = await checkConsultRateLimit(request, {}, {
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

test('anonymous consults retain the exact existing network bucket', async () => {
  const identifiers: string[] = [];
  const secret = 'focused-test-secret';
  const decision = await checkConsultRateLimit(request, {}, {
    limiter: {
      limit: async identifier => {
        identifiers.push(identifier);
        return { success: true, reset: 1_000_000 };
      },
    },
    secret,
    now: () => 990_000,
  });

  assert.equal(decision.allowed, true);
  assert.deepEqual(identifiers, [
    `consult:${createHmac('sha256', secret).update('203.0.113.7').digest('hex')}`,
  ]);
});

test('authenticated consults require opaque network and account buckets', async () => {
  const identifiers: string[] = [];
  const accountSubject = 'verified-session-subject';
  const decision = await checkConsultRateLimit(request, { accountSubject }, {
    limiter: {
      limit: async identifier => {
        identifiers.push(identifier);
        return { success: true, reset: 1_000_000 };
      },
    },
    secret: 'focused-test-secret',
    now: () => 990_000,
  });

  assert.equal(decision.allowed, true);
  assert.equal(identifiers.length, 2);
  assert.match(identifiers[0] ?? '', /^consult:[0-9a-f]{64}$/);
  assert.match(identifiers[1] ?? '', /^consult:account:[0-9a-f]{64}$/);
  assert.equal(identifiers.some(identifier => identifier.includes(accountSubject)), false);
});

test('authenticated consults deny on either bucket and use the longest applicable retry', async () => {
  const now = 1_000_000;
  const networkDenied = await checkConsultRateLimit(request, {
    accountSubject: 'network-denied-subject',
  }, {
    limiter: {
      limit: async identifier => ({
        success: identifier.startsWith('consult:account:'),
        reset: identifier.startsWith('consult:account:') ? now + 2_001 : now + 6_001,
      }),
    },
    secret: 'focused-test-secret',
    now: () => now,
  });
  const accountDenied = await checkConsultRateLimit(request, {
    accountSubject: 'account-denied-subject',
  }, {
    limiter: {
      limit: async identifier => ({
        success: !identifier.startsWith('consult:account:'),
        reset: identifier.startsWith('consult:account:') ? now + 9_001 : now + 2_001,
      }),
    },
    secret: 'focused-test-secret',
    now: () => now,
  });
  const bothDenied = await checkConsultRateLimit(request, {
    accountSubject: 'both-denied-subject',
  }, {
    limiter: {
      limit: async identifier => ({
        success: false,
        reset: identifier.startsWith('consult:account:') ? now + 9_001 : now + 20_001,
      }),
    },
    secret: 'focused-test-secret',
    now: () => now,
  });

  assert.deepEqual(networkDenied, { allowed: false, retryAfterSeconds: 7 });
  assert.deepEqual(accountDenied, { allowed: false, retryAfterSeconds: 10 });
  assert.deepEqual(bothDenied, { allowed: false, retryAfterSeconds: 21 });
});

test('authenticated consults fail closed when either bucket provider call fails', async () => {
  const now = 1_000_000;
  const loggedArguments: unknown[][] = [];
  const accountFailure = await checkConsultRateLimit(request, {
    accountSubject: 'provider-failure-subject',
  }, {
    limiter: {
      limit: async identifier => {
        if (identifier.startsWith('consult:account:')) throw new Error('provider unavailable');
        return { success: false, reset: now + 120_000 };
      },
    },
    secret: 'focused-test-secret',
    now: () => now,
    onProviderError: (...args: unknown[]) => {
      loggedArguments.push(args);
    },
  });
  const networkFailure = await checkConsultRateLimit(request, {
    accountSubject: 'network-provider-failure-subject',
  }, {
    limiter: {
      limit: async identifier => {
        if (!identifier.startsWith('consult:account:')) throw new Error('provider unavailable');
        return { success: true, reset: now + 3_000 };
      },
    },
    secret: 'focused-test-secret',
    now: () => now,
    onProviderError: (...args: unknown[]) => {
      loggedArguments.push(args);
    },
  });

  assert.deepEqual(accountFailure, { allowed: false, retryAfterSeconds: 120 });
  assert.deepEqual(networkFailure, { allowed: false, retryAfterSeconds: 60 });
  assert.deepEqual(loggedArguments, [[], []]);
});

test('the route derives optional account authority before limiting and body parsing', () => {
  const route = readFileSync('app/api/consult/route.ts', 'utf8');
  const sameSite = route.indexOf('if (!sameSiteRequest(request))');
  const auth = route.indexOf('await getAuthSubject()');
  const limiter = route.indexOf('await checkConsultRateLimit(request');
  const body = route.indexOf('await readBoundedConsultJson(request)');

  assert.ok(sameSite >= 0 && sameSite < auth);
  assert.ok(auth < limiter && limiter < body);
  assert.match(route, /accountSubject: authIdentity\?\.subject/);
  assert.doesNotMatch(route, /requireCustomer|redirect\(/);
});
