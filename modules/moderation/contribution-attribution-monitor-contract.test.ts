import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

async function monitorSource() {
  const source = await readFile(path.join(root, 'lib/moderation/queues.ts'), 'utf8');
  const start = source.indexOf('export type ContributionAttributionMonitor');
  assert.notEqual(start, -1, 'contribution attribution monitor should exist');
  return source.slice(start);
}

test('contribution attribution monitor uses exact, bounded comparison windows', async () => {
  const source = await monitorSource();

  assert.match(source, /captured_at >= now\(\) - interval '7 days'/);
  assert.match(source, /captured_at >= now\(\) - interval '14 days'/);
  assert.match(source, /captured_at < now\(\) - interval '7 days'/);
  assert.match(source, /captured_at >= now\(\) - interval '30 days'/);
  assert.match(source, /submitted_at >= now\(\) - interval '7 days'/);
  assert.match(source, /submitted_at >= now\(\) - interval '14 days'/);
  assert.match(source, /submitted_at < now\(\) - interval '7 days'/);
  assert.match(source, /submitted_at >= now\(\) - interval '30 days'/);
  assert.match(source, /limit 12/);
  assert.match(source, /order by completions desc, starts desc/);
});

test('contribution attribution monitor keeps completion separate from moderation', async () => {
  const source = await monitorSource();

  assert.match(source, /from community_contributions contribution/);
  assert.match(source, /contribution\.retain_until > now\(\)/);
  assert.doesNotMatch(source, /moderation_status/);
  assert.match(source, /coalesce\(attribution\.source, 'not-recorded'\)/);
});

test('contribution attribution monitor projects only aggregate campaign fields', async () => {
  const source = await monitorSource();

  assert.match(source, /source: string;/);
  assert.match(source, /medium: string \| null;/);
  assert.match(source, /campaign: string \| null;/);
  assert.match(source, /content: string \| null;/);
  assert.match(source, /starts: number;/);
  assert.match(source, /completions: number;/);
  assert.doesNotMatch(
    source,
    /\b(payload|concern|product|account|anonymous_user_id|ip_address|user_agent|click_id|referrer)\b/i,
  );
});
