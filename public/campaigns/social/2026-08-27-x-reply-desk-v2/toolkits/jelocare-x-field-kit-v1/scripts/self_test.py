#!/usr/bin/env python3
"""Run a rights-safe synthetic end-to-end test of the portable renderer."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from render_zapshot import find_ffmpeg, public_use_ready, render, validate_recipe


def paint_rectangle(
    pixels: bytearray,
    canvas_width: int,
    left: int,
    top: int,
    width: int,
    height: int,
    colour: tuple,
) -> None:
    row_bytes = canvas_width * 3
    encoded = bytes(colour) * width
    for y in range(top, top + height):
        start = y * row_bytes + left * 3
        pixels[start : start + len(encoded)] = encoded


def write_synthetic_capture(path: Path) -> None:
    width, height = 720, 1280
    pixels = bytearray(width * height * 3)
    paint_rectangle(pixels, width, 20, 50, 4, 960, (62, 70, 79))
    paint_rectangle(pixels, width, 40, 60, 80, 80, (242, 142, 125))
    paint_rectangle(pixels, width, 140, 60, 300, 50, (235, 235, 235))
    paint_rectangle(pixels, width, 140, 120, 500, 120, (205, 205, 205))
    paint_rectangle(pixels, width, 40, 850, 80, 80, (255, 151, 136))
    paint_rectangle(pixels, width, 140, 850, 300, 50, (245, 245, 245))
    paint_rectangle(pixels, width, 140, 910, 500, 100, (215, 215, 215))
    path.write_bytes(f"P6\n{width} {height}\n255\n".encode("ascii") + pixels)


def main() -> int:
    ffmpeg = find_ffmpeg()
    with tempfile.TemporaryDirectory(prefix="jelocare-field-kit-test-") as temporary:
        base = Path(temporary)
        assets = base / "assets"
        assets.mkdir()
        capture = assets / "synthetic-thread.ppm"
        media = assets / "synthetic-media.mp4"
        recipe_path = base / "recipe.json"
        write_synthetic_capture(capture)
        command = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=240x400:rate=24",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=523:sample_rate=48000",
            "-t",
            "2",
            "-shortest",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            str(media),
        ]
        result = subprocess.run(command, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))

        recipe = {
            "schemaVersion": 1,
            "renderer": "jelocare-portable-zapshot/1",
            "traceId": "LT·TEST",
            "canvas": {
                "width": 360,
                "height": 640,
                "fps": 24,
                "durationSeconds": 2,
                "background": "black",
            },
            "layers": [
                {
                    "id": "connector",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 20, "top": 50, "width": 4, "height": 960},
                    "resize": {"width": 2, "height": 450},
                    "position": {"left": 30, "top": 60},
                },
                {
                    "id": "source-avatar",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 40, "top": 60, "width": 80, "height": 80},
                    "resize": {"width": 48, "height": 48},
                    "position": {"left": 12, "top": 12},
                },
                {
                    "id": "source-identity",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 140, "top": 60, "width": 300, "height": 50},
                    "resize": {"width": 180, "height": 30},
                    "position": {"left": 64, "top": 15},
                },
                {
                    "id": "source-copy",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 140, "top": 120, "width": 500, "height": 120},
                    "resize": {"width": 250, "height": 60},
                    "position": {"left": 64, "top": 48},
                },
                {
                    "id": "moving-media",
                    "kind": "media",
                    "path": "assets/synthetic-media.mp4",
                    "startSeconds": 0,
                    "fit": "contain",
                    "radius": 12,
                    "resize": {"width": 180, "height": 320},
                    "position": {"left": 90, "top": 125},
                    "audio": "preserve-if-present",
                },
                {
                    "id": "reply-avatar",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 40, "top": 850, "width": 80, "height": 80},
                    "resize": {"width": 48, "height": 48},
                    "position": {"left": 12, "top": 470},
                },
                {
                    "id": "reply-identity",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 140, "top": 850, "width": 300, "height": 50},
                    "resize": {"width": 180, "height": 30},
                    "position": {"left": 64, "top": 473},
                },
                {
                    "id": "reply-copy",
                    "kind": "crop",
                    "path": "assets/synthetic-thread.ppm",
                    "crop": {"left": 140, "top": 910, "width": 500, "height": 100},
                    "resize": {"width": 250, "height": 50},
                    "position": {"left": 64, "top": 510},
                },
            ],
            "watermark": {
                "text": "@jelocare",
                "traceText": "LT·TEST",
                "fontFile": None,
                "fontSize": 13,
                "traceFontSize": 10,
                "colour": "white",
                "position": {"left": 90, "top": 448},
                "tracePosition": {"left": 275, "top": 130},
            },
            "audio": {"mode": "preserve-if-present", "gainDb": 0},
            "outputs": {"directory": "output", "basename": "synthetic-zapshot", "gifFallback": True},
            "qa": {
                "posterTimeSeconds": 0.5,
                "compareFrameTimesSeconds": [0.25, 1.25],
                "maximumDecodedStaticChannelDelta": 32,
                "phoneProofWidth": 195,
            },
            "rights": {
                "state": "owned",
                "scope": "public-channel-authorized",
                "authorizedChannels": ["synthetic-test"],
            },
        }
        recipe_path.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        receipt = render(recipe_path, ffmpeg, False)
        assert receipt["audio"]["sourceHadAudio"] is True
        assert receipt["audio"]["primaryOutputHadAudio"] is True
        assert receipt["audio"]["silentFallbackHadAudio"] is False
        assert receipt["motionBoundary"]["result"] == "pass"
        assert receipt["state"] == "ready-for-approval"
        required = {
            "synthetic-zapshot-primary-audio.mp4",
            "synthetic-zapshot-silent.mp4",
            "synthetic-zapshot-poster.png",
            "synthetic-zapshot-phone-195.png",
            "synthetic-zapshot.gif",
            "render-receipt.json",
            "SHA256SUMS",
        }
        produced = {path.name for path in (base / "output").iterdir()}
        missing = required - produced
        if missing:
            raise RuntimeError(f"self-test outputs missing: {sorted(missing)}")
        negative_rights = [
            {"state": "unknown", "scope": "local-private-unpublished", "authorizedChannels": []},
            {"state": "owned", "scope": "local-private-unpublished", "authorizedChannels": []},
            {"state": "licensed", "scope": "platform-native-only", "authorizedChannels": []},
        ]
        for rights in negative_rights:
            candidate = json.loads(json.dumps(recipe))
            candidate["rights"] = rights
            normalized = validate_recipe(candidate, base)
            assert public_use_ready(normalized) is False
    print("PASS: synthetic Zapshot, synchronized source audio, silent fallback, QA, and hashes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
