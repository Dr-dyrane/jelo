import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalBrandName, canonicalBrandNameMap, brandAliasesFor } from '@/data/brand-canonical-names';

test('canonicalBrandName returns the canonical name for known variants', () => {
  assert.equal(canonicalBrandName('DANG'), 'DANG! Lifestyle');
  assert.equal(canonicalBrandName('Dang Lifestyle'), 'DANG! Lifestyle');
  assert.equal(canonicalBrandName('Dang! Lifestyle Inc.'), 'DANG! Lifestyle');
  assert.equal(canonicalBrandName('DOVE'), 'Dove');
  assert.equal(canonicalBrandName('FaceFacts'), 'FACE FACTS');
  assert.equal(canonicalBrandName('Anua'), 'ANUA');
  assert.equal(canonicalBrandName('estelinindia'), 'ESTELIN');
});

test('canonicalBrandName returns the original for unmapped brands', () => {
  assert.equal(canonicalBrandName('CeraVe'), 'CeraVe');
  assert.equal(canonicalBrandName('Naturium'), 'Naturium');
  assert.equal(canonicalBrandName('Unknown Brand'), 'Unknown Brand');
});

test('canonicalBrandName is idempotent on canonical names', () => {
  for (const canonical of new Set(Object.values(canonicalBrandNameMap))) {
    assert.equal(canonicalBrandName(canonical), canonical);
  }
});

test('brandAliasesFor returns all variants for a canonical name', () => {
  assert.deepEqual(brandAliasesFor('DANG! Lifestyle').sort(), ['DANG', 'Dang Lifestyle', 'Dang! Lifestyle Inc.']);
  assert.deepEqual(brandAliasesFor('Dove'), ['DOVE']);
  assert.deepEqual(brandAliasesFor('FACE FACTS'), ['FaceFacts']);
  assert.deepEqual(brandAliasesFor('ANUA'), ['Anua']);
  assert.deepEqual(brandAliasesFor('ESTELIN'), ['estelinindia']);
});

test('brandAliasesFor returns empty for unknown canonical names', () => {
  assert.deepEqual(brandAliasesFor('CeraVe'), []);
});

test('every canonical name in the map is not itself a key', () => {
  for (const [variant, canonical] of Object.entries(canonicalBrandNameMap)) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(canonicalBrandNameMap, canonical),
      `Canonical name "${canonical}" should not also be a variant key`,
    );
  }
});
