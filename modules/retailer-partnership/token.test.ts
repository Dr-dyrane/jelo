import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseRetailerPartnershipToken,
  retailerPartnershipToken,
} from '@/lib/retailer-partnership/token';

const applicationId = '6b1629ce-b151-4ed6-b91d-b985a6d725d8';
const secret = 'a'.repeat(43);

test('private retailer tokens round-trip without exposing database credentials', () => {
  const token = retailerPartnershipToken(applicationId, secret);
  assert.deepEqual(parseRetailerPartnershipToken(token), { applicationId, secret });
});

test('malformed retailer tokens fail closed', () => {
  assert.equal(parseRetailerPartnershipToken(null), null);
  assert.equal(parseRetailerPartnershipToken('not-a-token'), null);
  assert.equal(parseRetailerPartnershipToken(`${applicationId}.short`), null);
  assert.equal(parseRetailerPartnershipToken(`wrong.${secret}`), null);
});
