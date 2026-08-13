import { after, NextResponse } from "next/server";
import { z } from "zod";
import { recordDailyDeskAggregateEvent } from "@/lib/campaigns/campaign-archive";
import { getDailyDeskReadModel } from "@/lib/campaigns/daily-desk";
import {
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/request-security";

const dailyDeskEventSchema = z
  .object({
    campaignId: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,180}$/),
    event: z.enum(["view", "compare_click"]),
  })
  .strict();

export async function POST(request: Request) {
  if (!sameSiteRequest(request)) {
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const input = dailyDeskEventSchema.parse(await readBoundedJson(request));
    const desk = await getDailyDeskReadModel();
    if (desk.status !== "ready" || desk.campaignId !== input.campaignId) {
      return NextResponse.json(
        { error: "Campaign not available." },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    after(() =>
      recordDailyDeskAggregateEvent({
        date: desk.date,
        campaignId: desk.campaignId,
        event: input.event,
      }),
    );
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
