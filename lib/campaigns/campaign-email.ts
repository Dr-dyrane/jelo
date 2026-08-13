import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";
import type { ArchivedCampaign } from "@/lib/campaigns/campaign-archive";
import type { CampaignRecipient } from "@/lib/campaigns/campaign-recipient";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const checkedAt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function dailyCampaignEmail(input: {
  mode: "test" | "production";
  draft: DailyCampaignDraft;
  archive: ArchivedCampaign;
  recipient: CampaignRecipient;
}) {
  const prefix = input.mode === "test" ? "[TEST] " : "";
  const subject = `${prefix}Today’s JeloCare campaign · ${input.draft.product.brand} ${input.draft.product.name}`;
  const greeting = input.recipient.displayName
    ? `Hi ${input.recipient.displayName}.`
    : "Today’s campaign is ready.";
  const observation = checkedAt.format(new Date(input.draft.dataCheckedAt));
  const text = [
    greeting,
    "",
    input.draft.copy.headline,
    input.draft.copy.productLine,
    input.draft.copy.priceLine,
    "",
    `Caption: ${input.draft.copy.caption}`,
    "",
    `Open comparison: ${input.draft.actionUrl}`,
    `Download story: ${input.archive.image.downloadUrl}`,
    "",
    `Evidence checked ${observation}.`,
    "Draft only. Nothing has been posted or published.",
  ].join("\n");
  const safe = {
    greeting: escapeHtml(greeting),
    headline: escapeHtml(input.draft.copy.headline),
    productLine: escapeHtml(input.draft.copy.productLine),
    priceLine: escapeHtml(input.draft.copy.priceLine),
    caption: escapeHtml(input.draft.copy.caption),
    observation: escapeHtml(observation),
    actionUrl: escapeHtml(input.draft.actionUrl),
    imageUrl: escapeHtml(input.archive.image.url),
    downloadUrl: escapeHtml(input.archive.image.downloadUrl),
  };

  return {
    subject,
    text,
    html: `
      <div style="margin:0;background:#f3eee8;padding:36px 16px;color:#211d1a;font-family:Arial,sans-serif">
        <div style="max-width:620px;margin:0 auto">
          <p style="margin:0 0 24px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#6b3b35">JeloCare / Daily campaign</p>
          <h1 style="margin:0 0 12px;font-size:40px;line-height:1.05;font-weight:400;letter-spacing:-.03em">${safe.headline}</h1>
          <p style="margin:0 0 28px;color:#6f625e;line-height:1.55">${safe.greeting}</p>
          <a href="${safe.downloadUrl}" style="display:block;text-decoration:none">
            <img src="${safe.imageUrl}" width="620" alt="${safe.productLine}" style="display:block;width:100%;height:auto;border:0;border-radius:26px;background:#080706" />
          </a>
          <div style="padding:30px 4px 4px">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b3b35">${safe.productLine}</p>
            <p style="margin:0 0 24px;font-size:25px;line-height:1.25;color:#211d1a">${safe.priceLine}</p>
            <p style="margin:0 0 24px;color:#514945;line-height:1.65">${safe.caption}</p>
            <a href="${safe.actionUrl}" style="display:inline-block;border-radius:999px;background:#211d1a;padding:14px 20px;color:#fff;text-decoration:none">Open comparison</a>
            <a href="${safe.downloadUrl}" style="display:inline-block;margin-left:8px;border-radius:999px;background:#e7ddd6;padding:14px 20px;color:#211d1a;text-decoration:none">Download story</a>
            <p style="margin:30px 0 0;color:#8a7d78;font-size:12px;line-height:1.6">Evidence checked ${safe.observation}. Draft only. Nothing has been posted or published.</p>
          </div>
        </div>
      </div>
    `,
  };
}
