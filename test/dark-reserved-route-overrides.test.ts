import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function occurrences(source: string, fragment: string) {
  return source.split(fragment).length - 1;
}

test('reserved public dark overrides consume the shared black-cherry foundation', async () => {
  const [
    productExperience,
    platform,
    trust,
    trend,
    barrier,
    recommendation,
    concernDetail,
    consultReport,
  ] = await Promise.all([
    readSource('app/product-experience.css'),
    readSource('app/platform.css'),
    readSource('app/trust.css'),
    readSource('app/trend-report.css'),
    readSource('app/barrier-report.css'),
    readSource('app/recommendation-audit.css'),
    readSource('app/concern-detail.css'),
    readSource('app/consult-report.css'),
  ]);

  assert.equal(occurrences(productExperience, '--product-peach: var(--peach);'), 2);
  assert.equal(occurrences(productExperience, '--product-pink: var(--card-3);'), 2);
  assert.equal(occurrences(productExperience, '--product-blush: var(--surface-3);'), 2);
  assert.doesNotMatch(productExperience, /#2a201d|#2a1e22|#2c211c/);

  assert.doesNotMatch(platform, /rgba\((?:25,20,19|36,29,27),/);
  assert.match(platform, /html\[data-theme="dark"\] \.site-header\{background:rgba\(0,0,0,\.74\)\}/);

  assert.equal(occurrences(trust, 'linear-gradient(135deg, var(--peach), var(--cream) 58%)'), 2);
  assert.doesNotMatch(trust, /warm-dark|keeping the footer's warmth|#3a2a26/);

  assert.doesNotMatch(trend, /rgba\((?:36,29,27|32,26,24),/);
  assert.match(trend, /rgba\(38,54,44,\.92\)/);
  assert.match(trend, /rgba\(58,38,36,\.95\)/);
  assert.match(trend, /rgba\(58,50,34,\.95\)/);

  assert.doesNotMatch(barrier, /rgba\((?:36,29,27|122,86,72|231,188,178),/);
  assert.equal(occurrences(recommendation, 'background:rgba(255,255,255,.1)'), 2);

  assert.doesNotMatch(concernDetail, /rgba\((?:36,29,27|122,86,72),/);
  assert.equal(occurrences(concernDetail, 'background:var(--state-warning-bg)'), 2);
  assert.equal(occurrences(concernDetail, '.concern-detail-chip-sourced a{color:var(--muted)}'), 2);
  assert.equal(occurrences(consultReport, '.report-pattern .eyebrow{color:var(--muted)}'), 2);
});
