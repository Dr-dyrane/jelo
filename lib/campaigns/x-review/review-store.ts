import "server-only";
import { Redis } from "@upstash/redis";
import { REVIEW_TTL_SECONDS, reportHash, type XReviewReport } from "./report";
import {
  editorialReviewSchema,
  EditorialReviewError,
  type EditorialReview,
} from "./editorial";

const prefix = "jelocare:x-review:pilot-v1";
export const CAS_X_EDITORIAL_REVIEW = `
local original = redis.call('GET', KEYS[1])
if not original or original ~= ARGV[4] then return 0 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
local expected = tonumber(ARGV[1])
if not expected or expected < 0 or expected ~= math.floor(expected) then return 0 end
local nextOk, next = pcall(cjson.decode, ARGV[2])
if not nextOk or type(next) ~= 'table' or next.version ~= expected + 1 then return 0 end
local previous = redis.call('GET', KEYS[2])
local version = 0
if previous then
  local previousOk, current = pcall(cjson.decode, previous)
  if not previousOk or type(current) ~= 'table' then return 0 end
  if current.reportId ~= next.reportId or current.reportHash ~= next.reportHash then return 0 end
  version = tonumber(current.version)
end
if version ~= expected then return 0 end
ttl = math.min(ttl, tonumber(ARGV[3]))
redis.call('SET', KEYS[2], ARGV[2], 'PX', ttl)
return 1
`;

let client: Redis | undefined;
function ledger() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url?.startsWith("https://") || !token || token === "[SENSITIVE]")
    throw new EditorialReviewError("x-review-editorial-store-unavailable");
  return (client = new Redis({ url, token }));
}
function id(value: string) {
  if (!/^x-review-[0-9a-f-]{36}$/.test(value))
    throw new EditorialReviewError("x-review-editorial-invalid-input");
  return value;
}
export const xEditorialStore = {
  async load(reportId: string): Promise<EditorialReview | null> {
    const key = `${prefix}:editorial:${id(reportId)}`;
    try {
      const value = await ledger().get<unknown>(key);
      if (value === null) return null;
      const parsed = editorialReviewSchema.safeParse(value);
      if (!parsed.success || parsed.data.reportId !== reportId)
        throw new EditorialReviewError("x-review-editorial-invalid-state");
      return parsed.data;
    } catch (error) {
      if (error instanceof EditorialReviewError) throw error;
      throw new EditorialReviewError("x-review-editorial-store-unavailable");
    }
  },
  async compareAndSet(
    report: XReviewReport,
    expectedVersion: number,
    next: EditorialReview,
  ): Promise<boolean> {
    const reportId = id(report.id);
    if (
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0 ||
      !editorialReviewSchema.safeParse(next).success ||
      next.version !== expectedVersion + 1 ||
      next.reportId !== reportId ||
      next.reportHash !== reportHash(report)
    ) {
      throw new EditorialReviewError("x-review-editorial-invalid-state");
    }
    try {
      return (
        (await ledger().eval<[number, string, number, string], number>(
          CAS_X_EDITORIAL_REVIEW,
          [`${prefix}:report:${reportId}`, `${prefix}:editorial:${reportId}`],
          [
            expectedVersion,
            JSON.stringify(next),
            REVIEW_TTL_SECONDS * 1000,
            JSON.stringify(report),
          ],
        )) === 1
      );
    } catch {
      throw new EditorialReviewError("x-review-editorial-store-unavailable");
    }
  },
};
