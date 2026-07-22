function firstForwardedValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

export function isAllowedCommunityRequest(headers: Headers, fallbackOrigin: string) {
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false;

  const origin = headers.get('origin');
  if (!origin) return true;

  const expectedHost = firstForwardedValue(headers.get('x-forwarded-host')) ?? headers.get('host');
  if (!expectedHost) return origin === fallbackOrigin;

  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
