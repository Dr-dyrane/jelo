import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { concerns } from '@/data/knowledge';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';

function concern(slug: string) {
  const value = concerns.find(candidate => candidate.slug === slug);
  assert.ok(value, `Missing concern guide ${slug}`);
  return value;
}

test('unconditional urgent patterns publish a concise action before optional care', async () => {
  const expected = new Map([
    ['cellulitis-pattern', 'same-day'],
    ['fever-non-fading-rash-pattern', 'emergency'],
    ['fever-spreading-rash-pattern', 'same-day'],
    ['medicine-rash-warning-pattern', 'emergency'],
    ['rapid-gum-face-change-pattern', 'same-day'],
    ['product-chemical-burn-pattern', 'emergency'],
    ['yellow-skin-or-eyes-pattern', 'same-day'],
    ['diabetes-foot-change-pattern', 'same-day'],
  ]);

  for (const [slug, urgency] of expected) {
    const guide = concern(slug);
    assert.equal(guide.kind, 'condition-pattern');
    assert.equal(guide.urgentAction?.urgency, urgency, slug);
    assert.ok((guide.urgentAction?.guidance.length ?? 0) > 30, `${slug} needs a useful first action`);
    assert.doesNotMatch(guide.urgentAction?.guidance ?? '', /product|browse|shop/i, slug);
  }

  for (const guide of concerns.filter(candidate => candidate.urgentAction)) {
    assert.equal(guide.kind, 'condition-pattern', `${guide.slug} must not manufacture shopping urgency`);
    assert.deepEqual(guide.productTerms, [], `${guide.slug} must remain product-ineligible`);
  }

  const page = await readFile(path.join(process.cwd(), 'app/(site)/concerns/[slug]/page.tsx'), 'utf8');
  assert.match(page, />What to do now</);
  assert.match(
    page,
    /concern\.kind === 'concern'\s*\?\s*\(await listRecommendationEligibleProducts\(\)\)/,
    'An urgent pattern guide must not wait on catalogue data before it can render.',
  );
  assert.ok(
    page.indexOf('concern-urgent-action') < page.indexOf('concern-detail-grid'),
    'The immediate action must render before signs and optional care.',
  );
  assert.match(page, /concern\.kind === 'concern' \? <section className="concern-matches"/);
  assert.doesNotMatch(page, /No product shortlist for this pattern/);
});

test('static urgency stays in parity with representative deterministic referrals', () => {
  const cases = [
    {
      slug: 'product-chemical-burn-pattern',
      query: 'I splashed bleach and have a chemical burn.',
      actionUrgency: 'emergency',
      referralUrgency: 'immediate',
    },
    {
      slug: 'fever-non-fading-rash-pattern',
      query: 'I have fever and a rash that does not fade when pressed.',
      actionUrgency: 'emergency',
      referralUrgency: 'immediate',
    },
    {
      slug: 'yellow-skin-or-eyes-pattern',
      query: 'The whites of my eyes look yellow.',
      actionUrgency: 'same-day',
      referralUrgency: 'same-day',
    },
  ] as const;

  for (const item of cases) {
    const guide = concern(item.slug);
    const assessment = assessClinicalRoutine(item.query);
    assert.equal(guide.urgentAction?.urgency, item.actionUrgency, item.slug);
    assert.equal(assessment.referral.urgency, item.referralUrgency, item.slug);
    assert.ok(
      guide.kind === 'condition-pattern' && guide.clinicalPatternIds.includes(assessment.differential.primary?.id ?? ''),
      `${item.slug} must map to the deterministic pattern used by Ask Jelo`,
    );
  }

  const heat = concern('heat-rash-pattern');
  const heatAssessment = assessClinicalRoutine('Small prickly bumps appeared after heavy sweating.');
  assert.equal(heat.name, 'Prickly bumps after heat or sweating');
  assert.equal(heat.urgentAction, undefined);
  assert.equal(heatAssessment.referral.urgency, 'routine');
  assert.equal(heatAssessment.differential.primary?.id, 'miliaria-like');
});

test('ingredient and sexual-health copy keeps the audited safety qualifiers beside the action', () => {
  const acne = concern('acne-breakouts');
  const adapalene = acne.ingredients.find(item => item.toLowerCase().includes('adapalene'));
  assert.match(adapalene ?? '', /do not use during pregnancy/i);
  assert.ok(
    acne.sources.some(source => source.url === 'https://www.nhs.uk/conditions/acne/treatment/'),
    'Adapalene pregnancy guidance needs its NHS source.',
  );
  assert.equal(
    acne.ingredientSources?.[adapalene ?? '']?.url,
    'https://www.nhs.uk/conditions/acne/treatment/',
    'The pregnancy source must render beside the adapalene warning.',
  );

  const genital = concern('genital-sore-discharge-pattern');
  const guidance = genital.ingredients.join(' ');
  assert.match(guidance, /avoid sexual contact until assessed and symptoms have resolved/i);
  assert.doesNotMatch(guidance, /without a condom/i);
});
