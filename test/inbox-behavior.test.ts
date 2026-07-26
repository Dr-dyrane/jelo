import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInboxSections } from '../components/ops/inbox/collection-sections';

// Pure logic tests for the canonical inbox auto-selection and auto-advance behavior.
// These test the selection algorithm without React rendering. The InboxContainer
// component implements these exact rules.

type Item = { id: string };

// --- Selection logic (mirrors InboxContainer auto-selection effect) ---

function resolveSelection(items: Item[], selectedId: string | null): string | null {
  if (items.length === 0) return null;
  // If current selection is valid, preserve it.
  if (selectedId && items.some(item => item.id === selectedId)) return selectedId;
  // Auto-select first item.
  return items[0].id;
}

// --- Advance logic (mirrors handleItemSettled) ---

function advanceAfterSettled(items: Item[], settledId: string): string | null {
  const settledIndex = items.findIndex(item => item.id === settledId);
  if (settledIndex < 0) return null;
  const remaining = items.filter(item => item.id !== settledId);
  if (remaining.length === 0) return null;
  const nextIndex = Math.min(settledIndex, remaining.length - 1);
  return remaining[nextIndex].id;
}

describe('Inbox auto-selection', () => {
  it('first row is selected when rows exist and no valid id is present', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.strictEqual(resolveSelection(items, null), 'a');
  });

  it('valid URL selection is preserved', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.strictEqual(resolveSelection(items, 'b'), 'b');
  });

  it('invalid URL selection falls back to the first row', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.strictEqual(resolveSelection(items, 'nonexistent'), 'a');
  });

  it('empty queue returns null selection', () => {
    assert.strictEqual(resolveSelection([], null), null);
    assert.strictEqual(resolveSelection([], 'stale-id'), null);
  });
});

describe('Inbox auto-advance after decision', () => {
  it('successful decision selects the next row at the same index', () => {
    // A, B (selected), C, D → after B settled → A, C (selected), D
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    assert.strictEqual(advanceAfterSettled(items, 'b'), 'c');
  });

  it('removing the last row selects the previous row', () => {
    // A, B, C, D (selected) → after D settled → A, B, C (selected)
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    assert.strictEqual(advanceAfterSettled(items, 'd'), 'c');
  });

  it('removing the only row produces the queue-empty state', () => {
    const items = [{ id: 'a' }];
    assert.strictEqual(advanceAfterSettled(items, 'a'), null);
  });

  it('removing the first row selects the new first row', () => {
    // A (selected), B, C → after A settled → B (selected), C
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.strictEqual(advanceAfterSettled(items, 'a'), 'b');
  });

  it('settling a non-existent item returns null (no-op)', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    assert.strictEqual(advanceAfterSettled(items, 'nonexistent'), null);
  });
});

describe('Inbox selection recovery', () => {
  it('stale ID after concurrent resolution falls back to first', () => {
    // Another operator already resolved 'b', so it's no longer in the queue.
    const items = [{ id: 'a' }, { id: 'c' }, { id: 'd' }];
    assert.strictEqual(resolveSelection(items, 'b'), 'a');
  });

  it('resolveSelection is idempotent with a valid selection', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const first = resolveSelection(items, null);
    const second = resolveSelection(items, first);
    assert.strictEqual(first, second);
  });
});

describe('Inbox section projections', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('ignores missing IDs and never renders an item twice', () => {
    const sections = normalizeInboxSections(items, [
      {
        id: 'feature',
        label: 'Up next',
        presentation: 'feature-shelf',
        itemIds: ['a', 'missing', 'b'],
      },
      {
        id: 'prices',
        label: 'Price reports',
        presentation: 'compact-rows',
        itemIds: ['b', 'c'],
      },
    ]);

    assert.deepEqual(
      sections.map(section => [section.id, section.items.map(item => item.id)]),
      [
        ['feature', ['a', 'b']],
        ['prices', ['c']],
        ['more', ['d']],
      ],
    );
  });

  it('keeps unassigned records in canonical queue order', () => {
    const sections = normalizeInboxSections(items, [
      {
        id: 'feature',
        label: 'Up next',
        presentation: 'feature-shelf',
        itemIds: ['c'],
      },
    ]);

    assert.deepEqual(
      sections.at(-1)?.items.map(item => item.id),
      ['a', 'b', 'd'],
    );
  });
});
