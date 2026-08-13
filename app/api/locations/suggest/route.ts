import { NextRequest, NextResponse } from "next/server";
import {
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/request-security";
import { suggestNigerianLocations } from "@/lib/location/provider";
import { smartLocationSuggestionRequestSchema } from "@/lib/location/schema";
import { allowLocationSuggestion } from "@/lib/location/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) {
    return NextResponse.json(
      { error: "Request not allowed.", suggestions: [] },
      { status: 403 },
    );
  }
  if (!(await allowLocationSuggestion(request))) {
    return NextResponse.json(
      {
        error: "Address help is busy. Enter the address manually.",
        suggestions: [],
      },
      { status: 429 },
    );
  }
  try {
    const input = smartLocationSuggestionRequestSchema.parse(
      await readBoundedJson(request),
    );
    const { suggestions, provider } = await suggestNigerianLocations(input);
    const response = NextResponse.json({ suggestions, provider });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Address suggestions are unavailable. Enter the address manually.",
        suggestions: [],
      },
      { status: 400 },
    );
  }
}
