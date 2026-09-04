#!/usr/bin/env python3
"""Render a portable JeloCare Zapshot from literal crops and one media panel.

The script uses only Python's standard library plus an FFmpeg executable. It
prefers a system FFmpeg and falls back to the optional imageio-ffmpeg package.
All recipe paths must be relative to the recipe directory and may not escape it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


RENDERER = "jelocare-portable-zapshot/1"


class RecipeError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise RecipeError(message)


def require_dict(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        fail(f"{label} must be an object")
    return value


def require_list(value: Any, label: str) -> List[Any]:
    if not isinstance(value, list):
        fail(f"{label} must be an array")
    return value


def positive_number(value: Any, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
        fail(f"{label} must be a positive number")
    return float(value)


def nonnegative_number(value: Any, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
        fail(f"{label} must be a non-negative number")
    return float(value)


def integer(value: Any, label: str, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        fail(f"{label} must be an integer >= {minimum}")
    return value


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_path(base: Path, value: Any, label: str, must_exist: bool = True) -> Path:
    if not isinstance(value, str) or not value.strip():
        fail(f"{label} must be a non-empty relative path")
    candidate = Path(value)
    if candidate.is_absolute():
        fail(f"{label} must be relative, not absolute")
    resolved = (base / candidate).resolve()
    try:
        resolved.relative_to(base.resolve())
    except ValueError:
        fail(f"{label} may not escape the recipe directory")
    if must_exist and not resolved.is_file():
        fail(f"{label} does not exist: {value}")
    return resolved


def find_ffmpeg(explicit: Optional[str] = None) -> str:
    candidates: List[Optional[str]] = [explicit, os.environ.get("FFMPEG_BINARY"), shutil.which("ffmpeg")]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
        if candidate and shutil.which(candidate):
            return str(Path(shutil.which(candidate) or candidate).resolve())
    try:
        import imageio_ffmpeg  # type: ignore

        candidate = imageio_ffmpeg.get_ffmpeg_exe()
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    except Exception:
        pass
    fail("FFmpeg was not found. Install ffmpeg or `pip install imageio-ffmpeg`.")
    return ""


def run(command: List[str], label: str, capture_stdout: bool = False) -> bytes:
    result = subprocess.run(
        command,
        check=False,
        stdout=subprocess.PIPE if capture_stdout else subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-5000:]
        fail(f"{label} failed with exit {result.returncode}:\n{stderr}")
    return result.stdout if capture_stdout else b""


def source_has_audio(ffmpeg: str, path: Path) -> bool:
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(path), "-t", "0", "-f", "null", "-"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    return "Audio:" in result.stderr.decode("utf-8", errors="replace")


def dimensions(block: Any, label: str) -> Tuple[int, int]:
    value = require_dict(block, label)
    return integer(value.get("width"), f"{label}.width", 1), integer(
        value.get("height"), f"{label}.height", 1
    )


def position(block: Any, label: str) -> Tuple[int, int]:
    value = require_dict(block, label)
    return integer(value.get("left"), f"{label}.left"), integer(
        value.get("top"), f"{label}.top"
    )


def write_rounded_mask(path: Path, width: int, height: int, radius: int) -> None:
    radius = min(radius, width // 2, height // 2)
    pixels = bytearray()
    for y in range(height):
        row = bytearray(width)
        if radius == 0 or radius <= y < height - radius:
            row[:] = b"\xff" * width
        else:
            cy = radius - 0.5 if y < radius else height - radius - 0.5
            dy = abs((y + 0.5) - cy)
            reach = math.sqrt(max(0.0, radius * radius - dy * dy))
            left = max(0, int(math.floor(radius - reach)))
            right = min(width, int(math.ceil(width - radius + reach)))
            row[left:right] = b"\xff" * (right - left)
        pixels.extend(row)
    path.write_bytes(f"P5\n{width} {height}\n255\n".encode("ascii") + bytes(pixels))


def drawtext_escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace(":", "\\:")
        .replace("%", "\\%")
    )


def validate_recipe(recipe: Dict[str, Any], base: Path) -> Dict[str, Any]:
    if recipe.get("schemaVersion") != 1:
        fail("schemaVersion must be 1")
    if recipe.get("renderer") != RENDERER:
        fail(f"renderer must be {RENDERER}")

    canvas = require_dict(recipe.get("canvas"), "canvas")
    width = integer(canvas.get("width"), "canvas.width", 1)
    height = integer(canvas.get("height"), "canvas.height", 1)
    fps = integer(canvas.get("fps"), "canvas.fps", 1)
    duration = positive_number(canvas.get("durationSeconds"), "canvas.durationSeconds")
    background = canvas.get("background", "black")
    if not isinstance(background, str) or not background:
        fail("canvas.background must be a colour string")

    layers = require_list(recipe.get("layers"), "layers")
    if not layers:
        fail("layers may not be empty")
    seen_ids = set()
    media_count = 0
    normalized_layers: List[Dict[str, Any]] = []
    for index, raw in enumerate(layers):
        layer = require_dict(raw, f"layers[{index}]")
        layer_id = layer.get("id")
        if not isinstance(layer_id, str) or not layer_id:
            fail(f"layers[{index}].id must be a non-empty string")
        if layer_id in seen_ids:
            fail(f"duplicate layer id: {layer_id}")
        seen_ids.add(layer_id)
        kind = layer.get("kind")
        if kind not in {"crop", "image", "media"}:
            fail(f"layers[{index}].kind must be crop, image, or media")
        path = safe_path(base, layer.get("path"), f"layers[{index}].path")
        out_width, out_height = dimensions(layer.get("resize"), f"layers[{index}].resize")
        left, top = position(layer.get("position"), f"layers[{index}].position")
        if left + out_width > width or top + out_height > height:
            fail(f"layers[{index}] exceeds the canvas")
        radius = integer(layer.get("radius", 0), f"layers[{index}].radius")
        crop = None
        if kind == "crop":
            crop_block = require_dict(layer.get("crop"), f"layers[{index}].crop")
            crop = {
                "left": integer(crop_block.get("left"), f"layers[{index}].crop.left"),
                "top": integer(crop_block.get("top"), f"layers[{index}].crop.top"),
                "width": integer(crop_block.get("width"), f"layers[{index}].crop.width", 1),
                "height": integer(crop_block.get("height"), f"layers[{index}].crop.height", 1),
            }
        if kind == "media":
            media_count += 1
            if media_count > 1:
                fail("v1 supports at most one media layer")
            fit = layer.get("fit", "contain")
            if fit not in {"contain", "cover", "fill"}:
                fail(f"layers[{index}].fit must be contain, cover, or fill")
            audio_mode = layer.get("audio", "preserve-if-present")
            if audio_mode not in {"preserve-if-present", "required", "silent"}:
                fail(
                    f"layers[{index}].audio must be preserve-if-present, required, or silent"
                )
            start_seconds = nonnegative_number(
                layer.get("startSeconds", 0), f"layers[{index}].startSeconds"
            )
        else:
            fit = "fill"
            audio_mode = "silent"
            start_seconds = 0.0
        normalized_layers.append(
            {
                "id": layer_id,
                "kind": kind,
                "path": path,
                "crop": crop,
                "width": out_width,
                "height": out_height,
                "left": left,
                "top": top,
                "radius": radius,
                "fit": fit,
                "audio": audio_mode,
                "startSeconds": start_seconds,
            }
        )

    outputs = require_dict(recipe.get("outputs"), "outputs")
    output_directory = safe_path(
        base, outputs.get("directory", "output"), "outputs.directory", must_exist=False
    )
    basename = outputs.get("basename")
    if not isinstance(basename, str) or not basename or any(char in basename for char in "/\\"):
        fail("outputs.basename must be a plain non-empty filename stem")
    gif_fallback = outputs.get("gifFallback", False)
    if not isinstance(gif_fallback, bool):
        fail("outputs.gifFallback must be boolean")

    qa = require_dict(recipe.get("qa", {}), "qa")
    poster_time = nonnegative_number(qa.get("posterTimeSeconds", 0), "qa.posterTimeSeconds")
    times = require_list(qa.get("compareFrameTimesSeconds", [0, duration / 2]), "qa.compareFrameTimesSeconds")
    if len(times) != 2:
        fail("qa.compareFrameTimesSeconds must contain exactly two times")
    compare_times = [nonnegative_number(value, f"qa.compareFrameTimesSeconds[{index}]") for index, value in enumerate(times)]
    if max(compare_times + [poster_time]) >= duration:
        fail("QA frame times must be less than canvas.durationSeconds")
    static_threshold = integer(
        qa.get("maximumDecodedStaticChannelDelta", 20),
        "qa.maximumDecodedStaticChannelDelta",
    )
    phone_width = integer(qa.get("phoneProofWidth", 390), "qa.phoneProofWidth", 1)

    audio = require_dict(recipe.get("audio", {}), "audio")
    global_audio_mode = audio.get("mode", "preserve-if-present")
    if global_audio_mode not in {"preserve-if-present", "required", "silent"}:
        fail("audio.mode must be preserve-if-present, required, or silent")
    gain_db = float(audio.get("gainDb", 0))
    if gain_db < -30 or gain_db > 12:
        fail("audio.gainDb must be between -30 and 12")

    rights = require_dict(recipe.get("rights", {}), "rights")
    rights_state = rights.get("state", "unknown")
    if rights_state not in {"owned", "licensed", "platform-native-only", "unknown"}:
        fail("rights.state must be owned, licensed, platform-native-only, or unknown")
    rights_scope = rights.get("scope", "local-private-unpublished")
    if rights_scope not in {
        "local-private-unpublished",
        "platform-native-only",
        "public-channel-authorized",
    }:
        fail(
            "rights.scope must be local-private-unpublished, platform-native-only, "
            "or public-channel-authorized"
        )
    authorized_channels = rights.get("authorizedChannels", [])
    if not isinstance(authorized_channels, list) or any(
        not isinstance(channel, str) or not channel.strip()
        for channel in authorized_channels
    ):
        fail("rights.authorizedChannels must be an array of non-empty strings")
    if rights_scope == "public-channel-authorized" and not authorized_channels:
        fail("public-channel-authorized scope requires rights.authorizedChannels")
    if rights_scope == "public-channel-authorized" and rights_state not in {"owned", "licensed"}:
        fail("public-channel-authorized scope requires owned or licensed rights state")
    if rights_state == "unknown" and rights_scope != "local-private-unpublished":
        fail("unknown rights state must remain local-private-unpublished")
    if rights_scope != "public-channel-authorized" and authorized_channels:
        fail("rights.authorizedChannels must be empty unless scope is public-channel-authorized")

    watermark = require_dict(recipe.get("watermark", {}), "watermark")
    font_path = None
    if watermark.get("fontFile"):
        font_path = safe_path(base, watermark.get("fontFile"), "watermark.fontFile")

    return {
        "width": width,
        "height": height,
        "fps": fps,
        "duration": duration,
        "background": background,
        "layers": normalized_layers,
        "outputDirectory": output_directory,
        "basename": basename,
        "gifFallback": gif_fallback,
        "posterTime": poster_time,
        "compareTimes": compare_times,
        "staticThreshold": static_threshold,
        "phoneWidth": phone_width,
        "audioMode": global_audio_mode,
        "gainDb": gain_db,
        "rightsState": rights_state,
        "rightsScope": rights_scope,
        "authorizedChannels": authorized_channels,
        "watermark": watermark,
        "fontPath": font_path,
    }


def public_use_ready(normalized: Dict[str, Any]) -> bool:
    return (
        normalized["rightsState"] in {"owned", "licensed"}
        and normalized["rightsScope"] == "public-channel-authorized"
        and bool(normalized["authorizedChannels"])
    )


def layer_filter(layer: Dict[str, Any], input_index: int, mask_index: Optional[int], label: str) -> Tuple[List[str], str]:
    width, height = layer["width"], layer["height"]
    filters: List[str] = []
    chain = f"[{input_index}:v]"
    if layer["kind"] == "crop":
        crop = layer["crop"]
        chain += (
            f"crop={crop['width']}:{crop['height']}:{crop['left']}:{crop['top']},"
            f"scale={width}:{height}:flags=lanczos,setsar=1"
        )
    elif layer["kind"] == "image":
        chain += f"scale={width}:{height}:flags=lanczos,setsar=1"
    else:
        fit = layer["fit"]
        if fit == "contain":
            chain += (
                f"trim=duration=999999,setpts=PTS-STARTPTS,"
                f"scale={width}:{height}:force_original_aspect_ratio=decrease:flags=lanczos,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
            )
        elif fit == "cover":
            chain += (
                f"trim=duration=999999,setpts=PTS-STARTPTS,"
                f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,"
                f"crop={width}:{height},setsar=1"
            )
        else:
            chain += f"trim=duration=999999,setpts=PTS-STARTPTS,scale={width}:{height}:flags=lanczos,setsar=1"

    if mask_index is None:
        filters.append(chain + f",format=rgba[{label}]")
    else:
        filters.append(chain + f",format=rgba[{label}_rgb]")
        filters.append(f"[{mask_index}:v]scale={width}:{height},format=gray[{label}_mask]")
        filters.append(f"[{label}_rgb][{label}_mask]alphamerge[{label}]")
    return filters, label


def build_video(
    ffmpeg: str,
    normalized: Dict[str, Any],
    temp_directory: Path,
    output_path: Path,
    include_audio: bool,
    audio_input_index: Optional[int],
) -> None:
    width = normalized["width"]
    height = normalized["height"]
    fps = normalized["fps"]
    duration = normalized["duration"]
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c={normalized['background']}:s={width}x{height}:r={fps}:d={duration}",
    ]

    indexed_layers: List[Tuple[Dict[str, Any], int, Optional[int]]] = []
    next_index = 1
    for layer in normalized["layers"]:
        if layer["kind"] == "media":
            command.extend(
                [
                    "-stream_loop",
                    "-1",
                    "-ss",
                    str(layer["startSeconds"]),
                    "-i",
                    str(layer["path"]),
                ]
            )
        else:
            command.extend(["-loop", "1", "-framerate", str(fps), "-i", str(layer["path"])])
        layer_input_index = next_index
        next_index += 1
        mask_input_index = None
        if layer["radius"]:
            mask_path = temp_directory / f"mask-{layer['id']}.pgm"
            write_rounded_mask(mask_path, layer["width"], layer["height"], layer["radius"])
            command.extend(["-loop", "1", "-framerate", str(fps), "-i", str(mask_path)])
            mask_input_index = next_index
            next_index += 1
        indexed_layers.append((layer, layer_input_index, mask_input_index))

    filters: List[str] = ["[0:v]format=rgba[base]"]
    current = "base"
    for index, (layer, input_index, mask_index) in enumerate(indexed_layers):
        label = f"layer{index}"
        parts, prepared = layer_filter(layer, input_index, mask_index, label)
        filters.extend(parts)
        output = f"stage{index}"
        filters.append(
            f"[{current}][{prepared}]overlay={layer['left']}:{layer['top']}:format=auto[{output}]"
        )
        current = output

    watermark = normalized["watermark"]
    text_filters: List[str] = []
    for text_key, position_key, size_key in (
        ("text", "position", "fontSize"),
        ("traceText", "tracePosition", "traceFontSize"),
    ):
        value = watermark.get(text_key)
        if not isinstance(value, str) or not value:
            continue
        left, top = position(watermark.get(position_key, {}), f"watermark.{position_key}")
        font_size = integer(watermark.get(size_key, 24), f"watermark.{size_key}", 1)
        colour = watermark.get("colour", "white")
        if not isinstance(colour, str) or not colour:
            fail("watermark.colour must be a colour string")
        colour = colour.lstrip("#")
        font_option = f":fontfile='{drawtext_escape(str(normalized['fontPath']))}'" if normalized["fontPath"] else ""
        text_filters.append(
            f"drawtext=text='{drawtext_escape(value)}':x={left}:y={top}:fontsize={font_size}:fontcolor={colour}@0.72{font_option}"
        )

    if text_filters:
        filters.append(f"[{current}]" + ",".join(text_filters) + ",format=yuv420p[outv]")
    else:
        filters.append(f"[{current}]format=yuv420p[outv]")

    if include_audio and audio_input_index is not None:
        gain = normalized["gainDb"]
        filters.append(
            f"[{audio_input_index}:a:0]volume={gain}dB,atrim=duration={duration},asetpts=PTS-STARTPTS[outa]"
        )

    command.extend(["-filter_complex", ";".join(filters), "-map", "[outv]"])
    if include_audio and audio_input_index is not None:
        command.extend(["-map", "[outa]", "-c:a", "aac", "-b:a", "128k"])
    else:
        command.append("-an")
    command.extend(
        [
            "-t",
            str(duration),
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-profile:v",
            "baseline",
            "-level:v",
            "4.1",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "16",
            "-g",
            str(fps * 2),
            "-movflags",
            "+faststart",
            "-shortest",
            str(output_path),
        ]
    )
    run(command, f"render {output_path.name}")


def extract_rgb_frame(ffmpeg: str, path: Path, time_seconds: float, width: int, height: int) -> bytes:
    data = run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(time_seconds),
            "-i",
            str(path),
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "pipe:1",
        ],
        f"extract QA frame at {time_seconds}s",
        capture_stdout=True,
    )
    expected = width * height * 3
    if len(data) != expected:
        fail(f"decoded QA frame has {len(data)} bytes; expected {expected}")
    return data


def maximum_static_delta(
    first: bytes,
    second: bytes,
    width: int,
    height: int,
    media_rect: Optional[Tuple[int, int, int, int]],
) -> int:
    if len(first) != len(second):
        fail("QA frames have different byte lengths")
    maximum = 0
    row_bytes = width * 3
    if media_rect is None:
        return max(abs(a - b) for a, b in zip(first, second))
    left, top, media_width, media_height = media_rect
    right = left + media_width
    bottom = top + media_height
    for y in range(height):
        row_start = y * row_bytes
        segments: Iterable[Tuple[int, int]]
        if top <= y < bottom:
            segments = ((row_start, row_start + left * 3), (row_start + right * 3, row_start + row_bytes))
        else:
            segments = ((row_start, row_start + row_bytes),)
        for start, end in segments:
            if end <= start:
                continue
            local = max(abs(a - b) for a, b in zip(first[start:end], second[start:end]))
            maximum = max(maximum, local)
    return maximum


def render(recipe_path: Path, ffmpeg_override: Optional[str], validate_only: bool) -> Dict[str, Any]:
    recipe_path = recipe_path.resolve()
    base = recipe_path.parent
    recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
    normalized = validate_recipe(require_dict(recipe, "recipe"), base)
    ffmpeg = find_ffmpeg(ffmpeg_override)
    if validate_only:
        return {"renderer": RENDERER, "recipe": recipe_path.name, "valid": True, "ffmpeg": ffmpeg}

    output_directory: Path = normalized["outputDirectory"]
    output_directory.mkdir(parents=True, exist_ok=True)
    basename = normalized["basename"]
    silent_path = output_directory / f"{basename}-silent.mp4"
    primary_path = output_directory / f"{basename}-primary-audio.mp4"
    poster_path = output_directory / f"{basename}-poster.png"
    phone_path = output_directory / f"{basename}-phone-{normalized['phoneWidth']}.png"
    gif_path = output_directory / f"{basename}.gif"

    media_layer = next((layer for layer in normalized["layers"] if layer["kind"] == "media"), None)
    source_audio_present = bool(media_layer and source_has_audio(ffmpeg, media_layer["path"]))
    audio_mode = normalized["audioMode"]
    if media_layer and media_layer["audio"] == "required":
        audio_mode = "required"
    elif media_layer and media_layer["audio"] == "silent":
        audio_mode = "silent"
    if audio_mode == "required" and not source_audio_present:
        fail("audio is required but the media source has no detectable audio stream")
    include_audio = source_audio_present and audio_mode != "silent"

    with tempfile.TemporaryDirectory(prefix="jelocare-zapshot-") as temporary:
        temp_directory = Path(temporary)
        # Inputs are assigned in build_video as: base=0, then each layer and its optional mask.
        audio_input_index = None
        next_index = 1
        for layer in normalized["layers"]:
            layer_index = next_index
            next_index += 1
            if layer["radius"]:
                next_index += 1
            if layer["kind"] == "media":
                audio_input_index = layer_index

        delivery_path = primary_path if include_audio else silent_path
        build_video(
            ffmpeg,
            normalized,
            temp_directory,
            delivery_path,
            include_audio,
            audio_input_index,
        )
        if include_audio:
            run(
                [
                    ffmpeg,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(primary_path),
                    "-map",
                    "0:v:0",
                    "-c:v",
                    "copy",
                    "-an",
                    "-movflags",
                    "+faststart",
                    str(silent_path),
                ],
                "create silent fallback",
            )

        run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-ss",
                str(normalized["posterTime"]),
                "-i",
                str(delivery_path),
                "-frames:v",
                "1",
                "-threads",
                "1",
                str(poster_path),
            ],
            "create poster",
        )
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(poster_path),
                "-vf",
                f"scale={normalized['phoneWidth']}:-2:flags=lanczos",
                "-frames:v",
                "1",
                "-threads",
                "1",
                str(phone_path),
            ],
            "create phone proof",
        )
        if normalized["gifFallback"]:
            gif_filter = (
                "fps=12,scale=540:-2:flags=lanczos,split[s0][s1];"
                "[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=sierra2_4a"
            )
            run(
                [
                    ffmpeg,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(silent_path),
                    "-filter_complex",
                    gif_filter,
                    "-loop",
                    "0",
                    str(gif_path),
                ],
                "create GIF fallback",
            )

        first = extract_rgb_frame(
            ffmpeg,
            delivery_path,
            normalized["compareTimes"][0],
            normalized["width"],
            normalized["height"],
        )
        second = extract_rgb_frame(
            ffmpeg,
            delivery_path,
            normalized["compareTimes"][1],
            normalized["width"],
            normalized["height"],
        )

    media_rect = None
    if media_layer:
        media_rect = (
            media_layer["left"],
            media_layer["top"],
            media_layer["width"],
            media_layer["height"],
        )
    static_delta = maximum_static_delta(
        first,
        second,
        normalized["width"],
        normalized["height"],
        media_rect,
    )
    if static_delta > normalized["staticThreshold"]:
        fail(
            "decoded pixels outside the media panel changed by "
            f"{static_delta}; threshold is {normalized['staticThreshold']}"
        )

    primary_audio_present = primary_path.is_file() and source_has_audio(ffmpeg, primary_path)
    silent_audio_present = silent_path.is_file() and source_has_audio(ffmpeg, silent_path)
    if include_audio and not primary_audio_present:
        fail("source audio was present but the primary MP4 has no audio stream")
    if silent_audio_present:
        fail("silent fallback unexpectedly contains audio")

    outputs: List[Path] = [silent_path, poster_path, phone_path]
    if primary_path.is_file():
        outputs.insert(0, primary_path)
    if gif_path.is_file():
        outputs.append(gif_path)
    ready_for_public_approval = public_use_ready(normalized)
    receipt = {
        "schemaVersion": 1,
        "renderer": RENDERER,
        "renderedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "recipe": {"filename": recipe_path.name, "sha256": sha256(recipe_path)},
        "canvas": {
            "width": normalized["width"],
            "height": normalized["height"],
            "fps": normalized["fps"],
            "durationSeconds": normalized["duration"],
        },
        "audio": {
            "mode": audio_mode,
            "sourceHadAudio": source_audio_present,
            "primaryOutputHadAudio": primary_audio_present,
            "silentFallbackHadAudio": silent_audio_present,
        },
        "motionBoundary": {
            "animatedLayerIds": [media_layer["id"]] if media_layer else [],
            "constructionOutsideMediaStatic": True,
            "decodedFrameTimesSeconds": normalized["compareTimes"],
            "decodedMaximumOutsideMediaChannelDelta": static_delta,
            "allowedMaximum": normalized["staticThreshold"],
            "result": "pass",
        },
        "rights": {
            "state": normalized["rightsState"],
            "scope": normalized["rightsScope"],
            "authorizedChannels": normalized["authorizedChannels"],
            "publicUseReady": ready_for_public_approval,
        },
        "outputs": [
            {
                "filename": path.name,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "audio": source_has_audio(ffmpeg, path) if path.suffix.lower() == ".mp4" else None,
            }
            for path in outputs
        ],
        "state": "ready-for-approval" if ready_for_public_approval else "local-private-unpublished",
    }
    receipt_path = output_directory / "render-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    hash_paths = outputs + [receipt_path]
    sums_path = output_directory / "SHA256SUMS"
    sums_path.write_text(
        "".join(f"{sha256(path)}  {path.name}\n" for path in sorted(hash_paths, key=lambda value: value.name)),
        encoding="utf-8",
    )
    receipt["receiptFilename"] = receipt_path.name
    receipt["checksumsFilename"] = sums_path.name
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe", type=Path, help="Path to a Zapshot recipe JSON file")
    parser.add_argument("--ffmpeg", help="Explicit FFmpeg executable path")
    parser.add_argument("--validate-only", action="store_true", help="Validate inputs without rendering")
    args = parser.parse_args()
    try:
        result = render(args.recipe, args.ffmpeg, args.validate_only)
    except (RecipeError, json.JSONDecodeError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
