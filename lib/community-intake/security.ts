import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
export { readBoundedJson, sameSiteRequest } from "./request-security";

export const contributionCookieName = "jelocare_contribution_edit";
export const contributionCookieMaxAge = 60 * 60 * 24 * 30;

export function createEditSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashEditSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function contributionCookieValue(draftId: string, secret: string) {
  return `${draftId}.${secret}`;
}

export function editSecretFromRequest(request: NextRequest, draftId: string) {
  const value = request.cookies.get(contributionCookieName)?.value;
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator < 1 || value.slice(0, separator) !== draftId) return null;
  const secret = value.slice(separator + 1);
  return secret.length >= 32 ? secret : null;
}

type CommunityAction = "create" | "save" | "submit";
let redis: Redis | null | undefined;
const limiters = new Map<CommunityAction, Ratelimit>();

function redisClient() {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function limiterFor(action: CommunityAction) {
  const cached = limiters.get(action);
  if (cached) return cached;
  const client = redisClient();
  if (!client) return null;
  const limiter = new Ratelimit({
    redis: client,
    limiter:
      action === "create"
        ? Ratelimit.slidingWindow(10, "1 h")
        : action === "submit"
          ? Ratelimit.slidingWindow(5, "1 h")
          : Ratelimit.slidingWindow(120, "1 m"),
    analytics: false,
    prefix: `jelocare:community-intake:${action}`,
  });
  limiters.set(action, limiter);
  return limiter;
}

function networkKey(request: NextRequest) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "local";
  const address = forwarded.split(",")[0]?.trim() || "local";
  const secret =
    process.env.COMMUNITY_INTAKE_RATE_LIMIT_SECRET ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    "local-development-only";
  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function allowCommunityAction(
  request: NextRequest,
  action: CommunityAction,
  draftId?: string,
) {
  const limiter = limiterFor(action);
  if (!limiter) return process.env.NODE_ENV !== "production";
  const result = await limiter.limit(
    `${networkKey(request)}${draftId ? `:${draftId}` : ""}`,
  );
  return result.success;
}
