import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let limiter: Ratelimit | undefined;

type ConsultLimiter = {
  limit(identifier: string): Promise<{
    success: boolean;
    reset: number;
  }>;
};

type ConsultRateLimitDependencies = {
  limiter?: ConsultLimiter | null;
  environment?: 'development' | 'production' | 'test';
  now?: () => number;
  onProviderError?: () => void;
  secret?: string;
};

type ConsultRateLimitContext = {
  accountSubject?: string | null;
};

function rateLimitSecret() {
  return process.env.CONSULT_RATE_LIMIT_SECRET
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL
    ?? 'local-development-only';
}

function networkKey(request: Request, secret: string) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? 'local';
  const address = forwarded.split(',')[0]?.trim() || 'local';
  return createHmac('sha256', secret).update(address).digest('hex');
}

function accountKey(subject: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`account\0${subject}`)
    .digest('hex');
}

function configuredLimiter(): ConsultLimiter | undefined {
  if (limiter) return limiter;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: false,
    prefix: 'jelocare:consult',
  });
  return limiter;
}

export function allowMissingConsultLimiter(environment = process.env.NODE_ENV) {
  return environment !== 'production';
}

export type ConsultRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkConsultRateLimit(
  request: Request,
  context: ConsultRateLimitContext = {},
  dependencies: ConsultRateLimitDependencies = {},
): Promise<ConsultRateLimitDecision> {
  const consultLimiter = dependencies.limiter === undefined
    ? configuredLimiter()
    : dependencies.limiter;
  if (!consultLimiter) {
    const allowed = allowMissingConsultLimiter(dependencies.environment);
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : 3600,
    };
  }

  const secret = dependencies.secret ?? rateLimitSecret();
  const identifiers = [`consult:${networkKey(request, secret)}`];
  if (context.accountSubject) {
    identifiers.push(`consult:account:${accountKey(context.accountSubject, secret)}`);
  }

  const results = await Promise.allSettled(
    identifiers.map(identifier => consultLimiter.limit(identifier)),
  );
  const providerFailed = results.some(result => result.status === 'rejected');
  if (providerFailed) {
    (dependencies.onProviderError ?? (() => {
      console.error('[consult] Configured rate limiter is unavailable.');
    }))();
  }

  const now = (dependencies.now ?? Date.now)();
  const fulfilled = results.flatMap(result => (
    result.status === 'fulfilled' ? [result.value] : []
  ));
  const denied = fulfilled.filter(result => !result.success);
  const applicable = denied.length > 0
    ? denied
    : providerFailed
      ? []
      : fulfilled;
  const retryAfterSeconds = Math.max(
    providerFailed ? 60 : 1,
    ...applicable.map(result => Math.max(
      1,
      Math.ceil((result.reset - now) / 1000),
    )),
  );

  return {
    allowed: !providerFailed && denied.length === 0,
    retryAfterSeconds,
  };
}

export async function allowConsultAction(
  request: Request,
  accountSubject?: string | null,
) {
  return (await checkConsultRateLimit(request, { accountSubject })).allowed;
}
