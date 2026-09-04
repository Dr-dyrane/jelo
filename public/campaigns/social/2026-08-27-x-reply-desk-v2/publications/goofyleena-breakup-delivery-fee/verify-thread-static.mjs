#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const configPath = path.resolve(
  process.argv[2] ?? new URL("./reply-thread-clip.json", import.meta.url).pathname,
);
const directory = path.dirname(configPath);
const config = JSON.parse(await readFile(configPath, "utf8"));

assert.equal(config.renderer, "jelocare-reply-thread-clip/v1");
assert.equal(sharp.versions.sharp, config.engine.sharpVersion);

const animatedLayers = config.layers.filter(
  (layer) => layer.kind === "animated-image",
);
assert.equal(animatedLayers.length, 1, "exactly one animated layer is required");
const animatedLayer = animatedLayers[0];
const mediaRect = {
  left: animatedLayer.position.left,
  top: animatedLayer.position.top,
  width: animatedLayer.resize.width,
  height: animatedLayer.resize.height,
};
const protectedStaticRects = config.layers
  .filter((layer) => ["native-gif-pill", "native-alt-pill"].includes(layer.id))
  .map((layer) => ({
    id: layer.id,
    left: layer.position.left,
    top: layer.position.top,
    width: layer.resize.width,
    height: layer.resize.height,
  }));

const sourcePath = path.resolve(directory, animatedLayer.path);
const gifPath = path.resolve(directory, config.outputs.gif.path);
const posterPath = path.resolve(directory, config.outputs.poster.path);
const sourceMetadata = await sharp(sourcePath, { animated: true }).metadata();
const gifMetadata = await sharp(gifPath, { animated: true }).metadata();
const posterMetadata = await sharp(posterPath).metadata();
const expectedDelays = Array.isArray(sourceMetadata.delay)
  ? sourceMetadata.delay
  : Array(sourceMetadata.pages ?? 1).fill(
      sourceMetadata.delay ?? config.animation.fallbackDelayMs,
    );

assert.equal(gifMetadata.width, config.canvas.width);
assert.equal(gifMetadata.pageHeight, config.canvas.height);
assert.equal(gifMetadata.pages, sourceMetadata.pages);
assert.equal(gifMetadata.loop, 0);
assert.deepEqual(gifMetadata.delay, expectedDelays);
assert.equal(posterMetadata.width, config.canvas.width);
assert.equal(posterMetadata.height, config.canvas.height);

const frames = [];
for (let page = 0; page < gifMetadata.pages; page += 1) {
  const { data, info } = await sharp(gifPath, { page, pages: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, config.canvas.width);
  assert.equal(info.height, config.canvas.height);
  assert.equal(info.channels, 4);
  frames.push(data);
}

const baseline = frames[0];
let insideChangedPixels = 0;
let outsideChangedPixels = 0;
let protectedChangedPixels = 0;
for (let page = 1; page < frames.length; page += 1) {
  const frame = frames[page];
  for (let y = 0; y < config.canvas.height; y += 1) {
    for (let x = 0; x < config.canvas.width; x += 1) {
      const offset = (y * config.canvas.width + x) * 4;
      const changed =
        baseline[offset] !== frame[offset] ||
        baseline[offset + 1] !== frame[offset + 1] ||
        baseline[offset + 2] !== frame[offset + 2] ||
        baseline[offset + 3] !== frame[offset + 3];
      if (!changed) continue;
      const inside =
        x >= mediaRect.left &&
        x < mediaRect.left + mediaRect.width &&
        y >= mediaRect.top &&
        y < mediaRect.top + mediaRect.height;
      const protectedStatic = protectedStaticRects.some(
        (rect) =>
          x >= rect.left &&
          x < rect.left + rect.width &&
          y >= rect.top &&
          y < rect.top + rect.height,
      );
      if (protectedStatic) protectedChangedPixels += 1;
      if (inside) insideChangedPixels += 1;
      else outsideChangedPixels += 1;
    }
  }
}

assert.equal(
  outsideChangedPixels,
  0,
  "thread pixels outside the media panel must remain static",
);
assert.ok(insideChangedPixels > 0, "the media panel must visibly animate");
assert.equal(
  protectedChangedPixels,
  0,
  "native GIF and ALT pills must remain static over the moving panel",
);

console.log(
  JSON.stringify(
    {
      verifier: "jelocare-thread-static/v1",
      sharpVersion: sharp.versions.sharp,
      canvas: config.canvas,
      mediaRect,
      protectedStaticRects,
      frames: frames.length,
      delays: gifMetadata.delay,
      loop: gifMetadata.loop,
      insideChangedPixels,
      outsideChangedPixels,
      protectedChangedPixels,
    },
    null,
    2,
  ),
);
