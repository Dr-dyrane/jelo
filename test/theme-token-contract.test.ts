import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const LIGHT_ROOT_BLOCKS_SHA256 = 'abdb7646e9bc70f7437a55698cd6bc1b96362ee9b5284e2d369031f1ec46a757';

const expectedDarkTokens = {
  '--ink': '#f5f5f5',
  '--muted': '#b3b3b3',
  '--cream': '#000',
  '--paper': '#141414',
  '--surface-2': '#101010',
  '--surface-3': '#1a1a1a',
  '--card': '#121212',
  '--card-2': '#181818',
  '--card-3': '#202020',
  '--border': 'rgba(255,255,255,.14)',
  '--peach': '#242424',
  '--rose': '#6a6a6a',
  '--wine': '#ededed',
  '--accent-solid': '#f5f5f5',
  '--on-accent': '#000',
  '--band': '#080808',
  '--on-band': '#f5f5f5',
  '--band-muted': '#b3b3b3',
  '--ghost-bg': 'rgba(255,255,255,.08)',
  '--tag-bg': 'rgba(24,24,24,.72)',
  '--visual-lg-bg': 'rgba(255,255,255,.04)',
  '--card-glass': 'rgba(18,18,18,.82)',
  '--wash-a': '#000',
  '--wash-b': '#080808',
  '--wash-c': '#121212',
  '--wash-hero': '#1c1c1c',
  '--wash-consult': '#141414',
  '--orb1-a': '#0b0b0b',
  '--orb1-b': '#2a2a2a',
  '--orb2-a': '#101010',
  '--orb2-b': '#242424',
  '--ghost-word': 'rgba(255,255,255,.07)',
  '--shadow': '0 30px 90px rgba(0,0,0,.72)',
  '--shot-shadow': 'rgba(0,0,0,.62)',
  '--state-success': '#7cc79b',
  '--state-success-bg': 'rgba(124,199,155,.14)',
  '--state-warning': '#e6b877',
  '--state-warning-bg': 'rgba(230,184,119,.14)',
  '--state-danger': '#f0a59d',
  '--state-danger-bg': 'rgba(240,165,157,.14)',
  '--state-info': 'var(--wine)',
  '--state-info-bg': 'rgba(237,237,237,.12)',
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

test('dark theme branches share the exact neutral token contract', async () => {
  const css = await readFile(path.join(process.cwd(), 'app/globals.css'), 'utf8');
  const systemDarkMedia = blocksFor(css, /^@media\(prefers-color-scheme:dark\)\{/gm);
  const systemDarkTokens = declarations(systemDarkMedia.flatMap(block => (
    blocksFor(block, /:root:not\(\[data-theme="light"\]\)\{/g)
  )));
  const explicitDarkTokens = declarations(blocksFor(css, /^:root\[data-theme="dark"\]\{/gm));

  assert.deepEqual(systemDarkTokens, expectedDarkTokens);
  assert.deepEqual(explicitDarkTokens, expectedDarkTokens);
});

test('dark environment is grayscale and its text, actions, and focus clear WCAG contrast', async () => {
  const environmentalTokens = [
    '--cream', '--paper', '--surface-2', '--surface-3', '--card', '--card-2',
    '--card-3', '--peach', '--wash-a', '--wash-b', '--wash-c', '--wash-hero',
    '--wash-consult', '--orb1-a', '--orb1-b', '--orb2-a', '--orb2-b',
    '--ops-canvas', '--ops-workspace', '--ops-surface-subtle', '--ops-product-stage',
  ] as const;

  for (const token of environmentalTokens) {
    const value = expectedDarkTokens[token];
    const channels = value.length === 4
      ? [value[1], value[2], value[3]]
      : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)];
    assert.equal(new Set(channels).size, 1, `${token} must remain chromatically neutral`);
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
