import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const SOURCE = path.join(HERE, "source");
const FINAL = path.join(HERE, "final");
const HIGHLIGHTS = path.join(FINAL, "highlights");
const PREVIEW = path.join(HERE, "preview");

const FEED = { width: 1080, height: 1350 };
const STORY = { width: 1080, height: 1920 };
const CAMPAIGN_ID = "2026-08-25-instagram-foundation-v1";
const APPROVED_AT = "2026-08-25T21:14:38Z";

const SOURCE_FILES = {
  avatar: "jelocare-avatar.png",
  bundle: "jelocare-bundle-mobile.png",
  consult: "jelocare-consult-mobile.png",
  cerave: "cerave-foaming-facial-cleanser-236ml.png",
  dang: "dang-azelaic-acid-serum-30ml.png",
  laroche: "la-roche-posay-anthelios-uvmune-400-oil-control-fluid-50ml.png",
};

const FONT_FILES = {
  manropeRegular: path.join(
    ROOT,
    "app/(site)/share/[slug]/_og/manrope-400.ttf",
  ),
  manropeSemibold: path.join(
    ROOT,
    "app/(site)/share/[slug]/_og/manrope-600.ttf",
  ),
  italiana: path.join(
    ROOT,
    "app/(site)/share/[slug]/_og/italiana-400.ttf",
  ),
};

const PALETTE = {
  ink: "#2d211f",
  muted: "#7a6b66",
  cream: "#fbf3ed",
  paper: "#fffdf9",
  peach: "#f4d4c5",
  rose: "#e8bbb4",
  wine: "#6b3b35",
  black: "#000000",
  recessed: "#0d090b",
  darkPaper: "#171214",
  porcelain: "#fff7f4",
  darkMuted: "#c6b0ad",
  actionPink: "#ff9aa5",
};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function fontFace(name, weight, base64) {
  return `
    @font-face {
      font-family: '${name}';
      font-style: normal;
      font-weight: ${weight};
      src: url(data:font/ttf;base64,${base64}) format('truetype');
    }`;
}

function svgDocument({ width, height, body, fonts, extraDefs = "" }) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <style>
          ${fontFace("ManropeCampaign", 400, fonts.manropeRegular)}
          ${fontFace("ManropeCampaign", 600, fonts.manropeSemibold)}
          ${fontFace("ItalianaCampaign", 400, fonts.italiana)}
          text { text-rendering: geometricPrecision; }
        </style>
        ${extraDefs}
      </defs>
      ${body}
    </svg>
  `);
}

function wordmark(x, y, color, size = 29) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" letter-spacing="5.2">JELOCARE</text>`;
}

function smallLabel(x, y, text, color, anchor = "start") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="ManropeCampaign" font-size="16" font-weight="600" letter-spacing="4.2">${text}</text>`;
}

function arrow(x, y, color) {
  return `<path d="M${x} ${y}h30m-11-11 11 11-11 11" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function appFrame({ x, y, width, height, image, border, shadowId }) {
  const radius = 48;
  const inset = 12;
  const screenX = x + inset;
  const screenY = y + inset;
  const screenWidth = width - inset * 2;
  const screenHeight = height - inset * 2;
  return `
    <g filter="url(#${shadowId})">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${border}"/>
      <g clip-path="url(#screen-${shadowId})">
        <image x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" href="${image}" preserveAspectRatio="xMidYMin slice"/>
      </g>
      <rect x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" rx="${radius - inset}" fill="none" stroke="#ffffff" stroke-opacity="0.36" stroke-width="1.5"/>
    </g>`;
}

function startPost({ fonts, assets }) {
  const body = `
    <rect width="1080" height="1350" fill="${PALETTE.cream}"/>
    <circle cx="958" cy="184" r="286" fill="${PALETTE.peach}" fill-opacity="0.55"/>
    <circle cx="64" cy="1130" r="260" fill="${PALETTE.rose}" fill-opacity="0.24"/>
    ${wordmark(72, 96, PALETTE.ink)}
    ${smallLabel(1008, 96, "START HERE", PALETTE.wine, "end")}

    <text x="72" y="218" fill="${PALETTE.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="88" letter-spacing="-2.3">
      <tspan x="72" dy="0">Products.</tspan>
      <tspan x="72" dy="91">Prices.</tspan>
      <tspan x="72" dy="91">Clear context.</tspan>
    </text>
    <text x="74" y="492" fill="${PALETTE.muted}" font-family="ManropeCampaign" font-size="27">For Nigerian skincare shoppers.</text>

    <g filter="url(#stageShadow)">
      <rect x="72" y="548" width="936" height="622" rx="58" fill="url(#productField)"/>
      <path d="M72 992C278 822 412 803 562 916c137 103 240 61 446-104v358H72Z" fill="#fffdf9" fill-opacity="0.32"/>
      <ellipse cx="238" cy="1006" rx="116" ry="25" fill="#6b3b35" fill-opacity="0.14"/>
      <ellipse cx="540" cy="1000" rx="120" ry="26" fill="#6b3b35" fill-opacity="0.14"/>
      <ellipse cx="842" cy="1006" rx="116" ry="25" fill="#6b3b35" fill-opacity="0.14"/>
      <g filter="url(#productShadow)">
        <image x="110" y="610" width="256" height="380" href="${assets.cerave}" preserveAspectRatio="xMidYMid meet"/>
        <image x="404" y="588" width="272" height="410" href="${assets.dang}" preserveAspectRatio="xMidYMid meet"/>
        <image x="716" y="610" width="252" height="380" href="${assets.laroche}" preserveAspectRatio="xMidYMid meet"/>
      </g>
      <g font-family="ManropeCampaign" text-anchor="middle" fill="${PALETTE.ink}">
        <text x="238" y="1086" font-size="17" font-weight="600" letter-spacing="1.2">CERAVE</text>
        <text x="540" y="1086" font-size="17" font-weight="600" letter-spacing="1.2">DANG! LIFESTYLE</text>
        <text x="842" y="1086" font-size="17" font-weight="600" letter-spacing="1.2">LA ROCHE-POSAY</text>
      </g>
    </g>

    <text x="72" y="1278" fill="${PALETTE.ink}" font-family="ManropeCampaign" font-size="23" font-weight="600">jelocare.com</text>
    ${arrow(930, 1269, PALETTE.wine)}
  `;
  const extraDefs = `
    <linearGradient id="productField" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7ddd3"/>
      <stop offset="0.48" stop-color="#f0cac8"/>
      <stop offset="1" stop-color="#f8e9e2"/>
    </linearGradient>
    <filter id="stageShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#70473d" flood-opacity="0.13"/>
    </filter>
    <filter id="productShadow" x="-25%" y="-25%" width="150%" height="170%">
      <feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#5b192b" flood-opacity="0.18"/>
    </filter>`;
  return svgDocument({ ...FEED, body, fonts, extraDefs });
}

function comparePost({ fonts, assets }) {
  const body = `
    <rect width="1080" height="1350" fill="${PALETTE.black}"/>
    <rect width="1080" height="1350" fill="url(#darkGlow)"/>
    <path d="M-120 1090C228 846 394 862 592 1036c164 144 311 129 642-126" fill="none" stroke="#ff9aa5" stroke-opacity="0.12" stroke-width="116"/>
    ${wordmark(72, 96, PALETTE.porcelain)}
    ${smallLabel(1008, 96, "COMPARE + ORDER", PALETTE.actionPink, "end")}

    <text x="72" y="222" fill="${PALETTE.porcelain}" font-family="Georgia, 'Times New Roman', serif" font-size="82" letter-spacing="-2.1">
      <tspan x="72" dy="0">One basket.</tspan>
      <tspan x="72" dy="88">One clear quote.</tspan>
    </text>
    <text x="74" y="388" fill="${PALETTE.darkMuted}" font-family="ManropeCampaign" font-size="25">
      <tspan x="74" dy="0">Choose products. See real one-retailer baskets.</tspan>
    </text>

    ${appFrame({
      x: 264,
      y: 448,
      width: 552,
      height: 746,
      image: assets.bundle,
      border: PALETTE.darkPaper,
      shadowId: "bundleFrame",
    })}

    <circle cx="194" cy="846" r="7" fill="${PALETTE.actionPink}"/>
    <text x="194" y="888" text-anchor="middle" fill="${PALETTE.darkMuted}" font-family="ManropeCampaign" font-size="14" letter-spacing="2.5" transform="rotate(-90 194 888)">REAL SITE SURFACE</text>
    <text x="72" y="1278" fill="${PALETTE.porcelain}" font-family="ManropeCampaign" font-size="23" font-weight="600">jelocare.com/bundle</text>
    ${arrow(930, 1269, PALETTE.actionPink)}
  `;
  const extraDefs = `
    <radialGradient id="darkGlow" cx="74%" cy="20%" r="100%">
      <stop offset="0" stop-color="#5b1f32" stop-opacity="0.7"/>
      <stop offset="0.42" stop-color="#260c14" stop-opacity="0.48"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="bundleFrame" x="-35%" y="-30%" width="170%" height="180%">
      <feDropShadow dx="0" dy="30" stdDeviation="36" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <clipPath id="screen-bundleFrame"><rect x="276" y="460" width="528" height="722" rx="36"/></clipPath>`;
  return svgDocument({ ...FEED, body, fonts, extraDefs });
}

function consultPost({ fonts, assets }) {
  const body = `
    <rect width="1080" height="1350" fill="url(#consultField)"/>
    <circle cx="110" cy="198" r="265" fill="#fffdf9" fill-opacity="0.38"/>
    <circle cx="1008" cy="1054" r="292" fill="#e8bbb4" fill-opacity="0.34"/>
    ${wordmark(72, 96, PALETTE.ink)}
    ${smallLabel(1008, 96, "ASK JELOCARE", PALETTE.wine, "end")}

    <text x="72" y="218" fill="${PALETTE.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="82" letter-spacing="-2.1">
      <tspan x="72" dy="0">Tell us what</tspan>
      <tspan x="72" dy="88">you notice.</tspan>
    </text>
    <text x="74" y="390" fill="${PALETTE.muted}" font-family="ManropeCampaign" font-size="25">A sourced care guide—not a diagnosis.</text>

    ${appFrame({
      x: 264,
      y: 448,
      width: 552,
      height: 746,
      image: assets.consult,
      border: PALETTE.paper,
      shadowId: "consultFrame",
    })}

    <circle cx="194" cy="846" r="7" fill="${PALETTE.wine}"/>
    <text x="194" y="888" text-anchor="middle" fill="${PALETTE.wine}" font-family="ManropeCampaign" font-size="14" letter-spacing="2.5" transform="rotate(-90 194 888)">REAL SITE SURFACE</text>
    <text x="72" y="1278" fill="${PALETTE.ink}" font-family="ManropeCampaign" font-size="23" font-weight="600">jelocare.com/consult</text>
    ${arrow(930, 1269, PALETTE.wine)}
  `;
  const extraDefs = `
    <linearGradient id="consultField" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf3ed"/>
      <stop offset="0.5" stop-color="#f4d4c5"/>
      <stop offset="1" stop-color="#f8e8e2"/>
    </linearGradient>
    <filter id="consultFrame" x="-35%" y="-30%" width="170%" height="180%">
      <feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="#70473d" flood-opacity="0.2"/>
    </filter>
    <clipPath id="screen-consultFrame"><rect x="276" y="460" width="528" height="722" rx="36"/></clipPath>`;
  return svgDocument({ ...FEED, body, fonts, extraDefs });
}

const ICONS = {
  shop: [
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>',
    '<path d="M3 6h18"/>',
    '<path d="M16 10a4 4 0 0 1-8 0"/>',
  ],
  prices: [
    '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z"/>',
    '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none"/>',
  ],
  ask: [
    '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
    '<path d="M8 9h8M8 13h5"/>',
  ],
  concerns: [
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/>',
    '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>',
    '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>',
    '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    '<circle cx="11" cy="11" r="4"/>',
    '<path d="m16 16 3 3"/>',
  ],
  products: [
    '<path d="m21 8-9-5-9 5 9 5 9-5Z"/>',
    '<path d="m3 8 9 5 9-5"/>',
    '<path d="M3 8v8l9 5 9-5V8"/>',
    '<path d="M12 13v8"/>',
  ],
  stores: [
    '<path d="M3 9l2-5h14l2 5"/>',
    '<path d="M5 13v8h14v-8"/>',
    '<path d="M9 21v-6h6v6"/>',
    '<path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  ],
  faq: [
    '<circle cx="12" cy="12" r="10"/>',
    '<path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4"/>',
    '<path d="M12 18h.01"/>',
  ],
};

function highlightSvg({ fonts, label, icon, avatar }) {
  const isStart = label === "START";
  const iconMarkup = isStart
    ? `<g clip-path="url(#avatarCircle)"><image x="386" y="806" width="308" height="308" href="${avatar}" preserveAspectRatio="xMidYMid slice"/></g>
       <circle cx="540" cy="960" r="154" fill="none" stroke="#fff7f4" stroke-opacity="0.3" stroke-width="4"/>`
    : `<g transform="translate(386 806) scale(12.833)" fill="none" stroke="${PALETTE.porcelain}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" color="${PALETTE.porcelain}">${icon.join("")}</g>`;
  const body = `
    <rect width="1080" height="1920" fill="${PALETTE.black}"/>
    <rect width="1080" height="1920" fill="url(#coverGlow)"/>
    <circle cx="540" cy="960" r="340" fill="none" stroke="#ff9aa5" stroke-opacity="0.1" stroke-width="112"/>
    <circle cx="540" cy="960" r="250" fill="#171214" fill-opacity="0.72"/>
    ${iconMarkup}
    ${wordmark(540, 1520, PALETTE.porcelain, 26).replace('x="540"', 'x="540" text-anchor="middle"')}
  `;
  const extraDefs = `
    <radialGradient id="coverGlow" cx="72%" cy="26%" r="92%">
      <stop offset="0" stop-color="#67283f" stop-opacity="0.82"/>
      <stop offset="0.45" stop-color="#2b0e18" stop-opacity="0.54"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avatarCircle"><circle cx="540" cy="960" r="154"/></clipPath>`;
  return svgDocument({ ...STORY, body, fonts, extraDefs });
}

async function renderPng(svg, outputPath) {
  const png = await sharp(svg)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await fs.writeFile(outputPath, png);
  return { buffer: png, sha256: sha256(png) };
}

async function buildPreview(feedPaths, highlightPaths) {
  const fullTiles = await Promise.all(
    feedPaths.map((file) =>
      sharp(file)
        .resize(360, 450, { fit: "fill" })
        .png()
        .toBuffer(),
    ),
  );
  await sharp({
    create: {
      width: 1080,
      height: 450,
      channels: 4,
      background: PALETTE.cream,
    },
  })
    .composite(fullTiles.map((input, index) => ({ input, left: index * 360, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW, "pinned-row-full.png"));

  const squareTiles = await Promise.all(
    feedPaths.map((file) =>
      sharp(file)
        .resize(360, 360, { fit: "cover", position: "centre" })
        .png()
        .toBuffer(),
    ),
  );
  await sharp({
    create: {
      width: 1080,
      height: 360,
      channels: 4,
      background: PALETTE.cream,
    },
  })
    .composite(squareTiles.map((input, index) => ({ input, left: index * 360, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW, "pinned-row-square-crop.png"));

  const circles = await Promise.all(
    highlightPaths.map(async (file) => {
      const resized = await sharp(file)
        .resize(220, 220, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      const mask = Buffer.from(
        '<svg width="220" height="220"><circle cx="110" cy="110" r="108" fill="white"/></svg>',
      );
      return sharp(resized)
        .composite([{ input: mask, blend: "dest-in" }])
        .png()
        .toBuffer();
    }),
  );
  const circleComposites = circles.map((input, index) => ({
    input,
    left: 30 + (index % 4) * 290,
    top: 30 + Math.floor(index / 4) * 290,
  }));
  await sharp({
    create: {
      width: 1160,
      height: 580,
      channels: 4,
      background: PALETTE.paper,
    },
  })
    .composite(circleComposites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW, "highlight-circle-contact-sheet.png"));
}

async function main() {
  await Promise.all([
    fs.mkdir(FINAL, { recursive: true }),
    fs.mkdir(HIGHLIGHTS, { recursive: true }),
    fs.mkdir(PREVIEW, { recursive: true }),
  ]);

  const [manropeRegular, manropeSemibold, italiana] = await Promise.all(
    Object.values(FONT_FILES).map((file) => fs.readFile(file)),
  );
  const fonts = {
    manropeRegular: manropeRegular.toString("base64"),
    manropeSemibold: manropeSemibold.toString("base64"),
    italiana: italiana.toString("base64"),
  };

  const assetEntries = await Promise.all(
    Object.entries(SOURCE_FILES).map(async ([key, file]) => {
      const buffer = await fs.readFile(path.join(SOURCE, file));
      return [key, `data:image/png;base64,${buffer.toString("base64")}`];
    }),
  );
  const assets = Object.fromEntries(assetEntries);

  const feedSpecs = [
    ["01-start-here-feed.png", startPost({ fonts, assets })],
    ["02-compare-order-feed.png", comparePost({ fonts, assets })],
    ["03-ask-jelocare-feed.png", consultPost({ fonts, assets })],
  ];
  const feedResults = [];
  for (const [name, svg] of feedSpecs) {
    const outputPath = path.join(FINAL, name);
    const result = await renderPng(svg, outputPath);
    feedResults.push({ name, outputPath, ...result });
  }

  const highlightSpecs = [
    ["01-start.png", "START", []],
    ["02-shop.png", "SHOP", ICONS.shop],
    ["03-prices.png", "PRICES", ICONS.prices],
    ["04-ask.png", "ASK", ICONS.ask],
    ["05-concerns.png", "CONCERNS", ICONS.concerns],
    ["06-products.png", "PRODUCTS", ICONS.products],
    ["07-stores.png", "STORES", ICONS.stores],
    ["08-faq.png", "FAQ", ICONS.faq],
  ];
  const highlightResults = [];
  for (const [name, label, icon] of highlightSpecs) {
    const outputPath = path.join(HIGHLIGHTS, name);
    const result = await renderPng(
      highlightSvg({ fonts, label, icon, avatar: assets.avatar }),
      outputPath,
    );
    highlightResults.push({ name, label, outputPath, ...result });
  }

  await buildPreview(
    feedResults.map(({ outputPath }) => outputPath),
    highlightResults.map(({ outputPath }) => outputPath),
  );

  const createdAt = new Date().toISOString();
  const sourceAssets = await Promise.all(
    Object.values(SOURCE_FILES).map(async (file) => ({
      path: `source/${file}`,
      sha256: await sha256File(path.join(SOURCE, file)),
    })),
  );
  const previewFiles = [
    "pinned-row-full.png",
    "pinned-row-square-crop.png",
    "highlight-circle-contact-sheet.png",
  ];
  const previewResults = await Promise.all(
    previewFiles.map(async (file) => ({
      path: `preview/${file}`,
      sha256: await sha256File(path.join(PREVIEW, file)),
    })),
  );

  const copy = {
    start: {
      visibleHeadline: "Products. Prices. Clear context.",
      visibleSupport: "For Nigerian skincare shoppers.",
      caption:
        "Products, listed prices, and clear care context for Nigerian skincare shoppers.\n\nStart here: https://www.jelocare.com",
    },
    compareOrder: {
      visibleHeadline: "One basket. One clear quote.",
      visibleSupport: "Choose products. See real one-retailer baskets.",
      caption:
        "Choose 2–4 products. See the real one-retailer baskets available, then request one verified quote.\n\nNo payment is taken when you request a quote.\n\nBuild a basket: https://www.jelocare.com/bundle",
    },
    ask: {
      visibleHeadline: "Tell us what you notice.",
      visibleSupport: "A sourced care guide—not a diagnosis.",
      caption:
        "Describe what you notice in your own words. JeloCare helps you build a sourced care guide—not a diagnosis.\n\nAsk JeloCare: https://www.jelocare.com/consult\n\nUrgent or worsening symptoms need in-person care.",
    },
    highlightTitles: [
      "START",
      "SHOP",
      "PRICES",
      "ASK",
      "CONCERNS",
      "PRODUCTS",
      "STORES",
      "FAQ",
    ],
  };
  const captions = `# Instagram foundation captions\n\n## Pin 1 — Start here\n\n${copy.start.caption}\n\n## Pin 2 — Compare + order\n\n${copy.compareOrder.caption}\n\n## Pin 3 — Ask JeloCare\n\n${copy.ask.caption}\n\n## Highlight titles\n\n${copy.highlightTitles.join(" · ")}\n\n## Publication state\n\nApproved for publication on 2026-08-25. Publication identifiers are recorded only after each external action succeeds.\n`;
  const captionHash = sha256(Buffer.from(captions));

  const campaign = {
    schemaVersion: 1,
    campaignId: CAMPAIGN_ID,
    status: "approved",
    approvedAt: APPROVED_AT,
    createdAt,
    dataCheckedAt: createdAt,
    objective:
      "Give @usejelocare a credible, attractive Instagram front door through three evergreen pinned posts and a coherent Highlight cover system.",
    sourceTruth: {
      repositoryCommit: "afd643af78d8ab053943738c13d4af56695114cc",
      interfaceEvidence:
        "Current public JeloCare /bundle and /consult surfaces captured on 2026-08-25 at a 430 × 947 CSS-pixel mobile viewport and 2× device scale. Captures contain no browser chrome, private customer data, form submission, order, payment, email, or WhatsApp send.",
      catalogueEvidence:
        "The start post uses released, dossier-backed 2000 × 2000 product packshots for CeraVe Foaming Facial Cleanser, DANG! Lifestyle Azelaic Acid Serum, and La Roche-Posay Anthelios UVMune 400 Oil Control Fluid SPF50+.",
      visualSystem:
        "Deterministic Sharp/SVG compositions using JeloCare's embedded Italiana and Manrope fonts, canonical warm palette, real UI captures, and exact released product assets. No generated people, stock model, fake social chrome, fake badge, or price claim.",
    },
    sourceAssets,
    products: [
      {
        slug: "cerave-foaming-facial-cleanser",
        brand: "CeraVe",
        name: "Foaming Facial Cleanser",
        size: "236 ml",
        sourcePath: `source/${SOURCE_FILES.cerave}`,
        rights: "campaign-ready catalogue publication dossier",
      },
      {
        slug: "dang-azelaic-acid-serum-30ml",
        brand: "DANG! Lifestyle",
        name: "Azelaic Acid Serum",
        size: "30 ml",
        sourcePath: `source/${SOURCE_FILES.dang}`,
        rights: "campaign-ready catalogue publication dossier",
      },
      {
        slug: "la-roche-posay-anthelios-uvmune-400-oil-control-fluid",
        brand: "La Roche-Posay",
        name: "Anthelios UVMune 400 Oil Control Fluid SPF50+",
        size: "50 ml",
        sourcePath: `source/${SOURCE_FILES.laroche}`,
        rights: "campaign-ready catalogue publication dossier",
      },
    ],
    offerEvidence: [],
    careBoundary:
      "Evergreen product discovery, comparison workflow, and sourced care guidance only. No price, saving, stock, authenticity, suitability, diagnosis, treatment or outcome claim.",
    copy,
    captionAsset: {
      path: "CAPTIONS.md",
      sha256: captionHash,
    },
    creative: [
      ...feedResults.map(({ name, sha256: hash }) => ({
        kind: "instagram-feed",
        path: `final/${name}`,
        width: FEED.width,
        height: FEED.height,
        sha256: hash,
        generationRoute:
          "deterministic-sharp-svg-with-exact-brand-assets-and-real-site-surfaces",
      })),
      ...highlightResults.map(({ name, label, sha256: hash }) => ({
        kind: "instagram-highlight-cover",
        label,
        path: `final/highlights/${name}`,
        width: STORY.width,
        height: STORY.height,
        sha256: hash,
        generationRoute:
          "deterministic-sharp-svg-with-canonical-jelocare-identity-and-service-icons",
      })),
    ],
    previews: previewResults,
    channels: ["instagram-feed", "instagram-stories"],
    publication: [],
  };

  const checksumLines = [
    ...feedResults.map(
      ({ name, sha256: hash }) => `${hash}  final/${name}`,
    ),
    ...highlightResults.map(
      ({ name, sha256: hash }) => `${hash}  final/highlights/${name}`,
    ),
    ...sourceAssets.map(({ path: sourcePath, sha256: hash }) =>
      `${hash}  ${sourcePath}`,
    ),
    ...previewResults.map(({ path: previewPath, sha256: hash }) =>
      `${hash}  ${previewPath}`,
    ),
    `${captionHash}  CAPTIONS.md`,
  ];

  await Promise.all([
    fs.writeFile(
      path.join(HERE, "campaign.json"),
      `${JSON.stringify(campaign, null, 2)}\n`,
    ),
    fs.writeFile(path.join(HERE, "CAPTIONS.md"), captions),
    fs.writeFile(path.join(HERE, "SHA256SUMS"), `${checksumLines.join("\n")}\n`),
  ]);
}

await main();
