import type { NextRequest } from 'next/server';
import { isAllowedCommunityRequest } from './request-origin';

const maxJsonBytes = 64 * 1024;

export function sameSiteRequest(request: Request | NextRequest) {
  const fallbackOrigin = 'nextUrl' in request
    ? request.nextUrl.origin
    : new URL(request.url).origin;
  return isAllowedCommunityRequest(request.headers, fallbackOrigin);
}

export async function readBoundedJson(request: Request | NextRequest) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxJsonBytes) throw new Error('payload_too_large');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxJsonBytes) throw new Error('payload_too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('invalid_json');
  }
}
