import type { ArchivedCampaign } from "@/lib/campaigns/campaign-archive";
import type { CampaignRecipient } from "@/lib/campaigns/campaign-recipient";
import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";

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

const packetDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const packetRoles = ["proof", "use", "remember"] as const;
type PacketRole = (typeof packetRoles)[number];

const roleCopy: Record<
  PacketRole,
  { number: string; label: string; headline: string; context: string }
> = {
  proof: {
    number: "01",
    label: "Proof",
    headline: "The current price context.",
    context: "Exact product, current comparison and checked evidence.",
  },
  use: {
    number: "02",
    label: "Use",
    headline: "See it in JeloCare.",
    context: "The exact current comparison shown through JeloCare’s interface.",
  },
  remember: {
    number: "03",
    label: "Remember",
    headline: "Keep the price context close.",
    context: "A memorable expression of the same checked evidence.",
  },
};

function verifiedActionUrl(draft: DailyCampaignDraft) {
  const expected = `https://www.jelocare.com/share/${encodeURIComponent(draft.product.slug)}`;
  let parsed: URL;
  try {
    parsed = new URL(draft.actionUrl);
  } catch {
    throw new Error("campaign_email_action_url_invalid");
  }
  if (
    draft.actionUrl !== expected ||
    parsed.protocol !== "https:" ||
    parsed.hostname !== "www.jelocare.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("campaign_email_action_url_invalid");
  }
  return draft.actionUrl;
}

function verifiedArchiveUrl(value: string, kind: "image" | "download") {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`campaign_email_${kind}_url_invalid`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    (kind === "image" && parsed.search) ||
    (kind === "download" &&
      [...parsed.searchParams.keys()].some((key) => key !== "download"))
  ) {
    throw new Error(`campaign_email_${kind}_url_invalid`);
  }
  return value;
}

function verifiedPacketImages(archive: ArchivedCampaign) {
  if (
    archive.packetImages.length !== packetRoles.length ||
    archive.packetImages.some(
      (image, index) => image.role !== packetRoles[index],
    )
  ) {
    throw new Error("campaign_email_packet_roles_invalid");
  }

  const proof = archive.packetImages[0];
  if (
    archive.image.url !== proof.url ||
    archive.image.downloadUrl !== proof.downloadUrl ||
    archive.image.sha256 !== proof.sha256 ||
    archive.image.width !== proof.width ||
    archive.image.height !== proof.height
  ) {
    throw new Error("campaign_email_proof_alias_mismatch");
  }

  return archive.packetImages.map((image) => {
    if (
      image.width !== 1080 ||
      image.height !== 1920 ||
      !/^[0-9a-f]{64}$/.test(image.sha256)
    ) {
      throw new Error("campaign_email_packet_image_invalid");
    }
    return {
      ...image,
      url: verifiedArchiveUrl(image.url, "image"),
      downloadUrl: verifiedArchiveUrl(image.downloadUrl, "download"),
    };
  });
}

export function dailyCampaignEmail(input: {
  mode: "test" | "production";
  draft: DailyCampaignDraft;
  archive: ArchivedCampaign;
  recipient: CampaignRecipient;
}) {
  const prefix = input.mode === "test" ? "[TEST] " : "";
  const subject = `${prefix}Today’s JeloCare packet · Proof, Use, Remember`;
  const greeting = input.recipient.displayName
    ? `Hi ${input.recipient.displayName}.`
    : "Today’s campaign packet is ready.";
  const observed = checkedAt.format(new Date(input.draft.dataCheckedAt));
  const date = packetDate.format(new Date(input.draft.dataCheckedAt));
  const actionUrl = verifiedActionUrl(input.draft);
  const images = verifiedPacketImages(input.archive);

  const text = [
    greeting,
    "",
    "Today’s three",
    date,
    "Three JeloCare drafts are ready to review. Nothing has been published.",
    "",
    ...images.flatMap((image, index) => {
      const role = roleCopy[image.role];
      const headline =
        image.role === "proof" ? input.draft.copy.headline : role.headline;
      return [
        `${role.number} ${role.label}`,
        headline,
        role.context,
        input.draft.copy.productLine,
        input.draft.copy.priceLine,
        `Caption: ${input.draft.copy.caption}`,
        `Evidence checked ${observed}.`,
        `Download story: ${image.downloadUrl}`,
        `Open JeloCare: ${actionUrl}`,
        ...(index < images.length - 1 ? [""] : []),
      ];
    }),
    "",
    "Draft packet · Review before posting.",
  ].join("\n");

  const safe = {
    greeting: escapeHtml(greeting),
    date: escapeHtml(date),
    productLine: escapeHtml(input.draft.copy.productLine),
    priceLine: escapeHtml(input.draft.copy.priceLine),
    caption: escapeHtml(input.draft.copy.caption),
    observed: escapeHtml(observed),
    actionUrl: escapeHtml(actionUrl),
  };

  const sections = images
    .map((image) => {
      const role = roleCopy[image.role];
      const headline =
        image.role === "proof" ? input.draft.copy.headline : role.headline;
      const safeImage = escapeHtml(image.url);
      const safeDownload = escapeHtml(image.downloadUrl);
      const safeAlt = escapeHtml(
        `JeloCare ${role.label} campaign: ${input.draft.copy.productLine}`,
      );
      return `
        <tr>
          <td class="packet-section" style="padding:0 30px 42px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffdf9" class="section-card" style="width:100%;background-color:#fffdf9;border-radius:24px;border-collapse:separate">
              <tr>
                <td class="section-copy" style="padding:28px 28px 22px">
                  <p class="section-eyebrow" style="margin:0 0 10px;color:#6b3b35;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase">${role.number} / ${role.label}</p>
                  <h2 class="section-title" style="margin:0 0 10px;color:#2d211f;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.08;font-weight:400">${escapeHtml(headline)}</h2>
                  <p class="section-context" style="margin:0 0 8px;color:#7a6b66;font-size:15px;line-height:1.55">${escapeHtml(role.context)}</p>
                  <p class="product-line" style="margin:0;color:#2d211f;font-size:13px;font-weight:600;line-height:1.5">${safe.productLine}</p>
                  <p class="price-line" style="margin:4px 0 0;color:#2d211f;font-size:20px;line-height:1.35">${safe.priceLine}</p>
                </td>
              </tr>
              <tr>
                <td align="center" class="image-cell" style="padding:0 28px">
                  <a href="${safeDownload}" style="display:block;color:#2d211f;text-decoration:none">
                    <img src="${safeImage}" width="504" height="896" alt="${safeAlt}" style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:20px;background-color:#080305;object-fit:contain" />
                  </a>
                </td>
              </tr>
              <tr>
                <td class="section-copy" style="padding:24px 28px 30px">
                  <p class="caption" style="margin:0 0 20px;color:#514945;font-size:15px;line-height:1.65">${safe.caption}</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="action-table" style="border-collapse:separate">
                    <tr>
                      <td class="action-cell" bgcolor="#2d211f" style="border-radius:999px;background-color:#2d211f">
                        <a href="${safeDownload}" class="primary-action" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">Download story</a>
                      </td>
                      <td class="action-gap" width="8" style="width:8px">&nbsp;</td>
                      <td class="action-cell secondary-cell" bgcolor="#f4d4c5" style="border-radius:999px;background-color:#f4d4c5">
                        <a href="${safe.actionUrl}" class="secondary-action" style="display:inline-block;padding:13px 18px;color:#2d211f;font-size:14px;font-weight:600;text-decoration:none">Open JeloCare</a>
                      </td>
                    </tr>
                  </table>
                  <p class="evidence-note" style="margin:22px 0 0;color:#7a6b66;font-size:12px;line-height:1.55">Evidence checked ${safe.observed}. Draft creative for internal review.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return {
    subject,
    text,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(subject)}</title>
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      @media only screen and (max-width: 480px) {
        .email-shell { padding: 16px 8px !important; }
        .email-card { width: 100% !important; }
        .header-cell { padding: 28px 20px 26px !important; }
        .email-title { font-size: 36px !important; }
        .packet-section { padding: 0 12px 24px !important; }
        .section-copy { padding-left: 18px !important; padding-right: 18px !important; }
        .image-cell { padding-left: 18px !important; padding-right: 18px !important; }
        .section-title { font-size: 26px !important; }
        .action-table, .action-table tbody, .action-table tr { display: block !important; width: 100% !important; }
        .action-cell { display: block !important; width: 100% !important; text-align: center !important; }
        .action-gap { display: block !important; width: 100% !important; height: 8px !important; font-size: 0 !important; line-height: 0 !important; }
        .primary-action, .secondary-action { display: block !important; }
        .footer-cell { padding: 8px 20px 30px !important; }
      }
      @media (prefers-color-scheme: dark) {
        body, .email-shell { background-color: #000000 !important; color: #fff7f4 !important; }
        .email-card { background-color: #0d090b !important; }
        .brand-pill, .secondary-cell { background-color: #ff9aa5 !important; }
        .email-title, .section-title, .product-line, .price-line { color: #fff7f4 !important; }
        .email-lead, .email-date, .section-context, .caption, .evidence-note, .footer-note { color: #c6b0ad !important; }
        .email-eyebrow, .section-eyebrow { color: #ff9aa5 !important; }
        .section-card { background-color: #171214 !important; }
        .primary-action, .secondary-action { color: #21070d !important; }
        .action-cell { background-color: #ff9aa5 !important; }
        .draft-panel { background-color: #21171b !important; color: #fff7f4 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#fbf3ed;color:#2d211f">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Three JeloCare drafts are ready to review. Nothing has been published.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbf3ed" class="email-shell" style="width:100%;margin:0;background-color:#fbf3ed;padding:30px 12px;color:#2d211f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8ece7" class="email-card" style="width:100%;max-width:620px;margin:0 auto;background-color:#f8ece7;border-radius:30px;border-collapse:separate">
            <tr>
              <td class="header-cell" style="padding:38px 30px 34px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate">
                  <tr>
                    <td bgcolor="#f4d4c5" class="brand-pill" style="border-radius:999px;background-color:#f4d4c5;padding:10px 17px;color:#2d211f;font-size:14px;font-weight:700">JeloCare</td>
                  </tr>
                </table>
                <p class="email-eyebrow" style="margin:26px 0 9px;color:#6b3b35;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase">Daily campaign packet</p>
                <h1 class="email-title" style="margin:0 0 12px;color:#2d211f;font-family:Georgia,'Times New Roman',serif;font-size:44px;line-height:1.02;font-weight:400">Today’s three.</h1>
                <p class="email-date" style="margin:0 0 18px;color:#7a6b66;font-size:13px;line-height:1.5">${safe.date}</p>
                <p class="email-lead" style="margin:0;color:#6f625e;font-size:16px;line-height:1.6">${safe.greeting} Three campaign expressions are ready for review.</p>
              </td>
            </tr>
            ${sections}
            <tr>
              <td class="footer-cell" style="padding:0 30px 36px">
                <div class="draft-panel" style="border-radius:20px;background-color:#2d211f;padding:20px 22px;color:#ffffff">
                  <p style="margin:0;font-size:14px;font-weight:600;line-height:1.5">Draft packet · Review before posting.</p>
                  <p class="footer-note" style="margin:5px 0 0;color:#d7c9c4;font-size:12px;line-height:1.55">Nothing in this email has been posted or published.</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
