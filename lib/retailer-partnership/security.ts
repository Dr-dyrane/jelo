import 'server-only';

import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import {
  createEditSecret,
  hashEditSecret,
  readBoundedJson,
  sameSiteRequest,
} from '@/lib/community-intake/security';
import {
  parseRetailerPartnershipToken,
  retailerPartnershipToken,
} from './token';

export { createEditSecret, hashEditSecret, readBoundedJson, sameSiteRequest };
export { parseRetailerPartnershipToken, retailerPartnershipToken };

export const retailerPartnershipCookieName = 'jelocare_retailer_edit';
export const retailerPartnershipCookieMaxAge = 60 * 60 * 24 * 30;

export function retailerPartnershipSecretFromRequest(request: NextRequest, applicationId: string) {
  const parsed = parseRetailerPartnershipToken(request.cookies.get(retailerPartnershipCookieName)?.value ?? null);
  return parsed?.applicationId === applicationId ? parsed.secret : null;
}

type RetailerAction = 'create' | 'save' | 'submit' | 'magic';
let redis: Redis | null | undefined;
const limiters = new Map<RetailerAction, Ratelimit>();

function redisClient() {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function limiterFor(action: RetailerAction) {
  const cached = limiters.get(action);
  if (cached) return cached;
  const client = redisClient();
  if (!client) return null;
  const maximum = action === 'create' ? 5 : action === 'submit' ? 8 : action === 'magic' ? 20 : 120;
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(maximum, action === 'save' ? '1 m' : '1 h'),
    analytics: false,
    prefix: `jelocare:retailer-partnership:${action}`,
  });
  limiters.set(action, limiter);
  return limiter;
}

function networkKey(request: NextRequest) {
  const forwarded = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') ?? 'local';
  const address = forwarded.split(',')[0]?.trim() || 'local';
  const secret = process.env.RETAILER_PARTNERSHIP_RATE_LIMIT_SECRET
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL
    ?? 'local-development-only';
  return createHmac('sha256', secret).update(address).digest('hex');
}

export async function allowRetailerPartnershipAction(
  request: NextRequest,
  action: RetailerAction,
  applicationId?: string,
) {
  const limiter = limiterFor(action);
  if (!limiter) return true;
  const result = await limiter.limit(`${networkKey(request)}${applicationId ? `:${applicationId}` : ''}`);
  return result.success;
}
