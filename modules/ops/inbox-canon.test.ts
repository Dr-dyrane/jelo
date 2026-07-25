import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

type Item = { id: string };

function resolveSelection(items: Item[], selectedId: string | null): string | null {
  if (items.length === 0) return null;
  if (selectedId && items.some(item => item.id === selectedId)) return selectedId;
  return items[0].id;
}

function advanceAfterSettled(items: Item[], settledId: string): string | null {
  const settledIndex = items.findIndex(item => item.id === settledId);
  if (settledIndex < 0) return null;
  const remaining = items.filter(item => item.id !== settledId);
  if (remaining.length === 0) return null;
  return remaining[Math.min(settledIndex, remaining.length - 1)].id;
}

describe('canonical inbox selection', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('auto-selects the first item without a valid selection', () => {
    assert.equal(resolveSelection(items, null), 'a');
    assert.equal(resolveSelection(items, 'stale'), 'a');
  });

  it('preserves a valid URL selection', () => {
    assert.equal(resolveSelection(items, 'b'), 'b');
  });

  it('returns an empty state only for an empty queue', () => {
    assert.equal(resolveSelection([], null), null);
  });
});

describe('canonical inbox advancement', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('selects the row moving into the settled index', () => {
    assert.equal(advanceAfterSettled(items, 'b'), 'c');
  });

  it('falls back to the previous row when the last row settles', () => {
    assert.equal(advanceAfterSettled(items, 'd'), 'c');
  });

  it('returns the queue-complete state when the only row settles', () => {
    assert.equal(advanceAfterSettled([{ id: 'a' }], 'a'), null);
  });
});

describe('canonical implementation contracts', () => {
  const container = read('components/ops/inbox/InboxContainer.tsx');
  const observations = read('app/(ops)/ops/observations/ObservationsInbox.tsx');
  const styles = read('components/ops/inbox/inbox.module.css');
  const actions = read('app/(ops)/ops/actions.ts');

  it('uses a typed controller rather than a mutable window global', () => {
    assert.match(container, /export interface OpsInboxController/);
    assert.match(container, /controllerRef\.current = \{ settleItem: handleItemSettled \}/);
    assert.doesNotMatch(container, /__opsInboxAdvance/);
    assert.doesNotMatch(observations, /__opsInboxAdvance/);
  });

  it('keeps metadata collapsed through native details', () => {
    assert.match(observations, /<details className=\{styles\.metadataDisclosure\}>/);
    assert.match(observations, /<summary>Metadata<\/summary>/);
  });

  it('uses title case and borderless canonical action styling', () => {
    const inspectorStyles = styles.slice(styles.indexOf('.detailContent'), styles.indexOf('/* Apple Music-inspired'));
    assert.match(inspectorStyles, /text-transform: none/);
    assert.match(inspectorStyles, /\.btnApprove[\s\S]*var\(--accent-solid\)/);
    assert.match(inspectorStyles, /\.btnReject[\s\S]*var\(--state-danger-bg\)/);
    assert.match(inspectorStyles, /\.btn \{[\s\S]*border: 0/);
    assert.match(inspectorStyles, /\.note \{[\s\S]*border: 0/);
    assert.doesNotMatch(inspectorStyles, /border-top:/);
    assert.doesNotMatch(inspectorStyles, /border-bottom:/);
  });

  it('centralizes queue, sidebar, activity, and signal revalidation', () => {
    assert.match(actions, /export function revalidateOpsSurfaces/);
    assert.match(actions, /revalidatePath\('\/ops', 'layout'\)/);
    assert.match(actions, /revalidatePath\('\/ops\/activity'\)/);
    assert.match(actions, /revalidatePath\('\/ops\/signals'\)/);
  });
});
