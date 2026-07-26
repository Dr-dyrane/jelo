import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  includeSelectedQueueItem,
  queueSelectionHref,
  selectedQueueItemId,
} from '@/lib/moderation/queue-selection';

test('queue selection reads one stable id from Next search params', () => {
  assert.equal(selectedQueueItemId({ id: '  record-2  ' }), 'record-2');
  assert.equal(selectedQueueItemId({ id: ['record-3', 'record-4'] }), 'record-3');
  assert.equal(selectedQueueItemId({ id: '   ' }), null);
  assert.equal(selectedQueueItemId({}), null);
});

test('queue selection URLs preserve unrelated query state', () => {
  assert.equal(
    queueSelectionHref('/ops/contributions', 'view=pending&id=old', 'record-2'),
    '/ops/contributions?view=pending&id=record-2',
  );
  assert.equal(
    queueSelectionHref('/ops/contributions', 'view=pending&id=old', null),
    '/ops/contributions?view=pending',
  );
});

test('a requested pending item outside the recent window is included once', () => {
  const recent = [{ id: 'recent-1' }, { id: 'recent-2' }];
  const selected = { id: 'oldest-1' };

  assert.deepEqual(includeSelectedQueueItem(recent, selected), [
    { id: 'recent-1' },
    { id: 'recent-2' },
    { id: 'oldest-1' },
  ]);
  assert.equal(includeSelectedQueueItem(recent, recent[0]), recent);
  assert.equal(includeSelectedQueueItem(recent, null), recent);
});

test('canonical moderation queues implement the shared URL-selection contract', async () => {
  const root = process.cwd();
  const queues = ['contributions', 'edges', 'vocabulary', 'retailers'];

  for (const queue of queues) {
    const page = await readFile(
      path.join(root, `app/(ops)/ops/${queue}/page.tsx`),
      'utf8',
    );
    const inboxName = queue === 'contributions'
      ? 'ContributionsInbox'
      : queue === 'edges'
        ? 'EdgesInbox'
        : queue === 'vocabulary'
          ? 'VocabularyInbox'
          : 'RetailersInbox';
    const inbox = await readFile(
      path.join(root, `app/(ops)/ops/${queue}/${inboxName}.tsx`),
      'utf8',
    );

    assert.match(page, /selectedQueueItemId\(await searchParams\)/);
    assert.match(page, /includeSelectedQueueItem\(recentRows, selectedRow\)/);
    assert.match(inbox, /useUrlInboxSelection\(\)/);
    assert.match(inbox, /selectedId=\{selection\.selectedId\}/);
    assert.match(
      inbox,
      /(?:onSelect=\{selection\.onSelect\}|onSelect=\{item => \{[\s\S]*selection\.onSelect\(item\))/,
    );
    assert.match(
      inbox,
      /(?:onDeselect=\{selection\.onDeselect\}|onDeselect=\{\(\) => \{[\s\S]*selection\.onDeselect\(\))/,
    );
  }
});
