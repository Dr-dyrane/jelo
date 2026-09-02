import { NextRequest, NextResponse } from "next/server";
import { hasPostgresConfig } from "@/lib/db/postgres";
import { communityIntakeAttributionFromReferrer } from "@/lib/community-intake/attribution";
import { MarketReportContextUnavailableError } from "@/lib/community-intake/market-report-context";
import {
  isMarketFinderReportIntakeEnabled,
  MarketFinderReportIntakeUnavailableError,
} from "@/lib/markets/activation";
import { createCommunityDraft } from "@/lib/community-intake/repository";
import {
  contributionDraftSchema,
  createDraftRequestSchema,
} from "@/lib/community-intake/schema";
import {
  allowCommunityAction,
  contributionCookieMaxAge,
  contributionCookieName,
  contributionCookieValue,
  createEditSecret,
  hashEditSecret,
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/security";

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request))
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );
  const rateLimit = await allowCommunityAction(request, "create");
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Too many contributions. Please try again later." },
      { status: 429 },
    );
    if (rateLimit.retryAfterSeconds != null)
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }
  if (!hasPostgresConfig())
    return NextResponse.json(
      { error: "Saving is temporarily unavailable." },
      { status: 503 },
    );

  try {
    const input = createDraftRequestSchema.parse(
      await readBoundedJson(request),
    );
    if (
      input.kind === "market_report" &&
      !isMarketFinderReportIntakeEnabled()
    ) {
      return NextResponse.json(
        { error: "This market report is not available." },
        { status: 404 },
      );
    }
    const secret = createEditSecret();
    const attribution = communityIntakeAttributionFromReferrer(
      request.headers.get("referer"),
    );
    const draft = await createCommunityDraft(
      input,
      hashEditSecret(secret),
      attribution,
    );
    const savedDraft = contributionDraftSchema.parse(draft.payload);
    const response = NextResponse.json(
      {
        draftId: draft.id,
        revision: draft.revision,
        expiresAt: draft.expires_at.toISOString(),
        ...(input.kind === "market_report" ? { draft: savedDraft } : {}),
      },
      { status: 201 },
    );
    response.cookies.set({
      name: contributionCookieName,
      value: contributionCookieValue(draft.id, secret),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/contribute",
      maxAge: contributionCookieMaxAge,
    });
    return response;
  } catch (error) {
    if (
      error instanceof MarketReportContextUnavailableError ||
      error instanceof MarketFinderReportIntakeUnavailableError
    )
      return NextResponse.json(
        { error: "This market report is not available." },
        { status: 422 },
      );
    const message =
      error instanceof Error && error.message === "payload_too_large"
        ? "Contribution is too large."
        : "Check the contribution and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
