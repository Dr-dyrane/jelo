import assert from 'node:assert/strict';
import test from 'node:test';
import { communityIntakeAttributionFromReferrer } from '@/lib/community-intake/attribution';

test('captures the bounded first-party campaign labels from a contribution landing URL', () => {
  assert.deepEqual(
    communityIntakeAttributionFromReferrer(
      'https://www.jelocare.com/contribute?utm_source=TikTok&utm_medium=Organic%20Social&utm_campaign=community-library-2026-07&utm_content=carousel',
    ),
    {
      source: 'tiktok',
      medium: 'organic-social',
      campaign: 'community-library-2026-07',
      content: 'carousel',
      landingPath: '/contribute',
    },
  );
});

test('direct and malformed referrers fail closed without collecting a full URL', () => {
  assert.deepEqual(communityIntakeAttributionFromReferrer(null), {
    source: 'direct',
    medium: null,
    campaign: null,
    content: null,
    landingPath: '/contribute',
  });
  assert.deepEqual(communityIntakeAttributionFromReferrer('not a URL'), {
    source: 'direct',
    medium: null,
    campaign: null,
    content: null,
    landingPath: '/contribute',
  });
});

test('campaign labels are normalized and capped to non-identifying slugs', () => {
  const attribution = communityIntakeAttributionFromReferrer(
    `https://www.jelocare.com/contribute?utm_source=${encodeURIComponent('<Tik Tok>')}&utm_campaign=${'x'.repeat(120)}&utm_content=${encodeURIComponent('Card 06!')}`,
  );
  assert.equal(attribution.source, 'tik-tok');
  assert.equal(attribution.campaign?.length, 80);
  assert.equal(attribution.content, 'card-06');
  assert.equal('referrer' in attribution, false);
});
