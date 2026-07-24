import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Build-time guard for ADR 0007: the moderation console is an internal, audited
// surface that promotes to canonical only through the existing gates. It must
// never write a canonical catalogue record itself, and access must default to
// deny. Source-scanned because the modules are `server-only` and cannot be
// imported by this runner.
test('the moderation console writes only its audit log and denies access by default', async () => {
  const root = process.cwd();
  const files = ['schema.ts', 'audit.ts', 'access.ts', 'queues.ts', 'transitions.ts', 'action-input.ts'];
  const sources = await Promise.all(files.map(file => readFile(path.join(root, 'lib/moderation', file), 'utf8')));
  const all = sources.join('\n');

  // Never writes or mutates a canonical catalogue record.
  assert.doesNotMatch(all, /insert into (products|brands|retailers|offers|concerns|ingredients)\b/i);
  assert.doesNotMatch(all, /update (products|brands|retailers|offers|concerns|ingredients)\b/i);
  assert.doesNotMatch(all, /@vercel\/blob|put\(/);

  // The only table the console writes is its audit log.
  const insertTargets = [...all.matchAll(/insert into (\w+)/gi)].map(match => match[1].toLowerCase());
  assert.deepEqual([...new Set(insertTargets)], ['moderation_audit_log']);

  // Access is deny-by-default and never infers identity from a header, cookie, or query param.
  const access = sources[files.indexOf('access.ts')];
  assert.match(access, /async function operatorAuthSubject\([^)]*\): Promise<string \| null> \{\s*return null;/);
  assert.match(access, /and active = true/);
  assert.match(access, /throw new ModerationAccessError/);
  assert.doesNotMatch(access, /headers\(\)|cookies\(\)|searchParams|request\.headers/);
});
