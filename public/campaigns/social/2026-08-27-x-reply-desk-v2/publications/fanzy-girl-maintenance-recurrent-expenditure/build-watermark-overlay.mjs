#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REQUIRED_SHARP_VERSION = "0.35.3";
const WIDTH = 1080;
const HEIGHT = 1920;
const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../../../../../..");
const outputPath = path.join(directory, "watermark-overlay.png");

if (sharp.versions.sharp !== REQUIRED_SHARP_VERSION) {
  throw new Error(
    `Sharp ${REQUIRED_SHARP_VERSION} is required; resolved ${sharp.versions.sharp}`,
  );
}

const [regularFont, semiboldFont] = await Promise.all([
  readFile(path.join(repositoryRoot, "app/(site)/share/[slug]/_og/manrope-400.ttf")),
  readFile(path.join(repositoryRoot, "app/(site)/share/[slug]/_og/manrope-600.ttf")),
]);

const svg = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <style>
      @font-face {
        font-family: "JeloCare Manrope";
        src: url("data:font/ttf;base64,${regularFont.toString("base64")}");
        font-weight: 400;
      }
      @font-face {
        font-family: "JeloCare Manrope";
        src: url("data:font/ttf;base64,${semiboldFont.toString("base64")}");
        font-weight: 600;
      }
      .mark {
        font-family: "JeloCare Manrope", sans-serif;
        fill: #fffaf4;
        paint-order: stroke;
        stroke: #090909;
        stroke-width: 2px;
        stroke-linejoin: round;
      }
    </style>
    <text
      x="174"
      y="1586"
      class="mark"
      font-size="26"
      font-weight="600"
      opacity="0.66"
    >@jelocare</text>
    <text
      x="906"
      y="292"
      class="mark"
      font-size="14"
      font-weight="600"
      text-anchor="end"
      opacity="0.46"
    >LT·003</text>
  </svg>
`);

const overlay = await sharp(svg).png({ compressionLevel: 9 }).toBuffer();
await writeFile(outputPath, overlay);

console.log(
  JSON.stringify(
    {
      sharpVersion: sharp.versions.sharp,
      output: path.basename(outputPath),
      width: WIDTH,
      height: HEIGHT,
      marks: ["@jelocare", "LT·003"],
    },
    null,
    2,
  ),
);
