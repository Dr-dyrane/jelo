import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = (name) => path.join(directory, "source", name);
const previousCampaign = path.resolve(
  directory,
  "..",
  "2026-08-21-ordering-how-it-works-carousel-v1",
);

const basePath = source("handheld-phone-chroma-imagegen.png");
const screenPath = path.join(
  previousCampaign,
  "source",
  "iphone-04-review-basket.webp",
);
const outputName = "01-one-basket-clear-quote.jpg";
const outputPath = path.join(directory, outputName);

const visibleCopy = {
  brand: "JeloCare",
  headline: "One basket. One clear quote.",
};

function textOverlay(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <g font-family="Arial, Helvetica, sans-serif">
      <rect x="348" y="194" width="245" height="78" rx="27" fill="#f59cac"/>
      <text x="470.5" y="248" text-anchor="middle" fill="#16070d" font-size="38" font-weight="750" letter-spacing="-1.6">JeloCare</text>
      <text x="470.5" y="376" text-anchor="middle" fill="#fff9f4" font-size="87" font-weight="800" letter-spacing="-4.8">One basket.</text>
      <text x="470.5" y="470" text-anchor="middle" fill="#fff9f4" font-size="87" font-weight="800" letter-spacing="-4.8">One clear quote.</text>
    </g>
  </svg>`);
}

function reflectionOverlay(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
        <stop offset=".28" stop-color="#fff" stop-opacity=".025"/>
        <stop offset=".52" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#fff" stop-opacity=".035"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#glass)"/>
  </svg>`);
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function findChromaScreen() {
  const { data, info } = await sharp(basePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixel = (y * info.width + x) * info.channels;
      const red = data[pixel];
      const green = data[pixel + 1];
      const blue = data[pixel + 2];
      const isChroma = green > 50 && green > red * 1.1 && green > blue * 1.08;

      if (!isChroma) continue;

      alpha[y * info.width + x] = 255;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) {
    throw new Error("The generated handheld master has no chroma screen.");
  }

  const bounds = {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  const mask = await sharp(alpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .extract(bounds)
    .png()
    .toBuffer();

  return { bounds, mask, width: info.width, height: info.height };
}

async function build() {
  const screen = await findChromaScreen();
  const sourceScreen = await sharp(screenPath)
    .extract({ left: 77, top: 0, width: 1166, height: 2560 })
    .resize(screen.bounds.width, screen.bounds.height, { fit: "fill" })
    .joinChannel(screen.mask)
    .png()
    .toBuffer();
  const glass = await sharp(
    reflectionOverlay(screen.bounds.width, screen.bounds.height),
  )
    .joinChannel(screen.mask)
    .png()
    .toBuffer();

  const composedMaster = await sharp(basePath)
    .composite([
      {
        input: sourceScreen,
        left: screen.bounds.left,
        top: screen.bounds.top,
      },
      { input: glass, left: screen.bounds.left, top: screen.bounds.top },
      { input: textOverlay(screen.width, screen.height) },
    ])
    .png()
    .toBuffer();

  await sharp(composedMaster)
    .resize(1080, 1920, { fit: "fill" })
    .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(outputPath);

  const outputMetadata = await sharp(outputPath).metadata();
  const sourceHash = await sha256(basePath);
  const screenHash = await sha256(screenPath);
  const outputHash = await sha256(outputPath);
  const createdAt = new Date().toISOString();

  const campaign = {
    schemaVersion: 1,
    campaignId: "2026-08-22-ordering-handheld-v1",
    status: "draft",
    createdAt,
    dataCheckedAt: "2026-08-21T18:10:00-07:00",
    objective:
      "Demonstrate JeloCare's one-retailer basket and quote-first ordering model through a premium photographic handheld-phone campaign proof.",
    sourceTruth: {
      repositoryCommit: "9106a0a8581fcc6ca73c428a60ac3fc2774e80d9",
      simulatorEvidence:
        "Exact JeloCare basket screen captured in a fresh iPhone 17 Pro Max simulator using the development-only assisted-procurement fixture. No real customer data, payment, email, or WhatsApp send.",
      visualSystem:
        "Photographic hand-and-phone master generated without UI or text; exact JeloCare UI and visible campaign copy were composited deterministically.",
    },
    product: {
      slug: "aqua-rich-ceramide-body-lotion-500ml",
      brand: "Aqua Rich",
      name: "Hydrate + Protect Body Lotion",
      size: "500 ml",
      identifier: { kind: "gtin", value: "4897073187549" },
    },
    sourceAsset: {
      path: "source/handheld-phone-chroma-imagegen.png",
      sha256: sourceHash,
      generationRoute: "built-in-imagegen",
      promptBoundary:
        "Text-free, logo-free dark-skinned hand holding a generic front-facing phone with a chroma screen on a deep black-cherry field.",
    },
    interfaceEvidence: {
      path: "../2026-08-21-ordering-how-it-works-carousel-v1/source/iphone-04-review-basket.webp",
      sha256: screenHash,
    },
    careBoundary:
      "Ordering workflow only. No suitability, treatment, diagnosis, authenticity, saving, stock guarantee, or clinical outcome claim.",
    copy: {
      headline: visibleCopy.headline,
      productLine: null,
      priceLine: null,
      action: "Browse products",
      disclaimer:
        "Products, delivery and fees are verified before quote approval. No payment is taken during the request.",
      embeddedUrl: null,
    },
    creative: [
      {
        mode: "dark",
        path: outputName,
        width: outputMetadata.width,
        height: outputMetadata.height,
        sha256: outputHash,
        generationRoute:
          "built-in-imagegen-photographic-master-plus-deterministic-exact-screen-composite",
      },
    ],
    channels: ["whatsapp-status", "instagram-stories", "snapchat"],
    publication: [],
  };

  await writeFile(
    path.join(directory, "campaign.json"),
    `${JSON.stringify(campaign, null, 2)}\n`,
  );
  await writeFile(
    path.join(directory, "CAPTION.md"),
    "# Draft caption\n\nOne basket. One retailer. One complete quote before you approve or pay.\n\nBrowse: https://www.jelocare.com/products\n\nPrices, availability, delivery and fees are verified before quote approval.\n",
  );
  await writeFile(
    path.join(directory, "SHA256SUMS"),
    `${outputHash}  ${outputName}\n${sourceHash}  source/handheld-phone-chroma-imagegen.png\n`,
  );
}

await build();
