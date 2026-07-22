import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import path from 'node:path';
import sharp from 'sharp';

const previewPath = path.join(process.cwd(), 'public/social/jelocare-open-graph-v1.jpg');

test('default social preview is a crawler-safe 1200 × 630 JPEG', async () => {
  const bytes = await readFile(previewPath);
  const metadata = await sharp(bytes).metadata();

  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(metadata.hasAlpha, false);
  assert.ok(bytes.byteLength < 300_000, 'social preview should remain lightweight');
});

test('site metadata binds Open Graph and Twitter to the reviewed preview', async () => {
  const layoutSource = await readFile(path.join(process.cwd(), 'app/layout.tsx'), 'utf8');

  assert.match(layoutSource, /images:\s*\[\{[\s\S]*url: '\/social\/jelocare-open-graph-v1\.jpg'/);
  assert.match(layoutSource, /card: 'summary_large_image'/);
  assert.match(layoutSource, /images: \['\/social\/jelocare-open-graph-v1\.jpg'\]/);
});
