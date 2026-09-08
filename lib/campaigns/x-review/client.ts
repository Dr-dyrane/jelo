import "server-only";

import { z } from "zod";

export type XReviewPost = {
  id: string;
  text: string;
  authorId: string;
  username: string | null;
  createdAt: string;
  metrics: {
    replies: number;
    reposts: number;
    likes: number;
    views: number | null;
  };
  parent: {
    id: string;
    text: string;
    authorId: string;
    username: string | null;
  } | null;
  hasMedia: boolean;
  sensitive: boolean;
};

export type XReviewBatch = {
  posts: XReviewPost[];
  moreAvailable: boolean;
  accountId: string;
};

const RESPONSE_BYTE_LIMIT = 150 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const accountUrl = "https://api.x.com/2/users/by/username/jelocare";
const idSchema = z.string().regex(/^\d{1,25}$/);
const usernameSchema = z.string().regex(/^[A-Za-z0-9_]{1,15}$/);
const textSchema = z
  .string()
  .min(1)
  .max(4000)
  .refine((text) => /\S/.test(text));
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const userSchema = z.object({ id: idSchema, username: usernameSchema });
const attachmentSchema = z.object({
  media_keys: z.array(z.string().min(1).max(100)).max(16).optional(),
});
const parentSchema = z.object({
  id: idSchema,
  text: textSchema,
  author_id: idSchema,
  attachments: attachmentSchema.optional(),
  possibly_sensitive: z.boolean().optional(),
});
const postSchema = parentSchema.extend({
  created_at: z.string().datetime({ offset: true }),
  in_reply_to_user_id: idSchema.optional(),
  public_metrics: z.object({
    reply_count: countSchema,
    retweet_count: countSchema,
    like_count: countSchema,
    impression_count: countSchema.optional(),
  }),
  referenced_tweets: z
    .array(
      z.object({
        type: z.enum(["replied_to", "quoted", "retweeted"]),
        id: idSchema,
      }),
    )
    .max(3)
    .optional(),
});
const envelopeSchema = z.object({
  data: z.array(z.unknown()).max(5).optional(),
  includes: z
    .object({
      tweets: z.array(z.unknown()).max(15).optional(),
      users: z.array(z.unknown()).max(5).optional(),
    })
    .optional(),
  meta: z
    .object({
      result_count: countSchema.max(5).optional(),
      next_token: z.string().min(1).max(1024).optional(),
    })
    .optional(),
  errors: z.unknown().optional(),
});

class XReviewReadError extends Error {}

/** Never retain or propagate a provider body, fetch error, or credential. */
async function readJson(
  url: string,
  bearerToken: string,
  fetcher: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new XReviewReadError("x_review_request_timeout"));
    }, REQUEST_TIMEOUT_MS);
  });
  const request = async () => {
    const response = await fetcher(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
      },
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
    if (
      !response.ok ||
      response.redirected ||
      (response.url && response.url !== url)
    ) {
      void response.body?.cancel().catch(() => {});
      throw new XReviewReadError("x_review_http_error");
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null && Number(contentLength) > RESPONSE_BYTE_LIMIT) {
      void response.body?.cancel().catch(() => {});
      throw new XReviewReadError("x_review_response_too_large");
    }
    if (!response.body) throw new XReviewReadError("x_review_invalid_response");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let complete = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          complete = true;
          break;
        }
        size += value.byteLength;
        if (size > RESPONSE_BYTE_LIMIT) {
          throw new XReviewReadError("x_review_response_too_large");
        }
        chunks.push(value);
      }
    } finally {
      if (!complete) void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch {
      throw new XReviewReadError("x_review_invalid_response");
    }
  };
  try {
    return await Promise.race([request(), timeout]);
  } catch (error) {
    if (error instanceof XReviewReadError) throw error;
    throw new XReviewReadError("x_review_request_failed");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}

/** A maximum of two read-only requests; never paginate, retry, or fetch media. */
export async function readXReviewBatch(
  input: { bearerToken: string; sinceId?: string; now: Date },
  fetcher: typeof fetch = fetch,
): Promise<XReviewBatch> {
  if (
    typeof input.bearerToken !== "string" ||
    input.bearerToken.length === 0 ||
    input.bearerToken.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(input.bearerToken) ||
    !(input.now instanceof Date) ||
    !Number.isFinite(input.now.getTime()) ||
    (input.sinceId !== undefined && !idSchema.safeParse(input.sinceId).success)
  ) {
    throw new XReviewReadError("x_review_invalid_input");
  }
  const account = z
    .object({ data: userSchema })
    .safeParse(await readJson(accountUrl, input.bearerToken, fetcher));
  if (
    !account.success ||
    account.data.data.username.toLowerCase() !== "jelocare"
  ) {
    throw new XReviewReadError("x_review_account_mismatch");
  }
  const accountId = account.data.data.id;
  const url = new URL(`https://api.x.com/2/users/${accountId}/mentions`);
  url.searchParams.set("max_results", "5");
  url.searchParams.set(
    "tweet.fields",
    "created_at,public_metrics,author_id,in_reply_to_user_id,referenced_tweets,attachments,possibly_sensitive",
  );
  url.searchParams.set("expansions", "author_id,referenced_tweets.id");
  url.searchParams.set("user.fields", "username");
  if (input.sinceId !== undefined)
    url.searchParams.set("since_id", input.sinceId);
  const parsed = envelopeSchema.safeParse(
    await readJson(url.toString(), input.bearerToken, fetcher),
  );
  if (
    !parsed.success ||
    parsed.data.errors !== undefined ||
    (parsed.data.data === undefined && parsed.data.meta?.result_count !== 0) ||
    (parsed.data.meta?.result_count !== undefined &&
      parsed.data.meta.result_count !== (parsed.data.data?.length ?? 0))
  ) {
    throw new XReviewReadError("x_review_invalid_batch");
  }
  const batch = parsed.data;
  const users = new Map<string, string>();
  const duplicateUsers = new Set<string>();
  for (const candidate of batch.includes?.users ?? []) {
    const user = userSchema.safeParse(candidate);
    if (!user.success) continue;
    if (users.has(user.data.id)) duplicateUsers.add(user.data.id);
    users.set(user.data.id, user.data.username);
  }
  for (const id of duplicateUsers) users.delete(id);
  const parents = new Map<string, z.infer<typeof parentSchema>>();
  const duplicateParents = new Set<string>();
  for (const candidate of batch.includes?.tweets ?? []) {
    const parent = parentSchema.safeParse(candidate);
    if (!parent.success) continue;
    if (parents.has(parent.data.id)) duplicateParents.add(parent.data.id);
    parents.set(parent.data.id, parent.data);
  }
  for (const id of duplicateParents) parents.delete(id);
  const posts: XReviewPost[] = [];
  let incomplete = false;
  const seen = new Set<string>();
  const now = input.now.getTime();
  for (const candidate of batch.data ?? []) {
    const result = postSchema.safeParse(candidate);
    if (!result.success) {
      incomplete = true;
      continue;
    }
    const post = result.data;
    const created = Date.parse(post.created_at);
    if (!Number.isFinite(created) || created > now) {
      incomplete = true;
      continue;
    }
    if (created < now - RECENT_WINDOW_MS || seen.has(post.id)) continue;
    const references = post.referenced_tweets ?? [];
    // The review contract carries one parent only; never discard a second
    // source's care context to make an interaction appear safe for drafting.
    if (references.length > 1) {
      incomplete = true;
      continue;
    }
    // An RT wrapper can have shortened text; it is not a new direct interaction.
    if (references.some((reference) => reference.type === "retweeted"))
      continue;
    const reference =
      references.find((item) => item.type === "replied_to") ??
      references.find((item) => item.type === "quoted");
    const parent = reference ? parents.get(reference.id) : undefined;
    const referencedParents = references.map((item) => parents.get(item.id));
    // Missing/deleted parent context must not be represented as a standalone post.
    if (
      (reference && !parent) ||
      referencedParents.some((item) => !item) ||
      (post.in_reply_to_user_id &&
        (reference?.type !== "replied_to" ||
          parent?.author_id !== post.in_reply_to_user_id))
    ) {
      incomplete = true;
      continue;
    }
    seen.add(post.id);
    posts.push({
      id: post.id,
      text: post.text,
      authorId: post.author_id,
      username: users.get(post.author_id) ?? null,
      createdAt: post.created_at,
      metrics: {
        replies: post.public_metrics.reply_count,
        reposts: post.public_metrics.retweet_count,
        likes: post.public_metrics.like_count,
        views: post.public_metrics.impression_count ?? null,
      },
      parent: parent
        ? {
            id: parent.id,
            text: parent.text,
            authorId: parent.author_id,
            username:
              users.get(parent.author_id) ??
              (parent.author_id === accountId ? "jelocare" : null),
          }
        : null,
      hasMedia: Boolean(
        post.attachments?.media_keys?.length ||
        referencedParents.some((item) => item?.attachments?.media_keys?.length),
      ),
      sensitive: Boolean(
        post.possibly_sensitive ||
        referencedParents.some((item) => item?.possibly_sensitive),
      ),
    });
  }
  // A bounded/partially unusable response must never look like complete coverage.
  return {
    posts,
    moreAvailable: incomplete || Boolean(batch.meta?.next_token),
    accountId,
  };
}
