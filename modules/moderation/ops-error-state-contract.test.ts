import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function source(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const routeErrors = [
  'app/(ops)/ops/error.tsx',
  'app/(ops)/ops/activity/error.tsx',
  'app/(ops)/ops/contributions/error.tsx',
  'app/(ops)/ops/edges/error.tsx',
  'app/(ops)/ops/observations/error.tsx',
  'app/(ops)/ops/operators/error.tsx',
  'app/(ops)/ops/retailers/error.tsx',
  'app/(ops)/ops/research/error.tsx',
  'app/(ops)/ops/signals/error.tsx',
  'app/(ops)/ops/vocabulary/error.tsx',
] as const;

test('route failures use the shared full-workspace error surface', async () => {
  const [component, styles, ...routes] = await Promise.all([
    source('components/ops/state/ErrorState.tsx'),
    source('components/ops/state/state.module.css'),
    ...routeErrors.map(source),
  ]);

  assert.match(component, /data-ops-error-surface/);
  assert.match(component, /role="alert"/);
  assert.match(component, /useTransition/);
  assert.match(component, /Trying again…/);
  assert.match(component, /aria-busy=\{isRetrying\}/);

  const errorRule = styles.match(/\.error\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(errorRule, /width:\s*100%/);
  assert.match(errorRule, /align-self:\s*stretch/);
  assert.match(errorRule, /flex:\s*1 0 auto/);
  assert.doesNotMatch(errorRule, /max-width/);
  assert.doesNotMatch(errorRule, /margin:/);
  assert.match(styles, /\.errorRetry[\s\S]*border-radius:\s*var\(--ops-control-radius\)/);
  assert.doesNotMatch(styles, /\.errorRetry[\s\S]*border-radius:\s*var\(--radius-pill\)/);
  assert.match(styles, /\.emptyAction[\s\S]*border-radius:\s*var\(--ops-control-radius\)/);
  assert.doesNotMatch(styles, /\.emptyAction[\s\S]*border-radius:\s*var\(--radius-pill\)/);

  for (const [index, route] of routes.entries()) {
    assert.match(
      route,
      /<OpsWorkspace\b/,
      `${routeErrors[index]} must preserve the route workspace`,
    );
    assert.match(
      route,
      /<ErrorState\b/,
      `${routeErrors[index]} must use the shared recovery surface`,
    );
    assert.match(route, /onRetry=\{reset\}/);
    assert.match(route, /console\.error/);
    assert.doesNotMatch(route, /data-ops-reserve-detail/);
    assert.doesNotMatch(route, /\b(?:SQL|UUID|payload|schema|provider|database)\b/i);
  }
});
