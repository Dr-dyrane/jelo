import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rankVocabularyTargets,
  vocabularyDisplayText,
  vocabularyDisplayTarget,
  vocabularyKindLabel,
  vocabularyReviewItem,
  type VocabularyReviewRecord,
  type VocabularyTarget,
} from '@/lib/moderation/vocabulary-presentation';

const base: VocabularyReviewRecord = {
  id: 'value-1',
  valueKind: 'product',
  rawValue: 'Glow wash',
  activeMentionCount: 3,
  contributionKinds: ['product', 'routine'],
  recentContexts: [{
    contributionKind: 'product',
    contributionPayload: {
      products: [{ label: 'Glow wash' }],
      brands: [{ label: 'Jelo Labs' }],
      retailers: [{ label: 'Local store' }],
    },
    submittedAt: '2026-07-20T10:00:00Z',
  }],
  firstSeenAt: '2026-07-01T10:00:00Z',
  lastSeenAt: '2026-07-20T10:00:00Z',
};

test('vocabulary presentation translates stored kinds into operator language', () => {
  assert.equal(vocabularyKindLabel('purpose'), 'Use');
  assert.equal(vocabularyKindLabel('product'), 'Product');
  assert.equal(vocabularyKindLabel('brand'), 'Brand');
  assert.equal(vocabularyKindLabel('retailer'), 'Store');
});

test('vocabulary presentation uses active reports and human submission contexts', () => {
  const item = vocabularyReviewItem(base);
  assert.equal(item.title, 'Glow wash');
  assert.equal(item.summary, '3 reports');
  assert.deepEqual(item.contextLabels, ['Product notes', 'Routine notes']);
  assert.deepEqual(item.recentContexts, [{
    title: 'Glow wash',
    detail: 'Jelo Labs · Local store',
    submittedAt: '2026-07-20T10:00:00Z',
  }]);
  assert.equal(item.firstSeenAt, base.firstSeenAt);
  assert.equal(item.lastSeenAt, base.lastSeenAt);
});

test('vocabulary presentation uses singular report copy', () => {
  const item = vocabularyReviewItem({ ...base, activeMentionCount: 1, contributionKinds: ['store'] });
  assert.equal(item.summary, '1 report');
  assert.deepEqual(item.contextLabels, ['Store listings']);
});

test('vocabulary display keeps accents and removes invisible or broken glyphs', () => {
  assert.equal(vocabularyDisplayText('  Sérénité\u200B  wash\u0000\uFFFD '), 'Sérénité wash');
  assert.equal(
    vocabularyReviewItem({ ...base, rawValue: '\u200E Glow\uFFFD wash ' }).title,
    'Glow wash',
  );
});

test('vocabulary targets are projected safely before they can be rendered', () => {
  assert.deepEqual(vocabularyDisplayTarget({
    kind: 'brand',
    ref: 'serenite',
    label: ' S\u00e9r\u00e9nit\u00e9\u200b ',
    detail: ' \u200eFrance\uFFFD ',
  }), {
    kind: 'brand',
    ref: 'serenite',
    label: 'S\u00e9r\u00e9nit\u00e9',
    detail: 'France',
  });
  assert.equal(vocabularyDisplayTarget({
    kind: 'brand',
    ref: 'broken',
    label: '\u200b\uFFFD',
    detail: null,
  }), null);
});

test('vocabulary suggestions are same-kind and rank the closest meaning first', () => {
  const targets: VocabularyTarget[] = [
    {
      kind: 'product',
      ref: 'mela-b3-serum',
      label: 'Mela B3 Serum',
      detail: 'La Roche-Posay · 30 ml',
    },
    {
      kind: 'product',
      ref: 'simple-replenishing-rich-moisturiser',
      label: 'Replenishing Rich Moisturiser',
      detail: 'Simple · 125 ml',
    },
    {
      kind: 'brand',
      ref: 'la-roche-posay',
      label: 'La Roche-Posay',
      detail: null,
    },
  ];

  assert.deepEqual(
    rankVocabularyTargets('Mela B3 La Roche posay', 'product', targets).map(target => target.ref),
    ['mela-b3-serum'],
  );
  assert.deepEqual(
    rankVocabularyTargets('anything', 'product', targets, 'replenishing rich').map(target => target.ref),
    ['simple-replenishing-rich-moisturiser'],
  );
  assert.equal(
    rankVocabularyTargets('La Roche Posay', 'product', targets).some(target => target.kind === 'brand'),
    false,
  );
});

test('vocabulary suggestions are deterministic and never return raw source labels', () => {
  const targets: VocabularyTarget[] = [
    { kind: 'retailer', ref: 'alpha', label: ' Alpha\u200b ', detail: ' Lagos\uFFFD ' },
    { kind: 'retailer', ref: 'beta', label: 'Alpha', detail: 'Abuja' },
    { kind: 'retailer', ref: 'blank', label: '\u200b', detail: 'Lagos' },
  ];

  assert.deepEqual(
    rankVocabularyTargets('Alpha', 'retailer', targets).map(target => ({
      ref: target.ref,
      label: target.label,
      detail: target.detail,
    })),
    [
      { ref: 'beta', label: 'Alpha', detail: 'Abuja' },
      { ref: 'alpha', label: 'Alpha', detail: 'Lagos' },
    ],
  );
  assert.deepEqual(
    rankVocabularyTargets('Alpha', 'retailer', targets, '\u200b').map(target => target.ref),
    ['beta', 'alpha'],
  );
});
