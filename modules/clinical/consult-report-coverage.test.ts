import assert from 'node:assert/strict';
import test from 'node:test';
import { concernBySlug } from '@/data/knowledge';
import {
  concernGuideForPatternId,
} from '@/modules/clinical/consult-report';
import { differentialPatternIds } from '@/modules/clinical/core/differential';

test('every deterministic clinical pattern resolves to a canonical public guide', () => {
  const missing = differentialPatternIds.filter(
    patternId => !concernGuideForPatternId(patternId),
  );

  assert.deepEqual(
    missing,
    [],
    `Clinical patterns without canonical guides: ${missing.join(', ')}`,
  );

  for (const patternId of differentialPatternIds) {
    const guide = concernGuideForPatternId(patternId);
    assert.ok(guide, patternId);

    const canonical = concernBySlug(guide.slug);
    assert.ok(canonical, `${patternId} resolved to missing guide ${guide.slug}`);
    assert.deepEqual(guide.sources, canonical.sources, patternId);
  }
});
