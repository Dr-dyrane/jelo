import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveCommunityDraft } from "@/lib/community-intake/repository";
import { saveDraftRequestSchema } from "@/lib/community-intake/schema";
import { MarketFinderReportIntakeUnavailableError } from "@/lib/markets/activation";
import {
  allowCommunityAction,
  editSecretFromRequest,
  hashEditSecret,
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/security";

const idSchema = z.uuid();

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success)
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  if (!sameSiteRequest(request))
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );
  const rateLimit = await allowCommunityAction(request, "save", id);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Saving too quickly. Please wait a moment." },
      { status: 429 },
    );
    if (rateLimit.retryAfterSeconds != null)
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }
  const secret = editSecretFromRequest(request, id);
  if (!secret)
    return NextResponse.json(
      { error: "Draft access expired." },
      { status: 401 },
    );

  try {
    const input = saveDraftRequestSchema.parse(await readBoundedJson(request));
    const result = await saveCommunityDraft({
      id,
      editSecretHash: hashEditSecret(secret),
      revision: input.revision,
      draft: input.draft,
      events: input.events,
    });
    if (!result.ok && result.reason === "revision") {
      return NextResponse.json(
        { error: "Draft changed.", revision: result.revision },
        { status: 409 },
      );
    }
    if (!result.ok && result.reason === "locked") {
      return NextResponse.json(
        { error: "Market report context cannot be changed." },
        { status: 409 },
      );
    }
    if (!result.ok)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    return NextResponse.json({
      revision: result.revision,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof MarketFinderReportIntakeUnavailableError) {
      return NextResponse.json(
        { error: "This market report is not available." },
        { status: 404 },
      );
    }
    const message =
      error instanceof Error && error.message === "payload_too_large"
        ? "Contribution is too large."
        : "Check the contribution and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
