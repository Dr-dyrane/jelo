import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const backgroundName = "source/immersive-master-field-imagegen.png";
const backgroundPath = path.join(directory, backgroundName);
const finalName = "01-order-fee-transparency-whatsapp-status.png";
const finalPath = path.join(directory, finalName);

const campaignId = "2026-08-21-order-fee-transparency-v1";
const createdAt = "2026-08-21T15:01:19Z";
const dataCheckedAt = createdAt;
const repositoryCommit = "972dd4a9a7da15f5269a7d36a8f53707d6f61dd3";

const generationPrompt = `Use case: ads-marketing
Asset type: text-free master background for a JeloCare WhatsApp Status campaign, vertical 9:16
Primary request: create a quiet, premium, immersive abstract studio field that suggests clarity and transparency through light passing across layered clear glass edges
Scene/backdrop: deep near-black and graphite seamless field with a restrained wine-red glow in the lower middle and very subtle warm peach refractions
Subject: a few large, elegant, translucent glass planes and soft curved light bands, fully abstract; they should frame rather than occupy the center
Style/medium: photorealistic premium materials study, Apple-grade restraint, sophisticated editorial product lighting, not a literal product scene
Composition/framing: vertical story composition; generous uninterrupted negative space across the upper 40%; calm central safe region for later deterministic copy and UI composition; subtle material interest behind the lower middle; no focal object
Lighting/mood: controlled soft studio edge light, rich blacks, subtle warm glow, calm and trustworthy
Color palette: near-black, graphite, muted oxblood/wine, restrained blush-peach highlights, tiny warm-white reflections
Materials/textures: smoked glass, clear glass edge refraction, matte seamless backdrop, faint atmospheric bloom
Text: none
Constraints: absolutely no text, letters, words, numbers, symbols, logos, brand marks, currency, receipt, price tag, QR code, product packaging, cosmetic products, people, hands, phones, screens, interface elements, buttons, cards, watermarks, or platform chrome; keep all important texture away from the outer 120px-equivalent side margins and leave the top and bottom safe areas visually calm
Avoid: neon cyberpunk, sci-fi, busy decoration, literal ecommerce imagery, multiple objects, hard lens flares, fake UI, visible typography`;

const copy = {
  eyebrow: "ORDERING IS NOW AVAILABLE",
  headline: ["Order with every", "cost in view."],
  body: [
    "Your verified quote separates each cost",
    "before you approve or pay.",
  ],
  quoteEyebrow: "VERIFIED QUOTE",
  quoteState: "QUOTE READY",
  quoteTitle: "Cost breakdown",
  quoteLines: [
    "Products",
    "Retailer fee",
    "JeloCare fee",
    "Delivery",
  ],
  quoteTotal: "Quote total",
  quoteNote: "Exact amounts appear as separate lines in your quote.",
  sequence: ["REQUEST", "QUOTE", "APPROVE", "PAYMENT", "DELIVERY"],
  action: "Start with an exact product",
  actionHint: "Use the JeloCare link",
  embeddedUrl: null,
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function overlay() {
  const quoteRows = copy.quoteLines
    .map((label, index) => {
      const y = 950 + index * 80;
      return `
        <g>
          <circle cx="174" cy="${y - 7}" r="10" fill="#f3a4ae" fill-opacity=".18" stroke="#f3a4ae" stroke-opacity=".72"/>
          <path d="M169 ${y - 7}l4 4 7-9" fill="none" stroke="#f3a4ae" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="204" y="${y}" font-size="30" fill="#fff9f5" fill-opacity=".86">${escapeXml(label)}</text>
          <path d="M730 ${y - 7}h140" stroke="#fff9f5" stroke-opacity=".24" stroke-width="4" stroke-linecap="round"/>
        </g>`;
    })
    .join("");

  const progress = copy.sequence
    .map((label, index) => {
      const x = 120 + index * 191;
      const connector = index < copy.sequence.length - 1
        ? `<path d="M${x + 28} 1482h135" stroke="#fff9f5" stroke-opacity=".18"/>`
        : "";
      return `${connector}
        <circle cx="${x + 8}" cy="1482" r="7" fill="${index < 2 ? "#f3a4ae" : "#fff9f5"}" fill-opacity="${index < 2 ? ".9" : ".28"}"/>
        <text x="${x}" y="1518" font-size="18" font-weight="700" letter-spacing="1.1" fill="#fff9f5" fill-opacity="${index < 2 ? ".82" : ".54"}">${label}</text>`;
    })
    .join("");

  return Buffer.from(`<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#030203" stop-opacity=".82"/>
        <stop offset=".35" stop-color="#080406" stop-opacity=".55"/>
        <stop offset=".72" stop-color="#090406" stop-opacity=".28"/>
        <stop offset="1" stop-color="#050304" stop-opacity=".86"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#24181c" stop-opacity=".91"/>
        <stop offset="1" stop-color="#120d0f" stop-opacity=".84"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#000" flood-opacity=".44"/>
      </filter>
    </defs>

    <rect width="1080" height="1920" fill="url(#shade)"/>

    <g font-family="Arial, sans-serif">
      <text x="120" y="255" font-size="36" fill="#fff9f5" letter-spacing="-.8"><tspan font-weight="700">Jelo</tspan><tspan font-weight="300">Care</tspan></text>
      <text x="960" y="252" text-anchor="end" font-size="18" fill="#fff9f5" fill-opacity=".50" letter-spacing="2.4">01 / 01</text>

      <text x="120" y="336" font-size="18" font-weight="700" fill="#f3a4ae" letter-spacing="3">${copy.eyebrow}</text>
      <text x="120" y="438" font-family="Georgia, serif" font-size="72" fill="#fff9f5" letter-spacing="-2.7">${copy.headline[0]}</text>
      <text x="120" y="516" font-family="Georgia, serif" font-size="72" fill="#fff9f5" letter-spacing="-2.7">${copy.headline[1]}</text>
      <text x="120" y="584" font-size="32" fill="#fff9f5" fill-opacity=".76">${copy.body[0]}</text>
      <text x="120" y="630" font-size="32" fill="#fff9f5" fill-opacity=".76">${copy.body[1]}</text>

      <g filter="url(#shadow)">
        <rect x="120" y="705" width="840" height="680" rx="42" fill="url(#card)" stroke="#fff9f5" stroke-opacity=".16"/>
      </g>
      <text x="168" y="773" font-size="18" font-weight="700" fill="#f3a4ae" letter-spacing="2.5">${copy.quoteEyebrow}</text>
      <text x="912" y="773" text-anchor="end" font-size="17" font-weight="700" fill="#fff9f5" fill-opacity=".56" letter-spacing="1.8">${copy.quoteState}</text>
      <text x="168" y="849" font-family="Georgia, serif" font-size="47" fill="#fff9f5" letter-spacing="-1.4">${copy.quoteTitle}</text>
      <path d="M168 882h744" stroke="#fff9f5" stroke-opacity=".13"/>
      ${quoteRows}
      <path d="M168 1260h744" stroke="#fff9f5" stroke-opacity=".16"/>
      <text x="168" y="1308" font-size="32" font-weight="700" fill="#fff9f5">${copy.quoteTotal}</text>
      <path d="M730 1297h182" stroke="#f3a4ae" stroke-opacity=".78" stroke-width="6" stroke-linecap="round"/>
      <text x="168" y="1350" font-size="24" fill="#fff9f5" fill-opacity=".58">${copy.quoteNote}</text>

      ${progress}

      <path d="M120 1552h840" stroke="#fff9f5" stroke-opacity=".16"/>
      <circle cx="130" cy="1591" r="6" fill="#f3a4ae"/>
      <text x="153" y="1599" font-size="28" fill="#fff9f5" fill-opacity=".84">${copy.action}</text>
      <text x="960" y="1599" text-anchor="end" font-size="18" fill="#fff9f5" fill-opacity=".56" letter-spacing="1.1">${copy.actionHint.toUpperCase()}</text>
    </g>
  </svg>`);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function build() {
  await sharp(backgroundPath)
    .resize(1080, 1920, { fit: "cover", position: "centre" })
    .composite([{ input: overlay() }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(finalPath);

  const finalMetadata = await sharp(finalPath).metadata();
  const finalHash = await sha256(finalPath);
  const backgroundHash = await sha256(backgroundPath);

  const campaign = {
    schemaVersion: 1,
    campaignId,
    status: "draft",
    createdAt,
    dataCheckedAt,
    objective:
      "Announce that customers can request orders through JeloCare while making the pre-approval quote breakdown explicit.",
    sourceTruth: {
      repositoryCommit,
      repositoryState:
        "Evidence read from the current main revision; no live order, customer, retailer, price, stock, or payment data is represented.",
      adr: {
        path: "docs/adr/0016-retailer-scoped-assisted-procurement.md",
        evidence:
          "The customer approves the exact retailer, products, quote, fees, and delivery terms before payment; every quote separates product subtotal, retailer fee when charged, JeloCare service fee, and delivery; an unknown component prevents a final payable total.",
      },
      guestOrderUi: {
        path: "components/commerce/order-status.tsx",
        evidence:
          "At Quote ready, the customer-visible Cost breakdown presents the order costs and total before the same state offers Approve quote and says Pay after approval.",
      },
      memberOrderUi: {
        path: "components/me/orders/member-orders-view.tsx",
        evidence:
          "The signed-in order view repeats the same cost breakdown and approval-before-payment sequence.",
      },
      checkoutUi: {
        path: "components/commerce/procurement-basket.tsx",
        evidence:
          "Checkout requests a verified quote and explicitly takes no payment at request time; the customer approves the final quote later.",
      },
      operationsUi: {
        path: "app/(ops)/ops/orders/OrdersQueue.tsx",
        evidence:
          "Operations enters and reviews the product and service costs before issuing the exact quote.",
      },
      lifecycleUi: {
        path: "components/commerce/order-progress.tsx",
        evidence: "The canonical visible sequence is Request, Quote, Approve, Payment, Delivery.",
      },
    },
    offerEvidence: [],
    careBoundary:
      "Service-level ordering and quote-presentation copy only. No product, price, retailer, stock, savings, delivery-time, authenticity, medical, payment-success, or fulfilment-outcome claim.",
    claimBoundary: {
      proven:
        "A complete customer quote separates products, retailer fee, JeloCare fee, delivery, and total before approval; payment follows approval.",
      qualification:
        "The pre-request checkout shows only an observed product total. The complete fee breakdown appears later when Operations issues the verified quote. Unknown components remain unknown and prevent a final payable total.",
      notClaimed: [
        "that observed catalogue prices are final checkout prices",
        "that every retailer charges a fee",
        "that stock, delivery speed, savings, or payment success is guaranteed",
        "that JeloCare holds retailer inventory",
      ],
    },
    copy: {
      ...copy,
      caption:
        "Now you can order through JeloCare—with the full cost in view. Your verified quote separates products, retailer fee, JeloCare service fee, delivery, and total before you approve or pay. Start with an exact product: https://www.jelocare.com/products",
      targetPath: "/products",
      targetUrl: "https://www.jelocare.com/products",
    },
    sourceAsset: {
      path: backgroundName,
      sha256: backgroundHash,
      generationRoute: "built-in-imagegen",
      role:
        "Text-free campaign master field; deterministic SVG composition provides all visible copy and quote structure.",
      prompt: generationPrompt,
    },
    creativeDirection: {
      format: "1080x1920 WhatsApp Status",
      mode: "dark",
      safeAreas: { topPx: 220, sidePx: 120, bottomPx: 300 },
      embeddedUrls: false,
      note:
        "Service-level visual only; quote labels mirror the current customer and Operations UI without displaying invented amounts.",
    },
    creative: [
      {
        mode: "dark",
        path: finalName,
        width: finalMetadata.width,
        height: finalMetadata.height,
        sha256: finalHash,
        generationRoute:
          "built-in-imagegen-background-plus-deterministic-sharp-svg-composition",
      },
    ],
    channels: ["whatsapp-status"],
    publication: [],
  };

  await writeFile(
    path.join(directory, "campaign.json"),
    `${JSON.stringify(campaign, null, 2)}\n`,
  );

  const caption = `# WhatsApp Status copy

Now you can order through JeloCare—with the full cost in view.

Your verified quote separates products, retailer fee, JeloCare service fee, delivery, and total before you approve or pay.

Start with an exact product: https://www.jelocare.com/products

## Publication note

Draft only. Add the platform link to https://www.jelocare.com/products when publishing; no URL is embedded in the artwork. Publication, audience, timing, and spend remain unapproved.
`;
  await writeFile(path.join(directory, "CAPTION.md"), caption);

  const checksummed = [
    finalName,
    backgroundName,
    "CAPTION.md",
    "build-campaign.mjs",
    "campaign.json",
  ];
  const sums = await Promise.all(
    checksummed.map(
      async (name) => `${await sha256(path.join(directory, name))}  ${name}`,
    ),
  );
  await writeFile(path.join(directory, "SHA256SUMS"), `${sums.join("\n")}\n`);
}

await build();
