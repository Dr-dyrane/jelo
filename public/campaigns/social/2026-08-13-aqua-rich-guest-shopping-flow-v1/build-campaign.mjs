import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = (name) => path.join(directory, "source", name);
const backgroundPath = source("immersive-master-field-imagegen.png");
const packshotPath = source("approved-packshot.png");

const dataCheckedAt = "2026-08-13T17:39:11.035Z";
const repositoryCommit = "30ea7e88d300d19967efeff06d384403574ab4a1";

const frames = [
  {
    id: "discover",
    source: "iphone-01-product.png",
    eyebrow: "OBSERVED 8 AUG  ·  ↓ 15.6%  ·  30D",
    headline: "Find the exact product.",
    body: "Aqua Rich · Hydrate + Protect Body Lotion · 500 ml",
    footer: "Observed movement, then the exact product.",
  },
  {
    id: "choose-store",
    source: "iphone-02-retailer-shopping.png",
    eyebrow: "CHOOSE ONE RETAILER",
    headline: "Start shopping there.",
    body: "Your guest basket stays with one store.",
    footer: "One retailer keeps delivery and costs coherent.",
  },
  {
    id: "keep-shopping",
    source: "iphone-03-retailer-products.png",
    eyebrow: "SAME STORE  ·  MORE PRODUCTS",
    headline: "Keep adding from there.",
    body: "The basket stays visible while you browse.",
    footer: "Exact listings from the selected retailer only.",
  },
  {
    id: "review-basket",
    source: "iphone-04-basket.png",
    eyebrow: "GUEST-FIRST BASKET",
    headline: "Review one basket.",
    body: "Adjust quantities before you request anything.",
    footer: "Product totals exclude delivery.",
  },
  {
    id: "guest-checkout",
    source: "iphone-05-checkout.png",
    eyebrow: "NO ACCOUNT REQUIRED",
    headline: "Checkout as a guest.",
    body: "Contact details are used only for this request.",
    footer: "No payment is taken at this step.",
  },
  {
    id: "request-received",
    source: "iphone-06-order-requested.png",
    eyebrow: "ORDER REQUESTED",
    headline: "Now JeloCare checks.",
    body: "Products, retailer terms, fees and delivery.",
    footer: "A complete quote comes before approval or payment.",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textOverlay(frame, index) {
  return Buffer.from(`<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#030203" stop-opacity=".76"/>
        <stop offset=".36" stop-color="#12070b" stop-opacity=".18"/>
        <stop offset="1" stop-color="#080507" stop-opacity=".42"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#topShade)"/>
    <g font-family="Arial, sans-serif" fill="#fff9f5">
      <text x="120" y="250" font-size="36" letter-spacing="-.8"><tspan font-weight="700">Jelo</tspan><tspan font-weight="300">Care</tspan></text>
      <text x="960" y="248" text-anchor="end" font-size="18" letter-spacing="2.8" fill-opacity=".55">${String(index + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}</text>
      <text x="120" y="323" font-size="16" font-weight="700" letter-spacing="3.3" fill="#f4a5ae">${escapeXml(frame.eyebrow)}</text>
      <text x="120" y="408" font-family="Georgia, serif" font-size="66" letter-spacing="-2.5">${escapeXml(frame.headline)}</text>
      <text x="120" y="464" font-size="24" fill-opacity=".70">${escapeXml(frame.body)}</text>
      <path d="M120 1604h840" stroke="#fff" stroke-opacity=".17"/>
      <circle cx="132" cy="1647" r="6" fill="#f4a5ae"/>
      <text x="152" y="1655" font-size="20" fill-opacity=".68">${escapeXml(frame.footer)}</text>
      <text x="960" y="1655" text-anchor="end" font-size="16" letter-spacing="1.3" fill-opacity=".52">8 AUG  ·  PRICES CHANGE</text>
    </g>
  </svg>`);
}

function phoneFrame() {
  return Buffer.from(`<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-40%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#000" flood-opacity=".54"/>
      </filter>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#50454b"/>
        <stop offset=".48" stop-color="#09090a"/>
        <stop offset="1" stop-color="#2d2529"/>
      </linearGradient>
    </defs>
    <g filter="url(#shadow)">
      <rect x="290" y="505" width="500" height="1050" rx="84" fill="url(#rim)" stroke="#6c5e64" stroke-opacity=".62" stroke-width="2"/>
      <rect x="283" y="690" width="7" height="112" rx="3.5" fill="#433a3e"/>
      <rect x="283" y="822" width="7" height="154" rx="3.5" fill="#433a3e"/>
      <rect x="790" y="752" width="7" height="202" rx="3.5" fill="#433a3e"/>
    </g>
  </svg>`);
}

async function roundedScreen(filePath) {
  const mask = Buffer.from(`<svg width="452" height="984" xmlns="http://www.w3.org/2000/svg"><rect width="452" height="984" rx="65" fill="#fff"/></svg>`);
  const cleanViewport = await sharp(filePath)
    // Remove only the local Safari address bar. These iPhone 17 Pro Max
    // captures are 1320 px wide; retaining that full width prevents the real
    // JeloCare interface copy from being cropped inside the campaign phone.
    .extract({ left: 0, top: 0, width: 1320, height: 2560 })
    .resize(452, 877, { fit: "fill" })
    .extend({ bottom: 107, background: "#fff9f4" })
    .png()
    .toBuffer();
  return sharp(cleanViewport)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function build() {
  const finals = [];
  for (const [index, frame] of frames.entries()) {
    const outputName = `${String(index + 1).padStart(2, "0")}-${frame.id}-story.png`;
    const outputPath = path.join(directory, outputName);
    const screen = await roundedScreen(source(frame.source));
    await sharp(backgroundPath)
      .resize(1080, 1920, { fit: "cover", position: "centre" })
      .composite([
        { input: textOverlay(frame, index) },
        { input: phoneFrame() },
        { input: screen, left: 314, top: 528 },
      ])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
    const metadata = await sharp(outputPath).metadata();
    finals.push({
      ...frame,
      outputName,
      outputPath,
      width: metadata.width,
      height: metadata.height,
      sha256: await sha256(outputPath),
    });
  }

  const contactSheetPath = path.join(directory, "contact-sheet.png");
  const thumbnails = await Promise.all(finals.map((final) => (
    sharp(final.outputPath).resize(540, 960, { fit: "fill" }).png().toBuffer()
  )));
  await sharp({ create: { width: 1620, height: 1920, channels: 4, background: "#080607" } })
    .composite(finals.map((final, index) => ({
      input: thumbnails[index],
      left: (index % 3) * 540,
      top: Math.floor(index / 3) * 960,
    })))
    .png({ compressionLevel: 9 })
    .toFile(contactSheetPath);

  const sourceScreens = await Promise.all(frames.map(async (frame) => ({
    path: `source/${frame.source}`,
    sha256: await sha256(source(frame.source)),
  })));
  const backgroundHash = await sha256(backgroundPath);
  const packshotHash = await sha256(packshotPath);
  const campaign = {
    schemaVersion: 1,
    campaignId: "2026-08-13-aqua-rich-guest-shopping-flow-v1",
    status: "draft",
    createdAt: new Date().toISOString(),
    dataCheckedAt,
    objective: "Explain JeloCare's complete guest-first shopping request flow using the catalogue's strongest current recorded 30-day price-drop signal.",
    sourceTruth: {
      repositoryCommit,
      flowImplementationCommits: ["88352d2", "0e3251b"],
      simulatorEvidence: "Fresh disposable iPhone 17 Pro Max simulator; fixture-only identity and order; no real payment, message, or customer data.",
      currentOfferRecheck: "BuyBetter exact 500 ml listing reopened 2026-08-13 and observed out of stock; inaccessible retailers were not represented as freshly checked stock in visible copy.",
    },
    product: {
      slug: "aqua-rich-ceramide-body-lotion-500ml",
      brand: "Aqua Rich",
      name: "Hydrate + Protect Body Lotion",
      size: "500 ml",
      identifier: { kind: "gtin", value: "4897073187549" },
    },
    sourceAsset: {
      url: "https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/aqua-rich/aqua-rich-ceramide-body-lotion-500ml/packshot-v2-684207f5bc33db69.png",
      path: "source/approved-packshot.png",
      sha256: packshotHash,
    },
    trendEvidence: {
      direction: "down",
      percent: -15.6,
      amountNaira: 2237,
      days: 30,
      comparableRetailerCount: 2,
      lowestObservedNaira: 9500,
      movementObservedAt: "2026-08-08T13:15:00.000Z",
      visibleCopy: "↓ 15.6% · 30d",
    },
    careBoundary: "Product identity and shopping workflow only. No suitability, treatment, diagnosis, authenticity, sale, saving, or outcome claim.",
    copy: {
      headline: "A six-step guest shopping flow.",
      productLine: "Aqua Rich · Hydrate + Protect Body Lotion · 500 ml",
      action: "Try the guest flow",
      disclaimer: "Prices and availability change. A complete quote comes before approval or payment.",
      embeddedUrl: null,
    },
    background: {
      path: "source/immersive-master-field-imagegen.png",
      sha256: backgroundHash,
      generationRoute: "built-in-imagegen",
      promptBoundary: "Text-free near-black, wine, peach and porcelain campaign field; no product, phone, people, logo, UI or claims.",
    },
    simulatorSources: sourceScreens,
    creative: finals.map((final) => ({
      mode: "dark",
      sequence: finals.indexOf(final) + 1,
      path: final.outputName,
      width: final.width,
      height: final.height,
      sha256: final.sha256,
      generationRoute: "built-in-imagegen-background-plus-deterministic-sharp-composition",
    })),
    contactSheet: { path: "contact-sheet.png", sha256: await sha256(contactSheetPath) },
    channels: ["whatsapp-status", "instagram-stories", "snapchat"],
    publication: [],
  };
  await writeFile(path.join(directory, "campaign.json"), `${JSON.stringify(campaign, null, 2)}\n`);

  const caption = `# Publishing copy\n\n## WhatsApp Status / Instagram Stories / Snapchat\n\nShop as a guest on JeloCare. Choose the exact product, pick one retailer, keep adding from that store, review one basket, then send an order request. JeloCare prepares a complete quote before you approve or pay anything.\n\nThis flow uses Aqua Rich Hydrate + Protect Body Lotion 500 ml — JeloCare's strongest recorded 30-day price-drop signal (down 15.6%, observed 8 Aug). Prices and availability change.\n\nLink sticker: https://www.jelocare.com/products/aqua-rich-ceramide-body-lotion-500ml\n\n## Publication order\n\nPublish frames 01–06 in order. Add the platform link sticker; do not embed or stamp a URL into the artwork.\n`;
  await writeFile(path.join(directory, "CAPTIONS.md"), caption);

  const checksummed = [
    ...finals.map((final) => final.outputName),
    "contact-sheet.png",
    "source/immersive-master-field-imagegen.png",
    "source/approved-packshot.png",
    ...frames.map((frame) => `source/${frame.source}`),
  ];
  const sums = await Promise.all(checksummed.map(async (name) => `${await sha256(path.join(directory, name))}  ${name}`));
  await writeFile(path.join(directory, "SHA256SUMS"), `${sums.join("\n")}\n`);
}

await build();
