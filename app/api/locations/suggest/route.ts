import { NextRequest, NextResponse } from "next/server";
import {
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/request-security";
import { suggestNigeriaLocations } from "@/lib/location/geoapify";
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
    const suggestions = await suggestNigeriaLocations(input);
    const response = NextResponse.json({ suggestions });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const unavailable =
      error instanceof Error &&
      error.message === "location_provider_unavailable";
    return NextResponse.json(
      {
        error: unavailable
          ? "Address suggestions are not configured. Enter the address manually."
          : "Address suggestions are unavailable. Enter the address manually.",
        suggestions: [],
      },
      { status: unavailable ? 503 : 400 },
    );
  }
}
