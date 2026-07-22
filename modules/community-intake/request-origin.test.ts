import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedCommunityRequest } from '@/lib/community-intake/request-origin';

test('accepts the exact browser host when an internal proxy origin differs', () => {
  const headers = new Headers({
    host: '127.0.0.1:3100',
    origin: 'http://127.0.0.1:3100',
    'sec-fetch-site': 'same-origin',
  });
  assert.equal(isAllowedCommunityRequest(headers, 'http://localhost:3100'), true);
});

test('uses the first forwarded host for a custom-domain request', () => {
  const headers = new Headers({
    host: 'internal.vercel.app',
    origin: 'https://www.jelocare.com',
    'sec-fetch-site': 'same-origin',
    'x-forwarded-host': 'www.jelocare.com, internal.vercel.app',
  });
  assert.equal(isAllowedCommunityRequest(headers, 'https://internal.vercel.app'), true);
});

test('rejects cross-site or mismatched origins', () => {
  assert.equal(isAllowedCommunityRequest(new Headers({
    host: 'www.jelocare.com',
    origin: 'https://attacker.example',
    'sec-fetch-site': 'same-site',
  }), 'https://www.jelocare.com'), false);
  assert.equal(isAllowedCommunityRequest(new Headers({
    host: 'www.jelocare.com',
    'sec-fetch-site': 'cross-site',
  }), 'https://www.jelocare.com'), false);
});
