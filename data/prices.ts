export type Market = 'NG' | 'US';

export function inferMarket(): Market {
  if (typeof navigator === 'undefined') return 'NG';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return navigator.language.toLowerCase().includes('en-us') || zone.startsWith('America/') ? 'US' : 'NG';
}
