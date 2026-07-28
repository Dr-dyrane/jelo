import assert from 'node:assert/strict';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  resolveDirectDataJson,
  writeDirectDataJsonAtomically,
} from '@/lib/catalogue/private-data-json';

test('rejects an existing symlinked direct data JSON path', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jelocare-data-json-'));
  try {
    await mkdir(path.join(root, 'data'));
    const outside = path.join(root, 'outside.json');
    await writeFile(outside, '{"safe":true}\n', 'utf8');
    await symlink(outside, path.join(root, 'data/output.json'));

    await assert.rejects(
      () => resolveDirectDataJson(root, 'data/output.json', '--write'),
      /regular, non-symlinked JSON file/,
    );
    assert.equal(await readFile(outside, 'utf8'), '{"safe":true}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('atomic replacement does not follow a symlink introduced after validation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jelocare-data-json-'));
  try {
    await mkdir(path.join(root, 'data'));
    const output = await resolveDirectDataJson(root, 'data/output.json', '--write');
    const outside = path.join(root, 'outside.json');
    await writeFile(outside, '{"outside":true}\n', 'utf8');
    await symlink(outside, output);

    await writeDirectDataJsonAtomically(output, '{"inside":true}\n');

    assert.equal((await lstat(output)).isSymbolicLink(), false);
    assert.equal(await readFile(output, 'utf8'), '{"inside":true}\n');
    assert.equal(await readFile(outside, 'utf8'), '{"outside":true}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
