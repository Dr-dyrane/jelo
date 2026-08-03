import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { WORKSPACE_DOCK_GEOMETRY } from '../../lib/workspace-shell/dock-model';

const css = readFileSync(
  'components/workspace-shell/adaptive-workspace-dock.module.css',
  'utf8',
);
const navigation = readFileSync(
  'components/workspace-shell/dock-navigation.tsx',
  'utf8',
);
const context = readFileSync('components/workspace-shell/dock-context.tsx', 'utf8');

test('dock geometry preserves touch targets, nested curves, and reviewed clearance', () => {
  assert.deepEqual(WORKSPACE_DOCK_GEOMETRY, {
    controlHeight: 58,
    contextHeight: 44,
    expandedHeight: 110,
    visualBottomClearance: 16,
    compactGutter: 12,
    islandGap: 10,
  });
  assert.match(css, /border-radius: 32px/);
  assert.match(css, /border-radius: 26px/);
});

test('lens and navigation preserve accessibility preference contracts', () => {
  assert.match(css, /blur\(2px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /:focus-visible/);
  assert.match(navigation, /aria-current=\{selected \? 'page'/);
  assert.match(navigation, /\.focus\(\{ preventScroll: true \}\)/);
  assert.match(navigation, /Show navigation\./);
});

test('the context capsule is descriptive and cannot own a mutation', () => {
  assert.match(context, /<section/);
  assert.doesNotMatch(context, /<button|onClick|onSubmit/);
});
