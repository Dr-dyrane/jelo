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
};

function networkKey(request: Request) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? 'local';
  const address = forwarded.split(',')[0]?.trim() || 'local';
  const secret = process.env.CONSULT_RATE_LIMIT_SECRET
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL
    ?? 'local-development-only';
  return createHmac('sha256', secret).update(address).digest('hex');
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

  try {
    const result = await consultLimiter.limit(`consult:${networkKey(request)}`);
    return {
      allowed: result.success,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((result.reset - (dependencies.now ?? Date.now)()) / 1000),
      ),
    };
  } catch {
    (dependencies.onProviderError ?? (() => {
      console.error('[consult] Configured rate limiter is unavailable.');
    }))();
    return {
      allowed: false,
      retryAfterSeconds: 60,
    };
  }
}

export async function allowConsultAction(request: Request) {
  return (await checkConsultRateLimit(request)).allowed;
}
