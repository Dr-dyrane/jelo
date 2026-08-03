import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMeDockContext,
  ME_RELEASED_WORKSPACE_NAVIGATION,
  ME_WORKSPACE_NAVIGATION,
} from '../../components/me/shell/me-shell-model';

test('JeloCare Me has exactly four product tabs with Ask at /me', () => {
  assert.deepEqual(ME_WORKSPACE_NAVIGATION.map(({ label, href }) => ({ label, href })), [
    { label: 'Ask', href: '/me' },
    { label: 'Concerns', href: '/me/concerns' },
    { label: 'Shelf', href: '/me/shelf' },
    { label: 'Routine', href: '/me/routine' },
  ]);
});

test('the first release exposes only a route that exists', () => {
  assert.deepEqual(ME_RELEASED_WORKSPACE_NAVIGATION.map(({ label, href }) => ({ label, href })), [
    { label: 'Ask', href: '/me' },
  ]);
});

test('Me context is descriptive and contains no mutation callback', () => {
  const context = createMeDockContext({ tab: 'ask', detail: 'Ready for your question' });
  assert.deepEqual(context, {
    id: 'me-ask',
    label: 'Ask',
    detail: 'Ready for your question',
    accessibleLabel: 'Ask. Ready for your question',
  });
  assert.equal('onClick' in context, false);
});
