import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const LIGHT_ROOT_BLOCKS_SHA256 = 'abdb7646e9bc70f7437a55698cd6bc1b96362ee9b5284e2d369031f1ec46a757';

const expectedDarkTokens = {
  '--ink': '#fff7f4',
  '--muted': '#c6b0ad',
  '--cream': '#000',
  '--paper': '#171214',
  '--surface-2': '#0f0b0d',
  '--surface-3': '#1c1417',
  '--card': '#141012',
  '--card-2': '#1a1316',
  '--card-3': '#21171b',
  '--border': 'rgba(255,160,163,.17)',
  '--peach': '#5a2925',
  '--rose': '#672438',
  '--wine': '#ff9aa5',
  '--accent-solid': '#ff9aa5',
  '--on-accent': '#21070d',
  '--band': '#080305',
  '--on-band': '#fff7f4',
  '--band-muted': '#c6b0ad',
  '--ghost-bg': 'rgba(255,154,165,.09)',
  '--tag-bg': 'rgba(45,18,28,.78)',
  '--visual-lg-bg': 'rgba(255,118,139,.055)',
  '--card-glass': 'rgba(26,15,20,.86)',
  '--wash-a': '#080305',
  '--wash-b': '#16070d',
  '--wash-c': '#2b0c18',
  '--wash-hero': '#36101a',
  '--wash-consult': '#281018',
  '--orb1-a': '#1b0710',
  '--orb1-b': '#672438',
  '--orb2-a': '#14070b',
  '--orb2-b': '#5a2925',
  '--ghost-word': 'rgba(255,128,145,.1)',
  '--shadow': '0 30px 90px rgba(0,0,0,.72),0 0 80px rgba(130,33,66,.08)',
  '--shot-shadow': 'rgba(0,0,0,.62)',
  '--state-success': '#7cc79b',
  '--state-success-bg': 'rgba(124,199,155,.14)',
  '--state-warning': '#e6b877',
  '--state-warning-bg': 'rgba(230,184,119,.14)',
  '--state-danger': '#f0a59d',
  '--state-danger-bg': 'rgba(240,165,157,.14)',
  '--state-info': 'var(--wine)',
  '--state-info-bg': 'rgba(255,154,165,.14)',
  '--state-selected-bg': 'color-mix(in srgb, var(--wine) 14%, transparent)',
  '--elevation-1': '0 10px 26px rgba(0,0,0,.45)',
  '--elevation-2': '0 14px 40px rgba(0,0,0,.5)',
  '--elevation-3': '0 20px 50px rgba(0,0,0,.55)',
  '--elevation-4': '0 30px 90px rgba(0,0,0,.55)',
  '--glass-scrim': 'rgba(0,0,0,.64)',
  '--ops-canvas': '#000',
  '--ops-instrument': 'rgba(28,28,28,.72)',
  '--ops-workspace': '#121212',
  '--ops-surface-subtle': '#1c1c1c',
  '--ops-product-stage': '#262626',
  '--ops-ink': '#f5f5f5',
  '--ops-muted': '#b3b3b3',
  '--ops-workspace-shadow': '0 18px 48px rgba(0,0,0,.52)',
  '--ops-instrument-shadow': '0 10px 26px rgba(0,0,0,.48)',
  '--ops-floating-shadow': '0 20px 50px rgba(0,0,0,.68)',
  '--ops-accent': '#dedede',
  '--ops-accent-subtle': 'rgba(222,222,222,.14)',
  '--ops-focus-ring': '#fff',
} as const;

function extractBalancedBlock(source: string, start: number) {
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, 'expected an opening brace');

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail('expected a balanced CSS block');
}

function blocksFor(source: string, selector: RegExp) {
  return [...source.matchAll(selector)].map(match => extractBalancedBlock(source, match.index));
}

function declarations(blocks: string[]) {
  const tokens: Record<string, string> = {};

  for (const block of blocks) {
    for (const match of block.matchAll(/(--[\w-]+):([^;]+);/g)) {
      tokens[match[1]] = match[2].trim();
    }
  }

  return tokens;
}

function luminance(hex: string) {
  const shorthand = /^#([\da-f])([\da-f])([\da-f])$/i.exec(hex);
  const normalized = shorthand
    ? `#${shorthand[1]}${shorthand[1]}${shorthand[2]}${shorthand[2]}${shorthand[3]}${shorthand[3]}`
    : hex;
  const channels = normalized.match(/[\da-f]{2}/gi);
  assert.ok(channels && channels.length === 3, `expected an RGB hex color, received ${hex}`);

  const [red, green, blue] = channels.map(channel => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('dark theme branches share the exact chromatic black token contract', async () => {
  const css = await readFile(path.join(process.cwd(), 'app/globals.css'), 'utf8');
  const systemDarkMedia = blocksFor(css, /^@media\(prefers-color-scheme:dark\)\{/gm);
  const systemDarkTokens = declarations(systemDarkMedia.flatMap(block => (
    blocksFor(block, /:root:not\(\[data-theme="light"\]\)\{/g)
  )));
  const explicitDarkTokens = declarations(blocksFor(css, /^:root\[data-theme="dark"\]\{/gm));

  assert.deepEqual(systemDarkTokens, expectedDarkTokens);
  assert.deepEqual(explicitDarkTokens, expectedDarkTokens);
});

test('dark environment keeps a black canvas, chromatic depth, and WCAG contrast', async () => {
  const tintedPublicTokens = [
    '--paper', '--surface-2', '--surface-3', '--card', '--card-2', '--card-3',
    '--peach', '--rose', '--wine', '--wash-a', '--wash-b', '--wash-c',
    '--wash-hero', '--wash-consult',
  ] as const;
  const neutralOpsTokens = [
    '--ops-canvas', '--ops-workspace', '--ops-surface-subtle', '--ops-product-stage',
  ] as const;

  assert.equal(expectedDarkTokens['--cream'], '#000');
  for (const token of tintedPublicTokens) {
    const value = expectedDarkTokens[token];
    const channels = value.length === 4
      ? [value[1], value[2], value[3]]
      : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)];
    assert.ok(new Set(channels).size > 1, `${token} must retain intentional colour`);
  }
  for (const token of neutralOpsTokens) {
    const value = expectedDarkTokens[token];
    const channels = value.length === 4
      ? [value[1], value[2], value[3]]
      : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)];
    assert.equal(new Set(channels).size, 1, `${token} must remain operationally neutral`);
  }

  assert.ok(contrast(expectedDarkTokens['--ink'], expectedDarkTokens['--card-3']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--muted'], expectedDarkTokens['--peach']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--on-accent'], expectedDarkTokens['--accent-solid']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--ink'], expectedDarkTokens['--rose']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--wine'], expectedDarkTokens['--card-3']) >= 3);
  assert.ok(contrast(expectedDarkTokens['--ops-ink'], expectedDarkTokens['--ops-product-stage']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--ops-muted'], expectedDarkTokens['--ops-product-stage']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--ops-focus-ring'], expectedDarkTokens['--ops-product-stage']) >= 3);
  assert.ok(contrast(expectedDarkTokens['--state-success'], expectedDarkTokens['--ops-product-stage']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--state-warning'], expectedDarkTokens['--ops-product-stage']) >= 4.5);
  assert.ok(contrast(expectedDarkTokens['--state-danger'], expectedDarkTokens['--ops-product-stage']) >= 4.5);
});

test('light token declarations remain byte-identical and browser chrome is black only in dark mode', async () => {
  const [css, layout, manifest] = await Promise.all([
    readFile(path.join(process.cwd(), 'app/globals.css'), 'utf8'),
    readFile(path.join(process.cwd(), 'app/layout.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'app/manifest.ts'), 'utf8'),
  ]);
  const lightRootBlocks = blocksFor(css, /^:root\{/gm);
  const digest = createHash('sha256').update(lightRootBlocks.join('\n')).digest('hex');

  assert.equal(lightRootBlocks.length, 2);
  assert.equal(digest, LIGHT_ROOT_BLOCKS_SHA256);
  assert.match(layout, /media: '\(prefers-color-scheme: light\)', color: '#f29c85'/);
  assert.match(layout, /media: '\(prefers-color-scheme: dark\)', color: '#000000'/);
  assert.match(layout, /var c=d\?'#000000':'#f29c85'/);
  assert.match(layout, /querySelectorAll\('meta\[name="theme-color"\]'\)/);
  assert.match(layout, /n\[i\]\.setAttribute\('content',c\)/);
  assert.match(layout, /new MutationObserver\(s\)\.observe\(e,/);
  assert.match(layout, /attributeFilter:\['data-theme'\],childList:true,subtree:true/);
  assert.match(manifest, /background_color: '#fff8f3'/);
  assert.match(manifest, /theme_color: '#f29c85'/);
});
