import { createHash } from "node:crypto";
import type { XReviewPost } from "./client";
import { campaignReviewPath } from "@/lib/auth/sign-in-intent";

export const PILOT_RUN_LIMIT = 6;
export const PILOT_RUN_RESERVATION_CENTS = 25;
export const REVIEW_TTL_SECONDS = 86_400;

export type XReviewItem = {
  source: XReviewPost;
  classification:
    | "answer promptly"
    | "light banter"
    | "care/safety response"
    | "buying intent"
    | "manual review";
  reason: string;
  draft: string | null;
};
export type XReviewReport = {
  id: string;
  checkedAt: string;
  recipientKey: string;
  items: XReviewItem[];
  moreAvailable: boolean;
  aiStatus: "disabled" | "not-needed" | "completed" | "failed";
  aiCostUsd: number | null;
};

export function xReviewConfig(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
) {
  if (env.JELOCARE_X_REVIEW_ENABLED !== "true") return null;
  const token = env.JELOCARE_X_BEARER_TOKEN?.trim();
  const recipient = env.JELOCARE_X_REPORT_EMAIL?.trim().toLowerCase();
  const deadline = Date.parse(env.JELOCARE_X_PILOT_ENDS_AT ?? "");
  if (!Number.isFinite(deadline) || deadline <= now.valueOf()) {
    throw new Error("x-review-pilot-expired");
  }
  if (deadline - now.valueOf() > 7 * 86_400_000) {
    throw new Error("x-review-pilot-window-invalid");
  }
  if (
    !token ||
    token === "[SENSITIVE]" ||
    !recipient ||
    recipient.length > 254 ||
    !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)
  ) {
    throw new Error("x-review-config-missing");
  }
  return {
    token,
    recipient,
    aiEnabled: env.JELOCARE_X_AI_ENABLED === "true",
    emailEnabled: env.JELOCARE_X_EMAIL_ENABLED === "true",
  };
}

const care =
  /\b(burn\w*|swell\w*|rash\w*|itch\w*|pain\w*|bleed\w*|breakout\w*|allerg\w*|acne|eczema|pregnan\w*|diagnos\w*|treat\w*|steroid\w*|infection\w*|severe|suicid\w*|self.harm)\b/i;
const privateData =
  /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{7,}\d|\b(?:password|otp|passcode|account number|my address|bank details)\b)/i;
const injection =
  /\b(ignore.{0,30}instructions|system prompt|developer message|api key|access token|run this|execute|send.{0,20}credentials)\b/i;
const optOut =
  /\b(stop (?:replying|messaging|contacting)|do not (?:reply|contact)|don't (?:reply|contact)|unsubscribe|opt[ -]?out)\b/i;

/** Rule-based caution is not a diagnosis or a complete safety classifier. */
export function reviewItem(post: XReviewPost): XReviewItem | null {
  if (
    post.username?.toLowerCase() === "jelocare" ||
    optOut.test(post.text) ||
    !/[\p{L}\p{N}]/u.test(post.text.replace(/@jelocare/gi, ""))
  )
    return null;
  const words = `${post.text}\n${post.parent?.text ?? ""}`;
  const withheld =
    privateData.test(words) || care.test(words) || post.sensitive;
  const source = withheld
    ? {
        ...post,
        text: "Text withheld from email and AI; review the public source privately.",
        parent: post.parent
          ? { ...post.parent, text: "Context withheld; open the source." }
          : null,
      }
    : post;
  if (care.test(words))
    return {
      source,
      classification: "care/safety response",
      reason:
        "Care concern: human review required. No AI draft or clinical inference.",
      draft: null,
    };
  if (withheld)
    return {
      source,
      classification: "manual review",
      reason:
        "Sensitive content or possible private information: do not copy into a public reply.",
      draft: null,
    };
  if (injection.test(words))
    return {
      source,
      classification: "manual review",
      reason: "Possible instruction injection; no draft generated.",
      draft: null,
    };
  if (!post.parent || post.hasMedia || words.length > 1500)
    return {
      source,
      classification: "manual review",
      reason:
        "Full context or media needs a person to review it. This pilot does not watch video.",
      draft: null,
    };
  const buying =
    /\b(buy|order|stock|price|cost|deliver\w*|where can|how much)\b/i.test(
      post.text,
    );
  return {
    source,
    classification: buying ? "buying intent" : "answer promptly",
    reason:
      "Unapproved draft. Check the live thread for existing replies before posting.",
    draft: null,
  };
}

export function canDraft(item: XReviewItem) {
  return (
    item.classification === "answer promptly" ||
    item.classification === "buying intent"
  );
}

export function safeDraft(text: string) {
  const normalized = text.trim();
  // Claim/link-free first pilot. The editor can add independently verified facts later.
  return (
    normalized.length > 0 &&
    [...normalized].length <= 240 &&
    !care.test(normalized) &&
    !privateData.test(normalized) &&
    !injection.test(normalized) &&
    !/(https?:|www\.|@|[₦$£€]|\b\d|\b(?:cure|guarantee\w*|authentic|best|cheapest|in stock|safe for|SPF)\b)/i.test(
      normalized,
    )
  );
}

function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function sourceUrl(id: string) {
  return `https://x.com/i/status/${id}`;
}

export function renderXReviewEmail(report: XReviewReport) {
  const subject = `JeloCare X review · ${report.items.length} item${report.items.length === 1 ? "" : "s"}`;
  const notice =
    "Private review only. Nothing has been posted. Open the review desk to edit or approve the exact copy. Approval does not publish. Replying to this email does not run commands.";
  const path = campaignReviewPath(report.id);
  if (!path) throw new Error("x-review-id-invalid");
  const reviewUrl = `https://www.jelocare.com${path}`;
  const coverage = `Checked ${report.checkedAt}. Up to five mentions from the last 48 hours; this is not a complete inbox audit.${report.moreAvailable ? " More items or incomplete source data remain: review X directly." : ""}`;
  const sections = report.items.map((item, index) => {
    const p = item.source;
    const stats = `${p.metrics.replies} replies · ${p.metrics.reposts} reposts · ${p.metrics.likes} likes · ${p.metrics.views ?? "unavailable"} views`;
    const label = `${index + 1}. ${item.classification}`;
    const source = `${p.username ? `@${p.username}` : "Author handle unavailable"} · ${p.createdAt}`;
    const context = p.parent
      ? `Answers ${sourceUrl(p.parent.id)}\n${p.parent.text}`
      : "Parent context unavailable.";
    const draft = item.draft ?? "No draft — manual review required.";
    return {
      text: `${label}\n${source}\n${sourceUrl(p.id)}\n${p.text}\n${stats}\n\n${context}\n\n${item.reason}\nProposed reply: ${draft}`,
      html: `<section style="padding:24px 0;border-top:1px solid #eadbd4"><p style="color:#6b3b35;font-size:13px;font-weight:600">${escape(label)}</p><p>${escape(source)}</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(p.text)}</p><p style="font-size:12px;color:#6f625e">${escape(stats)}</p><a href="${sourceUrl(p.id)}" style="color:#6b3b35">Open source on X ↗</a>${p.parent ? `<p style="font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere">Answers <a href="${sourceUrl(p.parent.id)}" style="color:#6b3b35">the parent post</a><br>${escape(p.parent.text)}</p>` : "<p>Parent context unavailable.</p>"}<p style="font-size:13px;color:#6f625e">${escape(item.reason)}</p><div style="padding:18px;background:#f6ece7;border-radius:14px"><span style="font-size:12px;color:#6b3b35">PROPOSED REPLY · NOT POSTED</span><p style="margin-bottom:0;white-space:pre-wrap;overflow-wrap:anywhere">${escape(draft)}</p></div></section>`,
    };
  });
  const ai = `AI drafting: ${report.aiStatus}. Source media has not been downloaded or cleared for Zapshots.`;
  return {
    subject,
    text: [
      subject,
      notice,
      `Open private review (campaign email sign-in required): ${reviewUrl}`,
      coverage,
      ...sections.map((s) => s.text),
      ai,
    ].join("\n\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#fff9f5;color:#201b19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6"><table role="presentation" style="width:100%;max-width:620px;margin:0 auto"><tr><td style="padding:28px 20px"><p style="letter-spacing:.12em;color:#6b3b35;font-size:13px">JELOCARE · X REVIEW</p><h1 style="font:36px Georgia,serif;margin:16px 0">A few conversations.</h1><p>${escape(notice)}</p><p><a href="${reviewUrl}" style="display:inline-block;padding:12px 20px;border-radius:24px;background:#6b3b35;color:#fff9f5;text-decoration:none">Open private review</a></p><p style="font-size:12px;color:#6f625e">Sign in with the campaign email. Review decisions are available for one hour.</p><p style="font-size:13px;color:#6f625e">${escape(coverage)}</p>${sections.map((s) => s.html).join("")}<p style="font-size:12px;color:#6f625e">${escape(ai)}</p></td></tr></table></body></html>`,
  };
}

export function reportHash(report: XReviewReport) {
  return createHash("sha256")
    .update(JSON.stringify({ report, email: renderXReviewEmail(report) }))
    .digest("hex");
}
