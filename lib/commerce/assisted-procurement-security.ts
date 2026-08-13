import 'server-only';

import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

export const assistedOrderCookieName = 'jelocare_order_session';
export const assistedOrderCookieMaxAge = 60 * 60 * 24 * 30;
export const assistedOrderRecoveryMaxAge = 60 * 20;

export function createOrderSecret() {
  return randomBytes(32).toString('base64url');
}

export function hashOrderSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export function createOrderRequestFingerprint(requestId: string, canonicalPayload: string) {
  return createHmac('sha256', requestId).update(canonicalPayload).digest('hex');
}

export function createOrderReference() {
  return `JC-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export function orderSessionHashFromRequest(request: NextRequest) {
  const secret = request.cookies.get(assistedOrderCookieName)?.value;
  return secret && secret.length >= 32 ? hashOrderSecret(secret) : null;
}

type AssistedOrderAction = 'create' | 'read' | 'decide' | 'recover';
let redis: Redis | null | undefined;
const limiters = new Map<AssistedOrderAction, Ratelimit>();

function redisClient() {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function limiterFor(action: AssistedOrderAction) {
  const cached = limiters.get(action);
  if (cached) return cached;
  const client = redisClient();
  if (!client) return null;
  const maximum = action === 'create' ? 5 : action === 'recover' ? 10 : action === 'decide' ? 20 : 180;
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(maximum, action === 'read' ? '1 m' : '1 h'),
    analytics: false,
    prefix: `jelocare:assisted-order:${action}`,
  });
  limiters.set(action, limiter);
  return limiter;
}

function networkKey(request: NextRequest) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? 'local';
  const address = forwarded.split(',')[0]?.trim() || 'local';
  const secret = process.env.ASSISTED_ORDER_RATE_LIMIT_SECRET
    ?? process.env.DATABASE_URL
    ?? 'local-development-only';
  return createHmac('sha256', secret).update(address).digest('hex');
}

export async function allowAssistedOrderAction(
  request: NextRequest,
  action: AssistedOrderAction,
) {
  const limiter = limiterFor(action);
  if (!limiter) return process.env.NODE_ENV !== 'production';
  return (await limiter.limit(networkKey(request))).success;
}

export function assistedOrderFixtureEnabled() {
  return (process.env.NODE_ENV !== 'production' || Boolean(process.env.NODE_TEST_CONTEXT))
    && process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE === 'true';
}
