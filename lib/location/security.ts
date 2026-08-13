import "server-only";

import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | undefined;
let networkLimiter: Ratelimit | undefined;
let geoapifyLimiter: Ratelimit | undefined;
let nominatimLimiter: Ratelimit | undefined;

function configuredRedis() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function networkKey(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "local";
  const address = forwarded.split(",")[0]?.trim() || "local";
  const secret =
    process.env.LOCATION_RATE_LIMIT_SECRET ??
    process.env.ASSISTED_ORDER_RATE_LIMIT_SECRET ??
    process.env.DATABASE_URL ??
    "local-development-only";
  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function allowLocationSuggestion(request: Request) {
  const client = configuredRedis();
  if (!client) return process.env.NODE_ENV !== "production";
  networkLimiter ??= new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: false,
    prefix: "jelocare:location-suggest:network",
  });
  // Geoapify free plan allows 5 requests per second.
  geoapifyLimiter ??= new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(4, "1 s"),
    analytics: false,
    prefix: "jelocare:location-suggest:geoapify",
  });
  // Nominatim usage policy requires max 1 request per second.
  nominatimLimiter ??= new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(1, "1 s"),
    analytics: false,
    prefix: "jelocare:location-suggest:nominatim",
  });
  try {
    const [network, geoapify, nominatim] = await Promise.all([
      networkLimiter.limit(networkKey(request)),
      geoapifyLimiter.limit("geoapify-free-plan"),
      nominatimLimiter.limit("nominatim-public"),
    ]);
    // Allow if the network bucket has capacity and at least one provider
    // bucket is available. The orchestrator will try the available provider.
    return network.success && (geoapify.success || nominatim.success);
  } catch {
    console.error("[location] Configured rate limiter is unavailable.");
    return false;
  }
}
