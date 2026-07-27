import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('Signals is a title-only monitor rather than a triage inbox', async () => {
  const [page, monitor] = await Promise.all([
    readSource('app/(ops)/ops/signals/page.tsx'),
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
  ]);
  assert.match(page, /<OpsWorkspace title="Signals">/);
  assert.match(page, /getContributionAttributionMonitor/);
  assert.match(page, /contributionSignalView/);
  assert.match(page, /<SignalsRefreshControl \/>/);
  assert.doesNotMatch(page, /monitor\.lastRecordedAt == null/);
  assert.doesNotMatch(page, /\blede=|<h1|Commerce signals/);
  assert.doesNotMatch(
    monitor,
    /InboxContainer|approve|reject|decision|Signal ID|ActivityInference|community-reported patterns/i,
  );
  assert.match(monitor, /Contribution activity/);
  assert.match(monitor, /Leading sources/);
  assert.match(monitor, /Store links/);
  assert.match(monitor, /Price choices/);
  assert.match(monitor, /Most-opened products/);
  assert.match(monitor, /Most-opened stores/);
  assert.match(monitor, /image=\{handoff\.image\}/);
  assert.match(monitor, /fallback=\{<Package/);
});

test('Signals uses bounded named periods and keeps individual activity secondary', async () => {
  const [queues, monitor] = await Promise.all([
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
  ]);
  assert.match(queues, /created_at >= now\(\) - interval '7 days'/);
  assert.match(queues, /created_at >= now\(\) - interval '30 days'/);
  assert.match(queues, /limit 8/);
  assert.match(queues, /limit 20/);
  assert.match(monitor, /previous 7 days/);
  assert.match(monitor, /Last 30 days/);
  assert.match(monitor, /commerce\.recentVisits\.slice\(0, 8\)/);
  assert.match(monitor, /Latest \{recentHandoffs\.length\}/);
  assert.doesNotMatch(monitor, /eventType|priceRank|productSlug/);
});

test('Signals exposes its privacy and ranking boundary without health-shaped data', async () => {
  const [queues, monitor] = await Promise.all([
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
  ]);
  const signalProjection = queues.slice(queues.indexOf('export type CommercePriceChoice'));
  assert.match(monitor, /Store-link opens are anonymous/);
  assert.match(monitor, /Sources are never joined\s+to\s+skincare\s+answers/);
  assert.match(monitor, /used to change store order, guidance, or safety/);
  assert.doesNotMatch(`${signalProjection}\n${monitor}`, /concern|consult|account|user_agent|ip_address/);
  assert.doesNotMatch(monitor, /\bpeople\b|\bvisitors?\b|conversion|click-through|CTR|retailer trust/i);
  assert.doesNotMatch(monitor, /className=\{styles\.rank\}/);
});

test('Signals renders on the server and states its measures truthfully', async () => {
  const monitor = await readSource('app/(ops)/ops/signals/SignalsMonitor.tsx');
  assert.doesNotMatch(monitor, /'use client'/);
  assert.match(monitor, /previous 7 days/);
  assert.match(monitor, /'under 1%'/);
  assert.match(monitor, /commerce\.last30DaysCount > 0 \?/);
  assert.match(monitor, /Starts follow the first answer/);
  assert.match(monitor, /Submitted means the note reached\s+JeloCare/);
  assert.match(monitor, /Earlier notes may not include a source/);
  assert.match(monitor, /No store links opened in the last 30 days\./);
  assert.doesNotMatch(monitor, /Math\.max\(commerce\.last30DaysCount, 1\)/);
  assert.doesNotMatch(monitor, /completion rate|conversion rate|bounce rate/i);
});

test('Signals owns truthful loading, independent empty, and retry states', async () => {
  const [monitor, loading, error, refresh, css] = await Promise.all([
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
    readSource('app/(ops)/ops/signals/loading.tsx'),
    readSource('app/(ops)/ops/signals/error.tsx'),
    readSource('app/(ops)/ops/signals/SignalsRefreshControl.tsx'),
    readSource('app/(ops)/ops/signals/signals.module.css'),
  ]);
  assert.match(monitor, /No contribution activity in the last 30 days/);
  assert.match(monitor, /No store links opened in the last 30 days/);
  assert.match(monitor, /No product links opened in this period/);
  assert.match(monitor, /No store links opened yet/);
  assert.match(loading, /aria-label="Loading signals"/);
  assert.match(loading, /styles\.featureRail/);
  assert.match(loading, /styles\.skeletonSources/);
  assert.match(loading, /styles\.skeletonPositions/);
  assert.match(loading, /styles\.rankedColumns/);
  assert.match(loading, /styles\.skeletonRecent/);
  assert.match(loading, /styles\.skeletonRecentVisual/);
  assert.match(loading, /styles\.boundary/);
  assert.match(error, /Couldn’t load signals/);
  assert.match(error, /onRetry=\{reset\}/);
  assert.doesNotMatch(error, /error\.(?:message|stack)/);
  assert.match(refresh, /useContextFab/);
  assert.match(refresh, /startTransition\(\(\) => router\.refresh\(\)\)/);
  assert.match(refresh, /role="status"/);
  assert.match(refresh, /Refreshing signals/);
  assert.match(
    css,
    /\.surface\s*\{[\s\S]*?width:\s*100%;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0 0 var\(--space-9\)/,
  );
  assert.doesNotMatch(css, /\.surface\s*\{[\s\S]*?width:\s*min\(100%,\s*1120px\)/);
  assert.match(css, /\.featureRail[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(
    css,
    /\.feature\s*\{[\s\S]*?min-height:\s*170px;[\s\S]*?background:\s*var\(--ops-surface-subtle\)/,
  );
  assert.match(
    css,
    /\.featureMeasures strong\s*\{[\s\S]*?font-size:\s*var\(--text-metric\)/,
  );
  assert.doesNotMatch(css, /radial-gradient|linear-gradient\(145deg/);
  assert.doesNotMatch(css, /font-size:\s*clamp\([^;]*(?:4\.4rem|5\.8rem)/);
  assert.match(css, /\.featureRail:focus-visible/);
  assert.match(css, /\.featureRail::-webkit-scrollbar[\s\S]*display: none/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
  assert.match(
    css,
    /@container signals-surface \(max-width: 760px\)[\s\S]*?\.featureRail\s*\{[\s\S]*?grid-auto-flow: column/,
  );
  assert.match(
    css,
    /@container signals-surface \(max-width: 760px\)[\s\S]*\.sourceList,[\s\S]*\.recentList,[\s\S]*\.boundary[\s\S]*grid-template-columns: 1fr/,
  );
  assert.doesNotMatch(css, /font-weight:\s*(?:700|800|900|bold)/);
});
