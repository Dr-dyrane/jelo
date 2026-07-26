export type CommunityIntakeAttribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  landingPath: string;
};

const tokenPattern = /^[a-z0-9][a-z0-9._-]{0,79}$/;

function attributionToken(value: string | null) {
  if (!value) return null;
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-NG')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return tokenPattern.test(normalized) ? normalized : null;
}

export function communityIntakeAttributionFromReferrer(
  referrer: string | null,
): CommunityIntakeAttribution {
  let landing: URL | null = null;
  try {
    landing = referrer ? new URL(referrer) : null;
  } catch {
    landing = null;
  }

  const source = attributionToken(landing?.searchParams.get('utm_source') ?? null) ?? 'direct';
  const medium = attributionToken(landing?.searchParams.get('utm_medium') ?? null);
  const campaign = attributionToken(landing?.searchParams.get('utm_campaign') ?? null);
  const content = attributionToken(landing?.searchParams.get('utm_content') ?? null);
  const landingPath = landing?.pathname.startsWith('/contribute')
    ? landing.pathname.slice(0, 120)
    : '/contribute';

  return { source, medium, campaign, content, landingPath };
}
