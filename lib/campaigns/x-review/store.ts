import "server-only";
import { Redis } from "@upstash/redis";
import {
  PILOT_RUN_LIMIT,
  REVIEW_TTL_SECONDS,
  type XReviewReport,
} from "./report";

const prefix = "jelocare:x-review:pilot-v1";
export const RESERVE_X_REVIEW_RUN = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local used = tonumber(redis.call('GET', KEYS[2]) or '0')
if used >= tonumber(ARGV[1]) then return -1 end
redis.call('SET', KEYS[1], 'reserved')
redis.call('INCR', KEYS[2])
return 1
`;
export const RESERVE_X_REVIEW_DELIVERY = `
for _, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then return 0 end
end
redis.call('SET', KEYS[1], 'sending')
for i = 2, #KEYS do redis.call('SET', KEYS[i], 'reserved', 'EX', 604800) end
return 1
`;
let client: Redis | undefined;
function ledger() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url?.startsWith("https://") || !token || token === "[SENSITIVE]")
    throw new Error("x-review-store-unavailable");
  return (client = new Redis({ url, token }));
}
function id(value: string) {
  if (!/^x-review-[0-9a-f-]{36}$/.test(value))
    throw new Error("x-review-id-invalid");
  return value;
}
export const xReviewStore = {
  // Fixed lifetime allowance, shared by previews and future scheduled runs.
  // No expiration/refund: failed calls count; redeploys cannot refill the pilot.
  async reserveRun(now: Date) {
    const slot = Math.floor(now.valueOf() / (12 * 3_600_000));
    const result = await ledger().eval<[number], number>(
      RESERVE_X_REVIEW_RUN,
      [`${prefix}:slot:${slot}`, `${prefix}:attempts`],
      [PILOT_RUN_LIMIT],
    );
    return result === 1;
  },
  async wasReported(postId: string) {
    return Boolean(await ledger().exists(`${prefix}:reported:${postId}`));
  },
  async save(report: XReviewReport) {
    if (
      (await ledger().set(
        `${prefix}:report:${id(report.id)}`,
        JSON.stringify(report),
        { nx: true, ex: REVIEW_TTL_SECONDS },
      )) !== "OK"
    )
      throw new Error("x-review-archive-conflict");
  },
  async load(reportId: string): Promise<XReviewReport | null> {
    return ledger().get(`${prefix}:report:${id(reportId)}`);
  },
  async reserveDelivery(report: XReviewReport) {
    // Retained independently of the short-lived report; ambiguous sends cannot be retried.
    return (
      (await ledger().eval<[], number>(
        RESERVE_X_REVIEW_DELIVERY,
        [
          `${prefix}:delivery:${id(report.id)}:${report.recipientKey}`,
          ...report.items.map((item) => `${prefix}:reported:${item.source.id}`),
        ],
        [],
      )) === 1
    );
  },
  async deliveryOutcome(report: XReviewReport, state: "accepted" | "failed") {
    await ledger().set(
      `${prefix}:outcome:${id(report.id)}:${report.recipientKey}`,
      state,
      { nx: true },
    );
  },
};
