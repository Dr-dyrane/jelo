import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const publicDarkStyleFiles = [
  'app/globals.css',
  'app/ask-jelo-safety.css',
  'app/storefront.css',
  'app/consult-report.css',
  'app/product-panel.css',
  'app/(site)/home.module.css',
  'app/(site)/products/products.module.css',
  'app/(site)/products/catalogue-feedback.module.css',
  'app/(site)/retailers/retailers.module.css',
  'app/(site)/contribute/contribute.module.css',
  'app/(site)/concerns/concerns.module.css',
  'app/consult-sheet.css',
  'components/navigation/site-header.module.css',
  'components/concerns/concern-selector.module.css',
  'components/concerns/concern-feedback.module.css',
  'components/ingredients/ingredient-explorer.module.css',
  'components/products/catalogue-search.module.css',
  'components/products/inventory-filter-sheet.module.css',
  'components/products/filter-feedback-actions.module.css',
  'components/ui/adaptive-selector.module.css',
] as const;

const legacyWarmDarkAmbient = /(?:#(?:3a2a25|3a2a26|2c211e|2c211d|2c211c|34232c|2a201d|302521|241d1b|332523|26201d|34271f|281e1b|f0c6ca|3b2523|b8837a)\b|rgba\(\s*(?:36\s*,\s*29\s*,\s*27|122\s*,\s*86\s*,\s*72|138\s*,\s*95\s*,\s*87|25\s*,\s*20\s*,\s*19|231\s*,\s*188\s*,\s*178|232\s*,\s*187\s*,\s*180|240\s*,\s*198\s*,\s*202|240\s*,\s*220\s*,\s*210|255\s*,\s*223\s*,\s*214|255\s*,\s*214\s*,\s*223|255\s*,\s*227\s*,\s*212)\s*,)/i;

function darkFragment(source: string, file: string) {
  const marker = source.search(/\/\*\s*dark theme/i);
  assert.notEqual(marker, -1, `${file} must label its dark-theme contract`);
  return source.slice(marker);
}

test('public experience dark overrides use black and neutral gray ambient surfaces', async () => {
  await Promise.all(publicDarkStyleFiles.map(async file => {
    const source = await readFile(path.join(process.cwd(), file), 'utf8');
    const dark = darkFragment(source, file);

    assert.doesNotMatch(dark, legacyWarmDarkAmbient, `${file} reintroduced a legacy warm dark surface`);
    assert.match(dark, /data-theme=["']dark["']/, `${file} needs an explicit dark-theme branch`);
    assert.match(dark, /prefers-color-scheme:\s*dark/, `${file} needs an operating-system dark fallback`);
  }));
});

test('dark home hero keeps its white CTA readable without recoloring photography', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'app/(site)/home.module.css'),
    'utf8',
  );
  const dark = darkFragment(source, 'app/(site)/home.module.css');

  assert.match(dark, /data-theme="dark"\]\) \.hero \.primary\{color:var\(--ink\)\}/);
  assert.match(dark, /html:not\(\[data-theme="light"\]\)\) \.hero \.primary\{color:var\(--ink\)\}/);
  assert.match(dark, /\.category img[^}]*\.storyVisual img\{mix-blend-mode:normal\}/);
});
