import "server-only";

import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  catalogueSearchRateLimitMaximum,
  catalogueSearchRateLimitWindow,
  catalogueSearchRateLimitWindowSeconds,
  catalogueSearchRetryAfterSeconds,
} from "./catalogue-search-rate-limit-policy";

export type CatalogueSearchRateLimitDecision = {
  allowed: boolean;
  configured: boolean;
  retryAfterSeconds: number;
};

let limiter: Ratelimit | undefined;

function configuredLimiter() {
  if (limiter) return limiter;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("incomplete_redis_configuration");
  }

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(
      catalogueSearchRateLimitMaximum,
      catalogueSearchRateLimitWindow,
    ),
    analytics: false,
    prefix: "jelocare:catalogue-search",
  });

  return limiter;
}

function catalogueSearchNetworkKey(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    "local";
  const address = forwarded.split(",")[0]?.trim() || "local";
  const secret =
    process.env.CATALOGUE_SEARCH_RATE_LIMIT_SECRET ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    "local-development-only";

  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function catalogueSearchRateLimit(
  request: Request,
): Promise<CatalogueSearchRateLimitDecision> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url && !token) {
    return {
      allowed: process.env.NODE_ENV !== "production",
      configured: false,
      retryAfterSeconds:
        process.env.NODE_ENV === "production"
          ? catalogueSearchRateLimitWindowSeconds
          : 0,
    };
  }

  try {
    const result = await configuredLimiter().limit(
      catalogueSearchNetworkKey(request),
    );

    return {
      allowed: result.success,
      configured: true,
      retryAfterSeconds: result.success
        ? 0
        : catalogueSearchRetryAfterSeconds(result.reset),
    };
  } catch {
    console.error("[catalogue-search] Configured rate limiter is unavailable.");

    return {
      allowed: false,
      configured: true,
      retryAfterSeconds: catalogueSearchRateLimitWindowSeconds,
    };
  }
}
