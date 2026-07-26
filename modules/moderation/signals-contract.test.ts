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
  assert.doesNotMatch(page, /monitor\.lastRecordedAt == null/);
  assert.doesNotMatch(page, /\blede=|<h1|Commerce signals/);
  assert.doesNotMatch(monitor, /InboxContainer|approve|reject|decision|Signal ID/);
  assert.match(monitor, /Contributions/);
  assert.match(monitor, /How people found us/);
  assert.match(monitor, /Store visits/);
  assert.match(monitor, /Price choices/);
  assert.match(monitor, /Most visited products/);
  assert.match(monitor, /Most visited stores/);
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
  assert.match(monitor, /last 30 days/);
  assert.match(monitor, /Latest \{commerce\.recentVisits\.length\}/);
  assert.doesNotMatch(monitor, /eventType|priceRank|productSlug/);
});

test('Signals exposes its privacy and ranking boundary without health-shaped data', async () => {
  const [queues, monitor] = await Promise.all([
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
  ]);
  const signalProjection = queues.slice(queues.indexOf('export type CommercePriceChoice'));
  assert.match(monitor, /anonymous, read-only measurements/);
  assert.match(monitor, /never joined to skincare answers/);
  assert.match(monitor, /Neither measure influences\s+store ranking, guidance, or safety/);
  assert.doesNotMatch(`${signalProjection}\n${monitor}`, /concern|consult|account|user_agent|ip_address/);
});

test('Signals renders on the server and states its measures truthfully', async () => {
  const monitor = await readSource('app/(ops)/ops/signals/SignalsMonitor.tsx');
  assert.doesNotMatch(monitor, /'use client'/);
  assert.match(monitor, /previous 7 days/);
  assert.match(monitor, /'under 1%'/);
  assert.match(monitor, /commerce\.last30DaysCount > 0 \?/);
  assert.match(monitor, /A start is recorded after someone answers the first prompt/);
  assert.match(monitor, /A completion is a submitted\s+contribution/);
  assert.match(monitor, /Earlier submissions may not have a source/);
  assert.match(monitor, /No store visits in the last 30 days\./);
  assert.doesNotMatch(monitor, /Math\.max\(commerce\.last30DaysCount, 1\)/);
});

test('Signals owns truthful loading, independent empty, and retry states', async () => {
  const [monitor, loading, error] = await Promise.all([
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
    readSource('app/(ops)/ops/signals/loading.tsx'),
    readSource('app/(ops)/ops/signals/error.tsx'),
  ]);
  assert.match(monitor, /No tracked form starts yet/);
  assert.match(monitor, /No store visits in the last 30 days/);
  assert.match(loading, /aria-label="Loading signals"/);
  assert.match(loading, /styles\.summary/);
  assert.match(loading, /styles\.skeletonCampaigns/);
  assert.match(loading, /styles\.choiceList/);
  assert.match(loading, /styles\.rankedColumns/);
  assert.match(error, /Couldn’t load signals/);
  assert.match(error, /onRetry=\{reset\}/);
  assert.doesNotMatch(error, /error\.(?:message|stack)/);
});
