import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const outputPath = path.join(root, "final", "hot-day-water-resistant-spf-guide.png");

const width = 1080;
const height = 1350;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff7f2"/>
      <stop offset="1" stop-color="#f6d4d5"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ff8a5b" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#ff8a5b" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#742039" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect width="1080" height="1350" fill="url(#field)"/>
  <circle cx="850" cy="235" r="330" fill="url(#sun)"/>

  <text x="90" y="112" font-family="Helvetica Neue, Arial, sans-serif" font-size="38" font-weight="700" fill="#1d1316">JeloCare</text>

  <text x="90" y="294" font-family="Helvetica Neue, Arial, sans-serif" font-size="28" font-weight="750" letter-spacing="4" fill="#8c3450">FOR HOT, SWEATY DAYS</text>
  <text x="90" y="420" font-family="Helvetica Neue, Arial, sans-serif" font-size="72" font-weight="720" letter-spacing="-2.4" fill="#211518">Choose a</text>
  <text x="90" y="510" font-family="Helvetica Neue, Arial, sans-serif" font-size="72" font-weight="720" letter-spacing="-2.4" fill="#211518">water-resistant</text>
  <text x="90" y="600" font-family="Helvetica Neue, Arial, sans-serif" font-size="72" font-weight="720" letter-spacing="-2.4" fill="#211518">sunscreen.</text>

  <g filter="url(#softShadow)">
    <rect x="90" y="730" width="900" height="330" rx="54" fill="#ffffff" fill-opacity="0.78" stroke="#8c3450" stroke-opacity="0.14"/>
  </g>

  <g transform="translate(172 815)">
    <path d="M70 0 C70 0 0 82 0 136 C0 178 31 208 70 208 C109 208 140 178 140 136 C140 82 70 0 70 0 Z" fill="#8c3450"/>
    <path d="M55 146 C63 166 80 174 100 168" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity="0.82"/>
  </g>

  <text x="390" y="872" font-family="Helvetica Neue, Arial, sans-serif" font-size="25" font-weight="750" letter-spacing="2.7" fill="#8c3450">LOOK FOR THE WORDS</text>
  <text x="390" y="949" font-family="Helvetica Neue, Arial, sans-serif" font-size="47" font-weight="750" fill="#211518">“Water resistant”</text>
  <text x="390" y="1000" font-family="Helvetica Neue, Arial, sans-serif" font-size="24" fill="#6a5058">on the product label.</text>

  <text x="90" y="1190" font-family="Helvetica Neue, Arial, sans-serif" font-size="27" font-weight="600" fill="#4d363d">Reapply after sweating.</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
