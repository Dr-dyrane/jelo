"use client";

import { ArrowUpRight } from "lucide-react";

type DailyDeskEvent = "view" | "compare_click";

function recordEvent(campaignId: string, event: DailyDeskEvent) {
  void fetch("/api/campaigns/daily-desk/events", {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campaignId, event }),
  }).catch(() => undefined);
}

export function DailyDeskMeasurement({
  campaignId,
  actionUrl,
  actionLabel,
  className,
}: {
  campaignId: string;
  actionUrl: string;
  actionLabel: string;
  className: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        ref={(node) => {
          if (!node || node.dataset.measured === "true") return;
          node.dataset.measured = "true";
          recordEvent(campaignId, "view");
        }}
      />
      <a
        className={className}
        href={actionUrl}
        onClick={() => recordEvent(campaignId, "compare_click")}
      >
        {actionLabel}
        <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </>
  );
}
