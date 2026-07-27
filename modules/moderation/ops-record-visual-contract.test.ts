import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('Ops product visuals resolve explicit canonical refs through the public catalogue only', async () => {
  const [resolver, activityModel, overviewAudit] = await Promise.all([
    readSource('lib/moderation/ops-product-visuals.ts'),
    readSource('lib/moderation/activity-read-model.ts'),
    readSource('lib/moderation/audit-queries.ts'),
  ]);

  assert.match(resolver, /listCatalogueProducts/);
  assert.match(resolver, /canonicalProductSlug/);
  assert.match(resolver, /PRODUCT_PREFIX = 'product:'/);
  assert.doesNotMatch(resolver, /find\([^)]*(?:label|name)|https?:\/\//);

  for (const projection of [activityModel, overviewAudit]) {
    assert.match(projection, /#>> '\{products,0,source\}' = 'canonical'/);
    assert.match(projection, /value\.status = 'mapped'/);
    assert.match(projection, /value\.canonical_entity_kind = 'product'/);
    assert.match(projection, /task\.entity_kind = 'product' and task\.entity_source = 'canonical'/);
    assert.match(projection, /resolution\.canonical_product_slug/);
    assert.match(projection, /event\.product_slug/);
    assert.match(projection, /else null[\s\S]*end as product_ref/);
  }
});

test('Activity, Overview, and Signals share one quiet visual stage with semantic fallbacks', async () => {
  const [tokens, visual, activity, activityCss, overview, overviewCss, signals, signalsCss, overviewLoading] = await Promise.all([
    readSource('app/globals.css'),
    readSource('components/ops/visuals/OpsRecordVisual.tsx'),
    readSource('app/(ops)/ops/activity/ActivityInsights.tsx'),
    readSource('app/(ops)/ops/activity/activity.module.css'),
    readSource('app/(ops)/ops/OverviewBriefing.tsx'),
    readSource('app/(ops)/ops/overview.module.css'),
    readSource('app/(ops)/ops/signals/SignalsMonitor.tsx'),
    readSource('app/(ops)/ops/signals/signals.module.css'),
    readSource('app/(ops)/ops/loading.tsx'),
  ]);

  assert.match(tokens, /--ops-product-stage:/);
  assert.match(visual, /SafeProductImage/);
  assert.match(visual, /image \?/);
  assert.match(visual, /: fallback/);
  assert.match(activity, /OpsRecordVisual/);
  assert.match(overview, /OpsRecordVisual/);
  assert.match(signals, /OpsRecordVisual/);
  for (const css of [activityCss, overviewCss, signalsCss]) {
    assert.match(css, /background:\s*var\(--ops-product-stage\)/);
  }
  assert.match(overviewLoading, /skeletonRecentVisual/);
});
