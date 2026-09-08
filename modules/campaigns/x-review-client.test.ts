import assert from "node:assert/strict";
import test from "node:test";
import { readXReviewBatch } from "@/lib/campaigns/x-review/client";

const bearerToken = "private-test-token-never-in-errors";
const now = new Date("2026-09-07T10:00:00Z");
const input = { bearerToken, now };
const account = { data: { id: "123", username: "jelocare" } };
const post = (overrides: Record<string, unknown> = {}) => ({
  id: "300",
  text: "@jelocare Can you help? 😭",
  author_id: "456",
  created_at: "2026-09-07T09:00:00Z",
  public_metrics: {
    reply_count: 2,
    retweet_count: 3,
    like_count: 4,
    impression_count: 60,
  },
  ...overrides,
});
function mockFetch(responses: unknown[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response instanceof Response ? response : Response.json(response);
  }) as typeof fetch;
  return { calls, fetcher };
}

test("X review uses exactly two fixed GETs, bounded expansions, header auth, and no pagination", async () => {
  const { calls, fetcher } = mockFetch([
    account,
    {
      data: [post({ referenced_tweets: [{ type: "replied_to", id: "200" }] })],
      includes: {
        users: [{ id: "456", username: "reader" }],
        tweets: [{ id: "200", text: "Our exact parent 🧴", author_id: "123" }],
      },
      meta: { next_token: "do-not-follow", result_count: 1 },
    },
  ]);
  const batch = await readXReviewBatch({ ...input, sinceId: "100" }, fetcher);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.x.com/2/users/by/username/jelocare");
  const url = new URL(calls[1].url);
  assert.equal(url.origin, "https://api.x.com");
  assert.equal(url.pathname, "/2/users/123/mentions");
  assert.equal(url.searchParams.get("max_results"), "5");
  assert.equal(url.searchParams.get("since_id"), "100");
  assert.equal(
    url.searchParams.get("expansions"),
    "author_id,referenced_tweets.id",
  );
  assert.equal(url.searchParams.get("user.fields"), "username");
  assert.equal(
    url.searchParams.get("tweet.fields"),
    "created_at,public_metrics,author_id,in_reply_to_user_id,referenced_tweets,attachments,possibly_sensitive",
  );
  assert.equal(url.searchParams.has("pagination_token"), false);
  for (const call of calls) {
    assert.equal(call.init?.method, "GET");
    assert.equal(call.init?.redirect, "error");
    assert.equal(call.init?.cache, "no-store");
    assert.equal(
      new Headers(call.init?.headers).get("authorization"),
      `Bearer ${bearerToken}`,
    );
    assert.ok(call.init?.signal instanceof AbortSignal);
    assert.equal(call.url.includes(bearerToken), false);
  }
  assert.deepEqual(batch, {
    accountId: "123",
    moreAvailable: true,
    posts: [
      {
        id: "300",
        text: "@jelocare Can you help? 😭",
        authorId: "456",
        username: "reader",
        createdAt: "2026-09-07T09:00:00Z",
        metrics: { replies: 2, reposts: 3, likes: 4, views: 60 },
        parent: {
          id: "200",
          text: "Our exact parent 🧴",
          authorId: "123",
          username: "jelocare",
        },
        hasMedia: false,
        sensitive: false,
      },
    ],
  });
});

test("X review preserves standalone and quoted context, flags source media and sensitivity, and allows unknown usernames/views", async () => {
  const { fetcher } = mockFetch([
    account,
    {
      data: [
        post({
          id: "301",
          public_metrics: { reply_count: 0, retweet_count: 0, like_count: 0 },
        }),
        post({
          id: "302",
          referenced_tweets: [{ type: "quoted", id: "201" }],
          possibly_sensitive: true,
        }),
        post({ id: "303", attachments: { media_keys: ["3_123"] } }),
      ],
      includes: {
        tweets: [
          {
            id: "201",
            text: "Quoted source",
            author_id: "789",
            attachments: { media_keys: ["3_201"] },
          },
        ],
      },
    },
  ]);
  const { posts } = await readXReviewBatch(input, fetcher);
  assert.equal(posts.length, 3);
  assert.equal(posts[0].parent, null);
  assert.equal(posts[0].username, null);
  assert.equal(posts[0].metrics.views, null);
  assert.deepEqual(posts[1].parent, {
    id: "201",
    text: "Quoted source",
    authorId: "789",
    username: null,
  });
  assert.equal(posts[1].hasMedia, true);
  assert.equal(posts[1].sensitive, true);
  assert.equal(posts[2].hasMedia, true);
});

test("X review skips malformed, incomplete, and overlong posts without truncating text", async () => {
  const { fetcher } = mockFetch([
    account,
    {
      data: [
        post({ id: "301", text: "x".repeat(4001) }),
        post({ id: "302", author_id: undefined }),
        post({
          id: "303",
          public_metrics: { reply_count: -1, retweet_count: 0, like_count: 1 },
        }),
        post({ id: "304", created_at: "not-a-date" }),
        post({
          id: "305",
          text: "Exactly this text  \n🧴",
          possibly_sensitive: true,
        }),
      ],
    },
  ]);
  const batch = await readXReviewBatch(input, fetcher);
  assert.deepEqual(
    batch.posts.map((item) => [item.id, item.text]),
    [["305", "Exactly this text  \n🧴"]],
  );
  assert.equal(batch.moreAvailable, true);
});

test("X review skips missing, malformed, and multi-reference media context", async () => {
  const { fetcher } = mockFetch([
    account,
    {
      data: [
        post({
          id: "301",
          referenced_tweets: [{ type: "replied_to", id: "201" }],
        }),
        post({ id: "302", referenced_tweets: [{ type: "quoted", id: "202" }] }),
        post({
          id: "303",
          referenced_tweets: [
            { type: "quoted", id: "203" },
            { type: "replied_to", id: "204" },
          ],
        }),
        post({ id: "304", in_reply_to_user_id: "123" }),
      ],
      includes: {
        tweets: [
          { id: "202", author_id: "789", text: "x".repeat(4001) },
          {
            id: "203",
            author_id: "789",
            text: "Quote",
            attachments: { media_keys: ["3_203"] },
          },
          {
            id: "204",
            author_id: "123",
            text: "Reply parent",
            possibly_sensitive: true,
          },
        ],
      },
    },
  ]);
  const { posts, moreAvailable } = await readXReviewBatch(input, fetcher);
  assert.deepEqual(posts, []);
  assert.equal(moreAvailable, true);
});

test("X review does not discard quoted care text behind a safe reply parent", async () => {
  const { fetcher } = mockFetch([
    account,
    {
      data: [
        post({
          referenced_tweets: [
            { type: "replied_to", id: "200" },
            { type: "quoted", id: "201" },
          ],
        }),
      ],
      includes: {
        tweets: [
          { id: "200", author_id: "123", text: "How is your routine going?" },
          { id: "201", author_id: "789", text: "my face is burning" },
        ],
      },
    },
  ]);
  const batch = await readXReviewBatch(input, fetcher);
  assert.deepEqual(batch.posts, []);
  assert.equal(batch.moreAvailable, true);
});

test("X review enforces the 48h window, suppresses duplicates, and excludes RT wrappers", async () => {
  const { fetcher } = mockFetch([
    account,
    {
      data: [
        post({ id: "301", created_at: "2026-09-05T09:59:59Z" }),
        post({ id: "302", created_at: "2026-09-05T10:00:00Z" }),
        post({ id: "302", text: "Duplicate" }),
        post({ id: "303", created_at: "2026-09-07T10:00:01Z" }),
        post({
          id: "304",
          referenced_tweets: [{ type: "retweeted", id: "200" }],
        }),
      ],
    },
  ]);
  assert.deepEqual(
    (await readXReviewBatch(input, fetcher)).posts.map((item) => item.id),
    ["302"],
  );
});

test("X review rejects invalid input before fetching", async () => {
  for (const invalid of [
    { sinceId: "123&max_results=100" },
    { sinceId: "-1" },
    { sinceId: "" },
    { bearerToken: "unsafe\r\nheader" },
    { bearerToken: "" },
    { now: new Date("invalid") },
  ]) {
    const { calls, fetcher } = mockFetch([]);
    await assert.rejects(
      readXReviewBatch({ ...input, ...invalid }, fetcher),
      /^Error: x_review_invalid_input$/,
    );
    assert.equal(calls.length, 0);
  }
});

test("X review rejects mismatched or malformed accounts before requesting mentions", async () => {
  for (const value of [
    { data: { id: "123", username: "other" } },
    { data: { id: "../other", username: "jelocare" } },
    {},
  ]) {
    const { calls, fetcher } = mockFetch([value]);
    await assert.rejects(
      readXReviewBatch(input, fetcher),
      /^Error: x_review_account_mismatch$/,
    );
    assert.equal(calls.length, 1);
  }
});

test("X review does not retry or surface provider bodies, credentials, or raw network errors", async () => {
  for (const failure of [
    new Error(`failed Authorization Bearer ${bearerToken}`),
    new Response(`private provider error ${bearerToken}`, { status: 403 }),
    new Response(`{malformed ${bearerToken}`, { status: 200 }),
    new Response("", {
      status: 302,
      headers: { location: "https://untrusted.test" },
    }),
  ]) {
    const { calls, fetcher } = mockFetch([failure]);
    await assert.rejects(readXReviewBatch(input, fetcher), (error: Error) => {
      assert.match(
        error.message,
        /^x_review_(request_failed|http_error|invalid_response)$/,
      );
      assert.equal(error.message.includes(bearerToken), false);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(calls.length, 1);
  }
});

test("X review rejects oversized headers or streamed bodies without retries", async () => {
  for (const response of [
    new Response("{}", { headers: { "content-length": "999999999" } }),
    new Response("x".repeat(150 * 1024 + 1)),
  ]) {
    const { calls, fetcher } = mockFetch([response]);
    await assert.rejects(
      readXReviewBatch(input, fetcher),
      /^Error: x_review_response_too_large$/,
    );
    assert.equal(calls.length, 1);
  }
});

test("X review rejects unbounded envelopes and API partial failures, allowing confirmed empty timelines", async () => {
  for (const body of [
    {},
    { data: Array.from({ length: 6 }, () => post()) },
    { data: [], includes: { tweets: Array.from({ length: 16 }, () => ({})) } },
    { data: [], includes: { users: Array.from({ length: 6 }, () => ({})) } },
    { data: [post()], errors: [{ detail: bearerToken }] },
    { data: [post()], meta: { result_count: 0 } },
  ]) {
    const { calls, fetcher } = mockFetch([account, body]);
    await assert.rejects(
      readXReviewBatch(input, fetcher),
      /^Error: x_review_invalid_batch$/,
    );
    assert.equal(calls.length, 2);
  }
  const { fetcher } = mockFetch([account, { meta: { result_count: 0 } }]);
  assert.deepEqual(await readXReviewBatch(input, fetcher), {
    posts: [],
    moreAvailable: false,
    accountId: "123",
  });
});

test("X review times out at ten seconds, aborts the request, and does not retry", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const fetcher = (async (_url: unknown, init?: RequestInit) => {
    calls += 1;
    signal = init?.signal;
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  const request = readXReviewBatch(input, fetcher);
  const rejected = assert.rejects(request, /^Error: x_review_request_timeout$/);
  context.mock.timers.tick(9_999);
  assert.equal(signal?.aborted, false);
  context.mock.timers.tick(1);
  await rejected;
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
});
