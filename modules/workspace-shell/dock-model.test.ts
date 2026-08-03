import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
  resolveActiveWorkspaceNavigationItem,
  resolveAdaptiveWorkspaceDockMode,
  updateWorkspaceDockScrollState,
} from '../../lib/workspace-shell/dock-model';

test('adaptive workspace dock resolves expanded, compact, navigation, and single modes', () => {
  assert.equal(resolveAdaptiveWorkspaceDockMode({
    hasNavigation: true,
    hasContext: true,
    chromeHidden: false,
    navigationRevealed: false,
  }), 'expanded');
  assert.equal(resolveAdaptiveWorkspaceDockMode({
    hasNavigation: true,
    hasContext: true,
    chromeHidden: true,
    navigationRevealed: false,
  }), 'compact');
  assert.equal(resolveAdaptiveWorkspaceDockMode({
    hasNavigation: true,
    hasContext: true,
    chromeHidden: true,
    navigationRevealed: true,
  }), 'navigation');
  assert.equal(resolveAdaptiveWorkspaceDockMode({
    hasNavigation: true,
    hasContext: false,
    chromeHidden: true,
    navigationRevealed: true,
  }), 'single');
});

test('scroll hysteresis requires directional travel and always expands at the top', () => {
  let state = INITIAL_WORKSPACE_DOCK_SCROLL_STATE;
  state = updateWorkspaceDockScrollState(state, 13);
  assert.equal(state.chromeHidden, true);

  state = updateWorkspaceDockScrollState(state, 10);
  assert.equal(state.chromeHidden, false);

  state = updateWorkspaceDockScrollState(state, 40);
  assert.equal(state.chromeHidden, true);
  state = updateWorkspaceDockScrollState(state, 37);
  assert.equal(state.chromeHidden, true);
  state = updateWorkspaceDockScrollState(state, 33);
  assert.equal(state.chromeHidden, false);
  state = updateWorkspaceDockScrollState(state, 0);
  assert.equal(state.chromeHidden, false);
  assert.equal(state.scrolled, false);
});

test('the most specific navigation route owns nested paths', () => {
  const items = [
    { id: 'ask', label: 'Ask', href: '/me' },
    { id: 'shelf', label: 'Shelf', href: '/me/shelf' },
  ];
  assert.equal(resolveActiveWorkspaceNavigationItem(items, '/me/shelf/item-1?from=ask')?.id, 'shelf');
  assert.equal(resolveActiveWorkspaceNavigationItem(items, '/me')?.id, 'ask');
});
