#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RENDERER_ID = "jelocare-reply-thread-clip/v1";

function fail(message) {
  throw new Error(`${RENDERER_ID}: ${message}`);
}

function requireInteger(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${label} must be an integer >= ${minimum}`);
  }
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function resolveFrom(baseDirectory, value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty path string`);
  }
  return path.resolve(baseDirectory, value);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readPosition(layer, label) {
  const position = requireObject(layer.position, `${label}.position`);
  return {
    left: requireInteger(position.left, `${label}.position.left`),
    top: requireInteger(position.top, `${label}.position.top`),
  };
}

function readResize(layer, label) {
  const resize = requireObject(layer.resize, `${label}.resize`);
  return {
    width: requireInteger(resize.width, `${label}.resize.width`, {
      minimum: 1,
    }),
    height: requireInteger(resize.height, `${label}.resize.height`, {
      minimum: 1,
    }),
    fit: resize.fit ?? "fill",
    position: resize.position,
  };
}

async function applyRoundedMask(buffer, width, height, radius) {
  if (!radius) return buffer;
  requireInteger(radius, "layer.radius", { minimum: 1 });
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="white"/></svg>`,
  );
  return sharp(buffer)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function renderRasterLayer(layer, baseDirectory, label, page) {
  const sourcePath = resolveFrom(baseDirectory, layer.path, `${label}.path`);
  const resize = readResize(layer, label);
  let pipeline =
    page === undefined
      ? sharp(sourcePath)
      : sharp(sourcePath, { page, pages: 1 });

  if (layer.kind === "crop") {
    const extract = requireObject(layer.extract, `${label}.extract`);
    pipeline = pipeline.extract({
      left: requireInteger(extract.left, `${label}.extract.left`),
      top: requireInteger(extract.top, `${label}.extract.top`),
      width: requireInteger(extract.width, `${label}.extract.width`, {
        minimum: 1,
      }),
      height: requireInteger(extract.height, `${label}.extract.height`, {
        minimum: 1,
      }),
    });
  }

  const resizeOptions = { fit: resize.fit };
  if (resize.position !== undefined) resizeOptions.position = resize.position;
  const raster = await pipeline
    .resize(resize.width, resize.height, resizeOptions)
    .png()
    .toBuffer();
  return applyRoundedMask(
    raster,
    resize.width,
    resize.height,
    layer.radius ?? 0,
  );
}

async function prepareLayer(layer, index, baseDirectory) {
  const label = `layers[${index}]`;
  const position = readPosition(layer, label);

  if (layer.kind === "svg") {
    if (typeof layer.svg !== "string" || layer.svg.length === 0) {
      fail(`${label}.svg must be a non-empty string`);
    }
    return { position, staticInput: Buffer.from(layer.svg) };
  }

  if (layer.kind === "crop" || layer.kind === "image") {
    return {
      position,
      staticInput: await renderRasterLayer(layer, baseDirectory, label),
    };
  }

  if (layer.kind === "animated-image") {
    const sourcePath = resolveFrom(baseDirectory, layer.path, `${label}.path`);
    const metadata = await sharp(sourcePath, { animated: true }).metadata();
    const frameCount = metadata.pages ?? 1;
    const delays = Array.isArray(metadata.delay)
      ? metadata.delay
      : Array(frameCount).fill(metadata.delay ?? null);
    return {
      position,
      animation: { frameCount, delays },
      frameInput: (page) =>
        renderRasterLayer(layer, baseDirectory, label, page),
    };
  }

  fail(`${label}.kind must be svg, crop, image, or animated-image`);
}

function verifyExpectedHash(output, actualHash, label) {
  if (!output.sha256) fail(`${label}.sha256 is required in --check mode`);
  if (output.sha256 !== actualHash) {
    fail(
      `${label} hash mismatch: expected ${output.sha256}, got ${actualHash}`,
    );
  }
}

export async function renderReplyThreadClip(
  configPath,
  { checkOnly = false } = {},
) {
  const absoluteConfigPath = path.resolve(configPath);
  const baseDirectory = path.dirname(absoluteConfigPath);
  const config = JSON.parse(await readFile(absoluteConfigPath, "utf8"));

  if (config.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (config.renderer !== RENDERER_ID) {
    fail(`renderer must be ${RENDERER_ID}`);
  }

  const requiredSharpVersion = config.engine?.sharpVersion;
  if (!requiredSharpVersion) fail("engine.sharpVersion is required");
  if (sharp.versions.sharp !== requiredSharpVersion) {
    fail(
      `Sharp ${requiredSharpVersion} is required; resolved ${sharp.versions.sharp}. Run npm ci in the repository before rendering.`,
    );
  }

  const canvas = requireObject(config.canvas, "canvas");
  const width = requireInteger(canvas.width, "canvas.width", { minimum: 1 });
  const height = requireInteger(canvas.height, "canvas.height", { minimum: 1 });
  const background = canvas.background ?? {
    r: 0,
    g: 0,
    b: 0,
    alpha: 1,
  };

  if (!Array.isArray(config.layers) || config.layers.length === 0) {
    fail("layers must be a non-empty array");
  }
  const preparedLayers = [];
  for (const [index, layer] of config.layers.entries()) {
    preparedLayers.push(await prepareLayer(layer, index, baseDirectory));
  }

  const animatedLayers = preparedLayers.filter((layer) => layer.animation);
  if (animatedLayers.length > 1) {
    fail("v1 supports at most one animated-image layer");
  }
  const animationLayer = animatedLayers[0];
  const frameCount = animationLayer?.animation.frameCount ?? 1;
  const fallbackDelayMs = config.animation?.fallbackDelayMs ?? 900;
  const delays = animationLayer
    ? animationLayer.animation.delays.map((delay) => delay ?? fallbackDelayMs)
    : [fallbackDelayMs];

  const frames = [];
  for (let page = 0; page < frameCount; page += 1) {
    const composites = [];
    for (const layer of preparedLayers) {
      composites.push({
        input: layer.staticInput ?? (await layer.frameInput(page)),
        ...layer.position,
      });
    }
    frames.push(
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background,
        },
      })
        .composite(composites)
        .raw()
        .toBuffer(),
    );
  }

  const outputs = requireObject(config.outputs, "outputs");
  const result = {
    renderer: RENDERER_ID,
    sharpVersion: sharp.versions.sharp,
    frameCount,
    delays,
    outputs: {},
  };

  if (outputs.poster) {
    const posterBuffer = await sharp(frames[0], {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();
    const posterHash = sha256(posterBuffer);
    const posterPath = resolveFrom(
      baseDirectory,
      outputs.poster.path,
      "outputs.poster.path",
    );
    result.outputs.poster = {
      path: posterPath,
      width,
      height,
      sha256: posterHash,
    };
    if (checkOnly) {
      verifyExpectedHash(outputs.poster, posterHash, "outputs.poster");
    } else {
      await mkdir(path.dirname(posterPath), { recursive: true });
      await writeFile(posterPath, posterBuffer);
    }
  }

  if (outputs.gif) {
    const animation = config.animation ?? {};
    const gifBuffer = await sharp(Buffer.concat(frames), {
      raw: {
        width,
        height: height * frameCount,
        channels: 4,
        pageHeight: height,
      },
    })
      .gif({
        loop: animation.loop ?? 0,
        delay: delays,
        colours: animation.colours ?? 256,
        effort: animation.effort ?? 7,
        dither: animation.dither ?? 0.6,
      })
      .toBuffer();
    const gifHash = sha256(gifBuffer);
    const gifPath = resolveFrom(
      baseDirectory,
      outputs.gif.path,
      "outputs.gif.path",
    );
    result.outputs.gif = {
      path: gifPath,
      width,
      height,
      sha256: gifHash,
    };
    if (checkOnly) {
      verifyExpectedHash(outputs.gif, gifHash, "outputs.gif");
    } else {
      await mkdir(path.dirname(gifPath), { recursive: true });
      await writeFile(gifPath, gifBuffer);
    }
  }

  if (!outputs.poster && !outputs.gif) {
    fail("outputs must declare poster and/or gif");
  }

  return result;
}

const isCli =
  process.argv[1] &&
  realpathSync(path.resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url));

if (isCli) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const configPath = args.find((arg) => !arg.startsWith("--"));
  if (!configPath) {
    console.error(`Usage: node ${process.argv[1]} <config.json> [--check]`);
    process.exitCode = 2;
  } else {
    try {
      console.log(
        JSON.stringify(
          await renderReplyThreadClip(configPath, { checkOnly }),
          null,
          2,
        ),
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
