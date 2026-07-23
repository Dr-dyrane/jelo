import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAdaptiveSelection,
  removeAdaptiveSelection,
} from '@/lib/community-intake/adaptive-selection';
import type { AdaptiveValue } from '@/lib/community-intake/schema';

const acne: AdaptiveValue = { id: 'purpose:acne', label: 'Acne', source: 'canonical' };
const typo: AdaptiveValue = { id: 'custom:chicken-skni', label: 'Chicken Skni', source: 'custom' };
const corrected: AdaptiveValue = { id: 'custom:chicken-skin', label: 'Chicken Skin', source: 'custom' };

test('editing a custom value replaces it in place instead of appending a duplicate', () => {
  assert.deepEqual(
    applyAdaptiveSelection([acne, typo], corrected, 'multiple', typo.id),
    [acne, corrected],
  );
});

test('editing a custom value into an existing canonical value deduplicates the selection', () => {
  assert.deepEqual(
    applyAdaptiveSelection([acne, typo], acne, 'multiple', typo.id),
    [acne],
  );
});

test('editing a single-select value replaces the previous value', () => {
  assert.deepEqual(
    applyAdaptiveSelection([typo], corrected, 'single', typo.id),
    [corrected],
  );
});

test('removal deletes only the explicit X target', () => {
  assert.deepEqual(removeAdaptiveSelection([acne, corrected], corrected.id), [acne]);
});

test('choosing an already selected value never removes it', () => {
  assert.deepEqual(
    applyAdaptiveSelection([acne, corrected], acne, 'multiple', null),
    [acne, corrected],
  );
});
