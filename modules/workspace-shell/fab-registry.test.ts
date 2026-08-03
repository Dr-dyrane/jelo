import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDockFabRegistry,
  registerDockFab,
  resolveDockFab,
  unregisterDockFab,
} from '../../lib/workspace-shell/fab-registry';

test('FAB registration is route scoped and latest-owner wins', () => {
  let registry = createDockFabRegistry<string>('/me');
  registry = registerDockFab(registry, {
    ownerId: 'ask-controller',
    routeKey: '/me',
    value: 'Ask Jelo',
  }, 'ask:1');
  registry = registerDockFab(registry, {
    ownerId: 'shelf-controller',
    routeKey: '/me',
    value: 'Save product',
  }, 'shelf:2');
  assert.equal(resolveDockFab(registry)?.value, 'Save product');

  const unchanged = registerDockFab(registry, {
    ownerId: 'other-route',
    routeKey: '/me/shelf',
    value: 'Wrong route',
  }, 'other:3');
  assert.equal(unchanged, registry);
});

test('cleanup removes only the registration token that created it', () => {
  let registry = createDockFabRegistry<string>('/me');
  registry = registerDockFab(registry, {
    ownerId: 'ask-controller',
    routeKey: '/me',
    value: 'First',
  }, 'ask:1');
  registry = registerDockFab(registry, {
    ownerId: 'ask-controller',
    routeKey: '/me',
    value: 'Second',
  }, 'ask:2');
  registry = unregisterDockFab(registry, 'ask:1');
  assert.equal(resolveDockFab(registry)?.value, 'Second');
  assert.equal(unregisterDockFab(registry, 'missing'), registry);
});
