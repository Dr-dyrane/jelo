import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedCronRequest } from './cron-auth';

const secret = 'a-secure-inventory-secret';

test('accepts only the exact cron bearer credential', () => {
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, secret), true);
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}-wrong`, secret), false);
  assert.equal(isAuthorizedCronRequest(secret, secret), false);
});

test('fails closed when the server secret is missing or too short', () => {
  assert.equal(isAuthorizedCronRequest('Bearer undefined', undefined), false);
  assert.equal(isAuthorizedCronRequest('Bearer short', 'short'), false);
  assert.equal(isAuthorizedCronRequest(null, secret), false);
});
