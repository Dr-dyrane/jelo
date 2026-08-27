import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const outputPath = path.join(root, "final", "gt-water-resistant-spf-scorecard.png");

const width = 1080;
const height = 1350;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="heat" cx="50%" cy="20%" r="82%">
      <stop offset="0" stop-color="#ff8a67"/>
      <stop offset="0.48" stop-color="#d64849"/>
      <stop offset="1" stop-color="#6f1632"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.08"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#350817" flood-opacity="0.32"/>
    </filter>
  </defs>

  <rect width="1080" height="1350" fill="url(#heat)"/>
  <circle cx="860" cy="205" r="270" fill="#ffbb72" opacity="0.12"/>
  <circle cx="160" cy="1120" r="330" fill="#2b0618" opacity="0.18"/>

  <text x="90" y="112" font-family="Helvetica Neue, Arial, sans-serif" font-size="38" font-weight="700" fill="#fff">JeloCare</text>

  <text x="540" y="254" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="750" letter-spacing="5" fill="#ffd8d0">FULL TIME</text>

  <g filter="url(#shadow)">
    <rect x="90" y="310" width="900" height="410" rx="48" fill="#230612" fill-opacity="0.76" stroke="#ffffff" stroke-opacity="0.15"/>
  </g>

  <g font-family="Helvetica Neue, Arial, sans-serif" fill="#fff" text-anchor="middle">
    <text x="320" y="433" font-size="36" font-weight="800" letter-spacing="3">GT</text>
    <text x="760" y="433" font-size="36" font-weight="800" letter-spacing="3">ROUTINE</text>
    <text x="320" y="625" font-size="190" font-weight="800">1</text>
    <text x="540" y="612" font-size="78" font-weight="500" fill="#ffb0a1">—</text>
    <text x="760" y="625" font-size="190" font-weight="800" fill="#ffb0a1">0</text>
  </g>

  <text x="540" y="820" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="650" fill="#ffe8e2">Rematch?</text>

  <g filter="url(#shadow)">
    <rect x="125" y="865" width="830" height="230" rx="44" fill="url(#glass)" stroke="#fff" stroke-opacity="0.25"/>
  </g>
  <text x="540" y="968" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="31" font-weight="700" letter-spacing="4" fill="#ffe0d9">YOUR LAST STEP</text>
  <text x="540" y="1044" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="53" font-weight="800" letter-spacing="0.5" fill="#fff">WATER-RESISTANT SPF</text>

  <text x="540" y="1200" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="550" fill="#ffd8d0">Reapply after sweating.</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
