import assert from 'node:assert/strict';
import test from 'node:test';
import { concerns } from '@/data/knowledge';

test('provides sourced concern guidance without turning condition patterns into product matches', () => {
  assert.ok(concerns.length >= 19);
  assert.equal(new Set(concerns.map(concern => concern.slug)).size, concerns.length);

  for (const concern of concerns) {
    assert.ok(concern.signals.length > 0, concern.slug);
    assert.ok(concern.escalation.length > 0, concern.slug);
    assert.ok(concern.sources.length > 0, concern.slug);
    assert.match(concern.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const source of concern.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname === 'www.aad.org' || url.hostname === 'www.nhs.uk', source.url);
    }
    if (concern.kind === 'condition-pattern') {
      assert.deepEqual(concern.productTerms, [], `${concern.slug} must not drive product recommendations`);
    }
  }
});
