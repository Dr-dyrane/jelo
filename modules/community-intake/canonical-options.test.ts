import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { concerns } from '@/data/knowledge';
import {
  communityPurposeOptions,
  communityPurposeRegistry,
} from '@/lib/community-intake/canonical-options';
import { unknownCommunityValues } from '@/lib/community-intake/moderation';
import { emptyContributionDraft } from '@/lib/community-intake/schema';

const root = process.cwd();

test('the eight intake purposes keep stable ids and explicit concern boundaries', () => {
  assert.deepEqual(
    communityPurposeRegistry.map(({ id, label, kind, concernSlug }) => ({
      id,
      label,
      kind,
      concernSlug,
    })),
    [
      { id: 'purpose:acne', label: 'Acne', kind: 'concern', concernSlug: 'acne-breakouts' },
      { id: 'purpose:dark-spots', label: 'Dark spots', kind: 'concern', concernSlug: 'dark-spots' },
      { id: 'purpose:oily-skin', label: 'Oily skin', kind: 'concern', concernSlug: 'oily-congested-skin' },
      { id: 'purpose:dry-skin', label: 'Dry skin', kind: 'concern', concernSlug: 'dry-dehydrated-skin' },
      { id: 'purpose:normal-skin', label: 'Normal skin', kind: 'skin-profile', concernSlug: null },
      { id: 'purpose:sensitive-skin', label: 'Sensitive skin', kind: 'concern', concernSlug: 'sensitive-barrier' },
      { id: 'purpose:hair', label: 'Hair', kind: 'area', concernSlug: null },
      { id: 'purpose:body', label: 'Body', kind: 'area', concernSlug: null },
    ],
  );
});

test('purpose aliases are reviewed concern names rather than clinical signals', () => {
  for (const purpose of communityPurposeRegistry) {
    if (purpose.kind !== 'concern') {
      assert.deepEqual(purpose.aliases, [], `${purpose.label} must stay outside concern aliases`);
      continue;
    }

    const concern = concerns.find(item => item.slug === purpose.concernSlug);
    assert.ok(concern, `Missing reviewed concern ${purpose.concernSlug}`);
    assert.equal(concern.kind, 'concern');
    assert.deepEqual(purpose.aliases, [concern.name]);
    for (const alias of purpose.aliases) {
      assert.equal(concern.signals.includes(alias), false, `${alias} must not come from concern signals`);
    }
  }
});

test('the contribution page consumes the registry without deriving aliases from clinical prose', async () => {
  const page = await readFile(path.join(root, 'app/(site)/contribute/page.tsx'), 'utf8');

  assert.match(page, /communityPurposeOptions/);
  assert.doesNotMatch(page, /@\/data\/knowledge/);
  assert.doesNotMatch(page, /concern\.signals|concernAliases/);
  assert.deepEqual(
    communityPurposeOptions.map(option => option.id),
    communityPurposeRegistry.map(option => option.id),
  );
});

test('an unrecognized purpose keeps its submitted language for moderation', () => {
  const draft = {
    ...emptyContributionDraft('product'),
    purposes: [{
      id: 'custom:chicken-skin',
      label: '  Chicken   Skin ',
      source: 'custom' as const,
    }],
  };

  assert.deepEqual(unknownCommunityValues(draft), [{
    kind: 'purpose',
    fieldPath: 'purposes',
    rawValue: '  Chicken   Skin ',
    normalizedValue: 'chicken skin',
  }]);
});
