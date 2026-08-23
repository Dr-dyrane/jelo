import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = (name) => path.join(directory, "source", name);
const sharedSourceDirectory = path.resolve(
  directory,
  "..",
  "2026-08-13-aqua-rich-guest-shopping-flow-v1",
  "source",
);
const backgroundPath = path.join(
  sharedSourceDirectory,
  "immersive-master-field-imagegen.png",
);
const packshotPath = path.join(sharedSourceDirectory, "approved-packshot.png");

const repositoryCommit = "9106a0a8581fcc6ca73c428a60ac3fc2774e80d9";
const dataCheckedAt = "2026-08-21T18:10:00-07:00";

const frames = [
  {
    id: "exact-product",
    source: "iphone-01-product.webp",
    eyebrow: "EXACT PRODUCT",
    headline: ["Start with the", "exact product."],
    body: "Product, size and current stores.",
  },
  {
    id: "start-shopping",
    source: "iphone-02-start-shopping.webp",
    eyebrow: "ONE RETAILER",
    headline: ["Start shopping", "at one store."],
    body: "Your basket now stays there.",
  },
  {
    id: "keep-shopping",
    source: "iphone-03-keep-shopping.webp",
    eyebrow: "SAME STORE",
    headline: ["Keep adding", "from that store."],
    body: "Only exact listings from CSi Grocery.",
  },
  {
    id: "review-basket",
    source: "iphone-04-review-basket.webp",
    eyebrow: "ONE BASKET",
    headline: ["See both products", "in one basket."],
    body: "Choose the exact retailer match.",
  },
  {
    id: "contact",
    source: "iphone-05-contact.webp",
    eyebrow: "GUEST CHECKOUT",
    headline: ["No account", "required."],
    body: "Just the contact for this request.",
  },
  {
    id: "delivery",
    source: "iphone-06-delivery.webp",
    eyebrow: "DELIVERY",
    headline: ["Add the delivery", "location."],
    body: "JeloCare checks delivery there.",
  },
  {
    id: "review-request",
    source: "iphone-07-review-request.webp",
    eyebrow: "FINAL REVIEW",
    headline: ["Request a", "verified quote."],
    body: "Nothing is paid yet.",
  },
  {
    id: "request-received",
    source: "iphone-08-request-received.webp",
    eyebrow: "TRACKING",
    headline: ["Track every", "next step."],
    body: "Quote → approval → payment → delivery.",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function headlineTspans(lines) {
  return lines
    .map(
      (line, index) =>
        `<tspan x="96" dy="${index === 0 ? 0 : 64}">${escapeXml(line)}</tspan>`,
    )
    .join("");
}

function progressDots(activeIndex) {
  return frames
    .map((_, index) => {
      const x = 96 + index * 32;
      const fill = index === activeIndex ? "#f5a1ae" : "#fff9f5";
      const opacity = index === activeIndex ? "1" : ".24";
      return `<circle cx="${x}" cy="1774" r="5" fill="${fill}" fill-opacity="${opacity}"/>`;
    })
    .join("");
}

function textOverlay(frame, index) {
  return Buffer.from(`<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#080407" stop-opacity=".80"/>
        <stop offset=".40" stop-color="#18090e" stop-opacity=".12"/>
        <stop offset="1" stop-color="#080507" stop-opacity=".66"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#shade)"/>
    <g font-family="Arial, sans-serif" fill="#fff9f5">
      <text x="96" y="116" font-size="30" letter-spacing="-.7"><tspan font-weight="700">Jelo</tspan><tspan font-weight="300">Care</tspan></text>
      <text x="984" y="114" text-anchor="end" font-size="17" letter-spacing="2.4" fill-opacity=".56">${String(index + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}</text>
      <text x="96" y="182" font-size="15" font-weight="700" letter-spacing="3.2" fill="#f5a1ae">${escapeXml(frame.eyebrow)}</text>
      <text x="96" y="260" font-family="Georgia, serif" font-size="58" letter-spacing="-2.2">${headlineTspans(frame.headline)}</text>
      <text x="96" y="410" font-size="22" fill-opacity=".72">${escapeXml(frame.body)}</text>
      <path d="M96 1718h888" stroke="#fff" stroke-opacity=".16"/>
      ${progressDots(index)}
      <text x="984" y="1781" text-anchor="end" font-size="17" letter-spacing="1.2" fill-opacity=".58">SWIPE TO CONTINUE</text>
      <text x="96" y="1850" font-size="18" fill-opacity=".70">Real guest flow · No payment before quote approval</text>
    </g>
  </svg>`);
}

function phoneFrame() {
  return Buffer.from(`<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-45%" y="-30%" width="190%" height="190%">
        <feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#000" flood-opacity=".58"/>
      </filter>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#76676e"/>
        <stop offset=".18" stop-color="#241f22"/>
        <stop offset=".58" stop-color="#080809"/>
        <stop offset="1" stop-color="#3e3439"/>
      </linearGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#c8bac0" stop-opacity=".42"/>
        <stop offset=".12" stop-color="#fff" stop-opacity=".06"/>
        <stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </linearGradient>
    </defs>
    <g filter="url(#shadow)">
      <rect x="225" y="474" width="630" height="1150" rx="100" fill="url(#rim)" stroke="#9b8a91" stroke-opacity=".44" stroke-width="3"/>
      <rect x="233" y="482" width="614" height="1134" rx="94" fill="url(#edge)"/>
      <rect x="219" y="655" width="7" height="110" rx="3.5" fill="#5b4f54"/>
      <rect x="219" y="790" width="7" height="158" rx="3.5" fill="#5b4f54"/>
      <rect x="854" y="725" width="7" height="204" rx="3.5" fill="#50454a"/>
    </g>
  </svg>`);
}

async function roundedScreen(filePath) {
  const width = 570;
  const height = 1106;
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="72" fill="#fff"/></svg>`,
  );
  const cleanViewport = await sharp(filePath)
    .extract({ left: 0, top: 0, width: 1320, height: 2560 })
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();

  return sharp(cleanViewport)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function build() {
  const finals = [];
  for (const [index, frame] of frames.entries()) {
    const outputName = `${String(index + 1).padStart(2, "0")}-${frame.id}-story.jpg`;
    const outputPath = path.join(directory, outputName);
    const screen = await roundedScreen(source(frame.source));

    await sharp(backgroundPath)
      .resize(1080, 1920, { fit: "cover", position: "centre" })
      .composite([
        { input: textOverlay(frame, index) },
        { input: phoneFrame() },
        { input: screen, left: 255, top: 496 },
      ])
      .jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: "4:4:4" })
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

  const contactSheetPath = path.join(directory, "contact-sheet.jpg");
  const thumbnails = await Promise.all(
    finals.map((final) =>
      sharp(final.outputPath)
        .resize(540, 960, { fit: "fill" })
        .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer(),
    ),
  );
  await sharp({
    create: { width: 2160, height: 1920, channels: 4, background: "#080607" },
  })
    .composite(
      finals.map((_, index) => ({
        input: thumbnails[index],
        left: (index % 4) * 540,
        top: Math.floor(index / 4) * 960,
      })),
    )
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(contactSheetPath);

  const sourceScreens = await Promise.all(
    frames.map(async (frame) => ({
      path: `source/${frame.source}`,
      sha256: await sha256(source(frame.source)),
    })),
  );
  const backgroundHash = await sha256(backgroundPath);
  const packshotHash = await sha256(packshotPath);

  const campaign = {
    schemaVersion: 1,
    campaignId: "2026-08-21-ordering-how-it-works-carousel-v1",
    status: "draft",
    createdAt: new Date().toISOString(),
    dataCheckedAt,
    objective:
      "Show the complete JeloCare guest ordering request flow in eight readable, real-product steps for the Daily Desk and social story channels.",
    sourceTruth: {
      repositoryCommit,
      simulatorEvidence:
        "Fresh iPhone 17 Pro Max simulator. Development-only assisted-procurement fixture, synthetic guest identity and address, no real customer data, payment, email, or WhatsApp send.",
      basketEvidence:
        "Aqua Rich Hydrate + Protect Body Lotion 500 ml and Advanced Clinicals Vitamin C Face Serum at CSi Grocery; exact one-retailer basket observed during capture.",
    },
    product: {
      slug: "aqua-rich-ceramide-body-lotion-500ml",
      brand: "Aqua Rich",
      name: "Hydrate + Protect Body Lotion",
      size: "500 ml",
      identifier: { kind: "gtin", value: "4897073187549" },
    },
    sourceAsset: {
      path: "../2026-08-13-aqua-rich-guest-shopping-flow-v1/source/approved-packshot.png",
      sha256: packshotHash,
    },
    careBoundary:
      "Ordering workflow and product identity only. No suitability, treatment, diagnosis, authenticity, sale, saving, stock guarantee, or outcome claim.",
    copy: {
      headline: "Order in eight swipes.",
      action: "Start with the exact product",
      disclaimer:
        "Prices, availability, delivery and fees are verified before quote approval. No payment is taken during the request.",
      embeddedUrl: null,
    },
    background: {
      path: "../2026-08-13-aqua-rich-guest-shopping-flow-v1/source/immersive-master-field-imagegen.png",
      sha256: backgroundHash,
      generationRoute: "reused-built-in-imagegen-background",
      promptBoundary:
        "Text-free near-black, wine, peach and porcelain campaign field; no product, phone, people, logo, UI or claims.",
    },
    simulator: {
      device: "JeloCare Ordering Carousel 2026-08-21",
      model: "iPhone 17 Pro Max",
      os: "iOS 26.5",
      udid: "B826258E-7DA0-43E4-8F7A-50629CE37D1C",
    },
    simulatorSources: sourceScreens,
    creative: finals.map((final, index) => ({
      mode: "dark",
      sequence: index + 1,
      path: final.outputName,
      width: final.width,
      height: final.height,
      sha256: final.sha256,
      generationRoute:
        "built-in-imagegen-background-plus-deterministic-sharp-composition",
    })),
    contactSheet: {
      path: "contact-sheet.jpg",
      sha256: await sha256(contactSheetPath),
    },
    channels: [
      "daily-desk",
      "whatsapp-status",
      "instagram-stories",
      "snapchat",
    ],
    publication: [],
  };
  await writeFile(
    path.join(directory, "campaign.json"),
    `${JSON.stringify(campaign, null, 2)}\n`,
  );

  const captions = `# Publishing copy\n\nStatus: draft. Nothing has been published.\n\n## WhatsApp Status / Instagram Stories / Snapchat\n\nOrder on JeloCare in eight clear steps. Start with the exact product, keep one basket at one retailer, checkout as a guest, request a verified quote, then track every next step. No payment is taken before you review and approve the quote.\n\nLink sticker: https://www.jelocare.com/products/aqua-rich-ceramide-body-lotion-500ml\n\n## Frame captions\n\n1. Start with the exact product and size.\n2. Choose one retailer and begin shopping there.\n3. Add more exact products from the same store.\n4. Review one basket and its current retailer match.\n5. Checkout as a guest—no account required.\n6. Add the location where you need delivery.\n7. Review the request. Nothing is paid yet.\n8. Track quote, approval, payment and delivery in one place.\n\n## Publication order\n\nPublish frames 01–08 in order. Add the platform link sticker; do not stamp a URL into the artwork. Prices, availability, delivery and fees are verified before quote approval.\n`;
  await writeFile(path.join(directory, "CAPTIONS.md"), captions);

  const checksummed = [
    ...finals.map((final) => final.outputName),
    "contact-sheet.jpg",
    ...frames.map((frame) => `source/${frame.source}`),
  ];
  const sums = await Promise.all(
    checksummed.map(
      async (name) => `${await sha256(path.join(directory, name))}  ${name}`,
    ),
  );
  await writeFile(path.join(directory, "SHA256SUMS"), `${sums.join("\n")}\n`);
}

await build();
