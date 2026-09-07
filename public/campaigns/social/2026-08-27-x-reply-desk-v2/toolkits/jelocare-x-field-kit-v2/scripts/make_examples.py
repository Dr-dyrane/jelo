#!/usr/bin/env python3
"""Create original geometric, explicitly fictional Zapshot teaching fixtures.

This is test-data construction, not reconstruction of real social content.
No network, account, private capture, or third-party media is used. The optional
--spec route supports a separately held evaluation fixture without embedding
its identity, geometry, or expected answer in the distributed kit.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont


KIT = Path(__file__).resolve().parents[1]
FPS = 18
SECONDS = 2
FONT_PATH = None
EXAMPLES = [
    {"id": "dark-square", "trace": "DEMO-01", "theme": "dark",
     "mediaSize": [540, 540], "audio": False, "shape": "circle",
     "accent": "#36cbb3", "mediaBackground": "#173447",
     "sourceText": "Only this colour block should move.\nKeep the full sentence: SUNRISE.",
     "replyText": "Keep this complete reply.\nFinal word: LANTERN.",
     "sourceSentinel": "SUNRISE.", "replySentinel": "LANTERN."},
    {"id": "light-landscape", "trace": "DEMO-02", "theme": "light",
     "mediaSize": [540, 304], "audio": True, "shape": "triangle",
     "accent": "#c45116", "mediaBackground": "#f6d99f",
     "sourceText": "The wide frame has room to travel.\nKeep every edge: HORIZON.",
     "replyText": "The test tone follows the frame.\nFinal word: MEADOW.",
     "sourceSentinel": "HORIZON.", "replySentinel": "MEADOW."},
    {"id": "dark-portrait", "trace": "DEMO-03", "theme": "dark",
     "mediaSize": [360, 640], "audio": True, "shape": "diamond",
     "accent": "#f39bce", "mediaBackground": "#342345",
     "sourceText": "This tall panel keeps its true shape.\nRead to the end: ORCHARD.",
     "replyText": "The diamond moves, the words stay.\nFinal word: FIREFLY.",
     "sourceSentinel": "ORCHARD.", "replySentinel": "FIREFLY."},
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    if FONT_PATH:
        return ImageFont.truetype(str(FONT_PATH), size)
    candidates = [KIT / "assets/fonts/DejaVuSans.ttf",
                  Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
                  Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    for candidate in candidates:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size)
    raise RuntimeError("Pass --font with a readable local TrueType font.")


def ffmpeg():
    found = os.environ.get("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if found:
        return found
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def dump(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def label(draw, xy, text, size, fill):
    draw.text(xy, text, font=font(size), fill=fill, anchor="lt")


def text_region(draw, xy, text, size, fill, spacing=9):
    face = font(size)
    box = draw.multiline_textbbox((0, 0), text, font=face, spacing=spacing)
    draw.multiline_text((xy[0] - box[0], xy[1] - box[1]), text,
                        font=face, fill=fill, spacing=spacing)
    return [xy[0] - 2, xy[1] - 2, box[2] - box[0] + 4, box[3] - box[1] + 4]


def avatar(draw, xy, size, accent, variant, background):
    x, y = xy
    draw.ellipse((x, y, x + size - 1, y + size - 1), fill=accent)
    c, r = size // 2, size // 5
    if variant == "square":
        draw.rectangle((x+c-r, y+c-r, x+c+r, y+c+r), fill=background)
    elif variant == "triangle":
        draw.polygon([(x+c, y+c-r-3), (x+c-r-3, y+c+r), (x+c+r+3, y+c+r)], fill=background)
    else:
        draw.ellipse((x+c-r, y+c-r, x+c+r, y+c+r), fill=background)
    return [x, y, size, size]


def identity(draw, xy, name, handle, foreground, muted, accent):
    x, y = xy
    a = text_region(draw, (x, y), name, 28, foreground)
    name_width = a[2]
    # A square D is a fictional demo badge, never a verification checkmark.
    draw.rounded_rectangle((x+name_width+6, y, x+name_width+28, y+22), radius=4, fill=accent)
    label(draw, (x+name_width+11, y+3), "D", 16, "#ffffff")
    b = text_region(draw, (x, y+35), handle, 23, muted)
    return [x-2, y-2, max(name_width+32, b[2]), b[1]+b[3]-y+2]


def frame(spec, number):
    width, height = spec["mediaSize"]
    im = Image.new("RGB", (width, height), spec["mediaBackground"])
    d = ImageDraw.Draw(im)
    light = "#f9fcff" if spec["theme"] == "dark" else "#3a2517"
    for x in range(20, width, 40):
        d.line((x, 0, x, height), fill=spec["accent"], width=1)
    for y in range(20, height, 40):
        d.line((0, y, width, y), fill=spec["accent"], width=1)
    d.rectangle((2, 2, width-3, height-3), outline=light, width=3)
    label(d, (18, 18), spec["trace"], 22, light)
    label(d, (18, height-40), "ORIGINAL TEST MOTION", 18, light)
    radius = min(width, height) // 7
    phase = number / (FPS * SECONDS) * math.tau
    cx = width // 2 + int(math.sin(phase) * (width // 2 - radius - 20))
    cy = height // 2 + int(math.cos(phase) * height * 0.12)
    box = (cx-radius, cy-radius, cx+radius, cy+radius)
    if spec["shape"] == "triangle":
        d.polygon([(cx, cy-radius), (cx-radius, cy+radius), (cx+radius, cy+radius)], fill=spec["accent"])
    elif spec["shape"] == "diamond":
        d.polygon([(cx, cy-radius), (cx-radius, cy), (cx, cy+radius), (cx+radius, cy)], fill=spec["accent"])
    elif spec["shape"] == "square":
        d.rectangle(box, fill=spec["accent"])
    else:
        d.ellipse(box, fill=spec["accent"])
    d.line((cx-9, cy, cx+9, cy), fill=light, width=3)
    d.line((cx, cy-9, cx, cy+9), fill=light, width=3)
    label(d, (18, 52), "FRAME %02d" % number, 18, light)
    return im


def make_media(spec, path):
    w, h = spec["mediaSize"]
    command = [ffmpeg(), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", "%dx%d" % (w,h), "-r", str(FPS), "-i", "pipe:0"]
    if spec["audio"]:
        command += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
                    "-af", "volume=0.12", "-c:a", "aac", "-b:a", "96k"]
    else:
        command += ["-an"]
    command += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
                "-t", str(SECONDS), "-map_metadata", "-1", "-movflags", "+faststart", str(path)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error = process.communicate(b"".join(frame(spec, n).tobytes() for n in range(FPS*SECONDS)))
    if process.returncode:
        raise RuntimeError(error.decode())
    decoded = subprocess.check_output([ffmpeg(), "-v", "error", "-i", str(path),
                                       "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"])
    return Image.open(io.BytesIO(decoded)).convert("RGB")


def make_fixture(spec, out, expected_only=False):
    out.mkdir(parents=True, exist_ok=True)
    first = make_media(spec, out / "media.mp4")
    dark = spec["theme"] == "dark"
    bg, fg, muted = ("#0e141b", "#f3f7fa", "#8e9dac") if dark else ("#ffffff", "#16232c", "#687781")
    panel = "#1f2b37" if dark else "#edf2f5"
    sw = spec.get("screenshotWidth", 720)
    tx = spec.get("textX", 116)
    ax = spec.get("avatarX", 34)
    sy = spec.get("sourceY", 122)
    text_y = sy+83
    scratch = ImageDraw.Draw(Image.new("RGB", (sw, 2000)))
    source_size = text_region(scratch, (tx, text_y), spec["sourceText"], 27, fg)
    media_y = source_size[1]+source_size[3]+24
    media_x = spec.get("mediaX", tx)
    mw, mh = spec["mediaSize"]
    ry = media_y+mh+131
    reply_size = text_region(scratch, (tx, ry+83), spec["replyText"], 27, fg)
    sh = reply_size[1]+reply_size[3]+188
    im = Image.new("RGB", (sw, sh), bg)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, sw, 52), fill=panel)
    label(d, (18, 16), "SYNTHETIC DEMO - NO REAL POST OR ENGAGEMENT", 20, fg)
    label(d, (32, 75), "<   Demo thread", 25, fg)
    label(d, (sw-165, 78), "Search    ...", 20, muted)
    regions = {}
    regions["source_avatar"] = avatar(d, (ax, sy), 62, spec["accent"], spec.get("avatarShape", "triangle"), bg)
    regions["source_identity"] = identity(d, (tx, sy+2), spec.get("sourceName", "Demo Source"),
                                          spec.get("sourceHandle", "@demo_source"), fg, muted, spec["accent"])
    label(d, (sw-172, sy+8), "DEMO 2h  ...", 19, muted)
    regions["source_text"] = text_region(d, (tx, text_y), spec["sourceText"], 27, fg)
    regions["media"] = [media_x, media_y, mw, mh]
    im.paste(first, (media_x, media_y))
    # Deliberate exclusion traps beneath the complete matching media frame.
    old_y = media_y+mh+8
    im.paste(first.crop((0, mh-16, mw, mh)), (media_x, old_y))
    d.rectangle((media_x, old_y, media_x+241, old_y+16), fill=panel)
    label(d, (media_x+3, old_y+1), "LEGACY STRIP - EXCLUDE", 14, muted)
    label(d, (tx, old_y+32), "DEMO TIME 09:41  -  7 SEP 2026", 18, muted)
    label(d, (tx, old_y+67), "Reply 0   Repost 0   Like 0   Share   Save", 19, muted)
    d.line((ax+31, sy+70, ax+31, ry-10), fill=muted, width=3)
    d.line((20, ry-21, sw-20, ry-21), fill=panel, width=2)
    regions["reply_avatar"] = avatar(d, (ax, ry), 62, spec["accent"], "square", bg)
    regions["reply_identity"] = identity(d, (tx, ry+2), spec.get("replyName", "Demo Reply"),
                                         spec.get("replyHandle", "@demo_reply"), fg, muted, spec["accent"])
    label(d, (sw-172, ry+8), "DEMO 1h  ...", 19, muted)
    regions["reply_text"] = text_region(d, (tx, ry+83), spec["replyText"], 27, fg)
    end_y = reply_size[1]+reply_size[3]
    label(d, (tx, end_y+26), "Reply 0   Repost 0   Like 0   Share", 19, muted)
    d.rounded_rectangle((tx, end_y+64, sw-30, end_y+121), radius=20, fill=panel)
    label(d, (tx+18, end_y+81), "Demo composer - excluded", 22, muted)
    d.rectangle((0, sh-44, sw, sh), fill=panel)
    label(d, (34, sh-31), "Home       Search       Alerts       Messages", 20, muted)
    im.save(out / "screenshot.png", optimize=True)
    region_data = {"schemaVersion": 2, "screenshotSha256": sha(out / "screenshot.png"),
                   "videoSha256": sha(out / "media.mp4"), "coordinateSpace": {"width": sw, "height": sh},
                   "regions": regions, "source_media_match": True, "theme": spec["theme"], "trace": spec["trace"]}
    dump(out / ("expected-regions.json" if expected_only else "regions.json"), region_data)
    metadata = {"schemaVersion": 2, "exampleId": spec["id"], "synthetic": True,
                "provenance": "Original local code-native geometric test imagery and synthetic sine; no real account, engagement, capture or third-party media.",
                "fontPolicy": "Local font is rasterized for test imagery; no system font file is included.",
                "sourceText": spec["sourceText"], "replyText": spec["replyText"],
                "sourceLastWord": spec["sourceSentinel"], "replyLastWord": spec["replySentinel"],
                "audio": {"present": spec["audio"], "kind": "synthetic 440 Hz sine" if spec["audio"] else "none"},
                "durationSeconds": SECONDS, "fps": FPS, "mediaSize": spec["mediaSize"],
                "mediaFirstFrame": "Screenshot media region equals the decoded first frame, pixel for pixel.",
                "requiredOmissions": ["relative ages", "absolute timestamp", "action controls", "engagement zeros", "legacy media strip", "composer", "navigation"],
                **{key: value for key, value in region_data.items() if key != "regions"}}
    if not expected_only:
        dump(out / "metadata.json", metadata)
    for name, rect in regions.items():
        x, y, w, h = rect
        assert min(x, y) >= 0 and w > 0 and h > 0 and x+w <= sw and y+h <= sh, (name, rect)
    assert im.crop((media_x, media_y, media_x+mw, media_y+mh)).tobytes() == first.tobytes()
    print(json.dumps({"fixture": spec["id"], "screenshot": str(out / "screenshot.png"),
                      "dimensions": [sw, sh], "regions": regions,
                      "screenshotSha256": region_data["screenshotSha256"], "videoSha256": region_data["videoSha256"]}))
    return im, regions, first


def crop(im, rect):
    x, y, w, h = rect
    return im.crop((x, y, x+w, y+h))


def comparison(path, number, title, wrong, correct, wrong_note, correct_note):
    im = Image.new("RGB", (1200, 680), "#eef3f6")
    d = ImageDraw.Draw(im)
    label(d, (32, 25), "%02d  %s" % (number, title), 33, "#132838")
    label(d, (32, 70), "FICTIONAL TEACHING FIXTURE - NO REAL POST OR ENGAGEMENT", 18, "#506271")
    for x, heading, preview, note, colour in [(32, "WRONG", wrong, wrong_note, "#a72b36"),
                                              (616, "CORRECT", correct, correct_note, "#166958")]:
        d.rounded_rectangle((x, 113, x+552, 631), radius=16, fill="#ffffff", outline=colour, width=3)
        label(d, (x+20, 131), heading, 27, colour)
        shown = preview.copy()
        shown.thumbnail((512, 363), Image.Resampling.LANCZOS)
        px, py = x+20+(512-shown.width)//2, 184+(363-shown.height)//2
        im.paste(shown, (px, py))
        label(d, (x+20, 578), note, 18, "#233744")
    label(d, (32, 650), "Only source media moves. Identity and complete prose remain literal pixels.", 19, "#506271")
    im.save(path, optimize=True)


def make_cards(out, made):
    cards = out / "teaching-cards"
    cards.mkdir(exist_ok=True)
    im, r, first = made[0]
    x,y,w,h = r["source_identity"]
    comparison(cards / "01-timestamps.png", 1, "Keep ages outside identity crops",
               crop(im, [x,y,im.width-x-8,h]), crop(im, r["source_identity"]),
               "The age and overflow have slipped in.", "Name, demo badge and handle only.")
    stretched = first.resize((500, 245), Image.Resampling.LANCZOS)
    comparison(cards / "02-aspect-ratio.png", 2, "Preserve the native aspect ratio",
               stretched, first, "A square is stretched into a wide panel.", "The circle stays round; no edge is lost.")
    x,y,w,h = r["reply_text"]
    comparison(cards / "03-final-word.png", 3, "Keep the final word complete",
               crop(im, [x,y,w-115,h]), crop(im, r["reply_text"]),
               "The crop cuts the word LANTERN.", "The final word LANTERN is intact.")
    mx,my,mw,mh = r["media"]
    rx,ry,rw,rh = r["reply_text"]
    comparison(cards / "04-old-media-strip.png", 4, "Do not carry old media into a reply",
               crop(im, [rx,my+mh+8,mw,ry+rh-my-mh-8]), crop(im, r["reply_text"]),
               "Legacy media and controls precede reply.", "The reply crop contains only its prose.")
    comparison(cards / "05-controls.png", 5, "Keep controls and composer outside prose",
               crop(im, [rx,ry,mw,rh+128]), crop(im, r["reply_text"]),
               "Action counts and the composer remain.", "No controls or engagement row remain.")
    comparison(cards / "06-media-match.png", 6, "Match the screenshot to the source video",
               made[1][2], first, "DEMO-02 cannot replace DEMO-01 media.", "The trace, shape and first frame match.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=KIT / "examples/visual")
    parser.add_argument("--font", type=Path)
    parser.add_argument("--spec", type=Path, help="External single-fixture JSON; never bundled automatically.")
    parser.add_argument("--expected-only", action="store_true", help="Write expected-regions.json for a separate grader.")
    args = parser.parse_args()
    global FONT_PATH
    FONT_PATH = args.font
    if args.spec:
        make_fixture(json.loads(args.spec.read_text(encoding="utf-8")), args.out, args.expected_only)
    else:
        if args.expected_only:
            parser.error("--expected-only requires an external --spec")
        made = [make_fixture(spec, args.out / spec["id"]) for spec in EXAMPLES]
        make_cards(args.out, made)


if __name__ == "__main__":
    main()
