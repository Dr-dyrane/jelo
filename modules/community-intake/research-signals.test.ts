import assert from 'node:assert/strict';
import test from 'node:test';
import { firstSubmittedBrandLabel } from '@/lib/community-intake/research-signals';

test('reads the submitted label from original object-shaped brand context', () => {
  assert.equal(firstSubmittedBrandLabel([
    { id: 'custom:street-labs', label: 'Street Labs', source: 'custom' },
  ]), 'Street Labs');
});

test('falls back to submitted raw language without stringifying the object', () => {
  assert.equal(firstSubmittedBrandLabel([
    { id: 'custom:street-labs', raw: '  Street Labz  ', source: 'custom' },
  ]), 'Street Labz');
  assert.notEqual(firstSubmittedBrandLabel([{ label: 'Street Labs' }]), '{"label":"Street Labs"}');
});

test('reads current string-shaped context and ignores unusable values', () => {
  assert.equal(firstSubmittedBrandLabel([null, {}, '  COSRX  ']), 'COSRX');
  assert.equal(firstSubmittedBrandLabel([null, {}, 12]), null);
});
