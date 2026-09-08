import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";
import {
  prepareXReview,
  sendXReviewPreview,
} from "@/lib/campaigns/x-review/runner";

export const runtime = "nodejs";
export const maxDuration = 90;
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
function authorized(request: Request) {
  return isAuthorizedCronRequest(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
}
function error(status: number, code: string) {
  return Response.json({ code }, { status, headers });
}

/** Protected manual preview. No cron entry is installed for this first milestone. */
export async function GET(request: Request) {
  if (!authorized(request)) return error(401, "unauthorized");
  if (new URL(request.url).search) return error(400, "query-not-supported");
  try {
    return Response.json(await prepareXReview(), { headers });
  } catch {
    return error(503, "x-review-preview-failed");
  }
}

/** Send only the exact, fresh preview whose hash the operator approved. Never posts to X. */
export async function POST(request: Request) {
  if (!authorized(request)) return error(401, "unauthorized");
  try {
    const reader = request.body?.getReader();
    if (!reader) return error(400, "invalid-request");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return error(413, "request-too-large");
      }
      chunks.push(value);
    }
    let input: { reportId?: unknown; sha256?: unknown };
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return error(400, "invalid-request");
    }
    if (
      !input ||
      typeof input.reportId !== "string" ||
      !/^x-review-[0-9a-f-]{36}$/.test(input.reportId) ||
      typeof input.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(input.sha256)
    )
      return error(400, "invalid-request");
    return Response.json(
      await sendXReviewPreview({
        reportId: input.reportId,
        sha256: input.sha256,
      }),
      { headers },
    );
  } catch {
    return error(503, "x-review-send-failed-check-receipt-before-retrying");
  }
}
