import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  analysePackshotSilhouette,
  likelySlicedPackshotBase,
  likelyTruncatedPackshot,
} from '@/lib/assets/packshot-silhouette';

test('a flat inherited crop is rejected even after transparent padding is added', async () => {
  const clipped = await sharp({
    create: { width: 1_000, height: 1_000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{
    input: Buffer.from('<svg width="1000" height="1000"><path d="M360 130 Q500 40 640 130 L690 850 L310 850 Z" fill="white"/></svg>'),
    top: 0,
    left: 0,
  }]).png().toBuffer();
  const metrics = await analysePackshotSilhouette(clipped);
  assert.equal(likelyTruncatedPackshot(metrics), true);
  assert.equal(metrics.bottomTerminalRunFraction, 1);
});

test('a completed rounded package base passes the terminal-edge gate', async () => {
  const complete = await sharp({
    create: { width: 1_000, height: 1_000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{
    input: Buffer.from('<svg width="1000" height="1000"><path d="M360 130 Q500 40 640 130 L690 800 Q680 850 500 865 Q320 850 310 800 Z" fill="white"/></svg>'),
    top: 0,
    left: 0,
  }]).png().toBuffer();
  const metrics = await analysePackshotSilhouette(complete);
  assert.equal(likelyTruncatedPackshot(metrics), false);
  assert.ok(metrics.bottomTerminalRunFraction < 0.5);
});

test('the Dove repair closes the exact clipping and sliced-base regressions', async () => {
  const root = path.join(process.cwd(), 'public', 'products', 'dove');
  const [clipped, sliced, repaired] = await Promise.all([
    readFile(path.join(root, 'dove-go-fresh-cucumber-green-tea-spray-transparent-v2.png')),
    readFile(path.join(root, 'dove-go-fresh-cucumber-green-tea-spray-transparent-v3.png')),
    readFile(path.join(root, 'dove-go-fresh-cucumber-green-tea-spray-transparent-v4.png')),
  ]);
  const [before, intermediate, after] = await Promise.all([
    analysePackshotSilhouette(clipped),
    analysePackshotSilhouette(sliced),
    analysePackshotSilhouette(repaired),
  ]);
  assert.equal(before.bottomTerminalRunFraction, 1);
  assert.equal(likelyTruncatedPackshot(before), true);
  assert.ok(intermediate.bottomTerminalRunFraction < 0.5);
  assert.ok(intermediate.bottomNearTerminalStrongEdgeRunFraction >= 0.28);
  assert.equal(likelyTruncatedPackshot(intermediate), false);
  assert.equal(likelySlicedPackshotBase(intermediate), true);
  assert.equal(likelyTruncatedPackshot(after), false);
  assert.equal(likelySlicedPackshotBase(after), false);
  assert.ok(after.bottomTerminalRunFraction < 0.5);
  assert.ok(after.bottomNearTerminalStrongEdgeRunFraction < 0.28);
});
