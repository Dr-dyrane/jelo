import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitCommunityDraft } from "@/lib/community-intake/repository";
import {
  allowCommunityAction,
  editSecretFromRequest,
  hashEditSecret,
  sameSiteRequest,
} from "@/lib/community-intake/security";

const idSchema = z.uuid();

export async function POST(
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
  if (!z.uuid().safeParse(request.headers.get("idempotency-key")).success) {
    return NextResponse.json(
      { error: "Submission key missing." },
      { status: 400 },
    );
  }
  const rateLimit = await allowCommunityAction(request, "submit");
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Too many submissions. Please try again later." },
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
    const result = await submitCommunityDraft({
      id,
      editSecretHash: hashEditSecret(secret),
    });
    if (!result.ok)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    return NextResponse.json({
      contributionId: result.contributionId,
      status: "received",
      confidence: "community_reported",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "A few answers are still missing.",
          fields: error.issues.map((issue) => issue.path[0]),
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "Could not submit yet." },
      { status: 500 },
    );
  }
}
