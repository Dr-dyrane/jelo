# Synthetic visual examples

These are original code-native test fixtures, not real X screenshots, posts,
people, or engagements. All source/reply identities are explicitly fictional
`Demo Source @demo_source` and `Demo Reply @demo_reply`. The square `D` icon is a
demo badge, not a verification mark. Avatars are simple geometric shapes.

Each example contains a complete synthetic `screenshot.png`, a matching
two-second `media.mp4`, exact native `regions.json`, and `metadata.json` with
literal prose, final-word sentinels, source hashes and audio information.
Nothing came from a private capture or third-party media file. The two audio
examples use a quiet, original 440 Hz sine tone. No system font is bundled.

Worked outputs are included: `after.mp4` (one complete two-second media cycle,
stream-copied from the checked six-second render without re-encoding), `after.png` (full
proof), `phone.png` (390 px proof), `crops.png` (the retained source regions),
and `after-qa.json` (measured checks). View the input and after proof side by
side before measuring a new case. `ASSETS.json` binds all fictional fixture
media to their checked hashes. Never use these coordinates for a new screenshot.

| Example           | Theme | Native media | Audio          | Trace   |
| ----------------- | ----- | ------------ | -------------- | ------- |
| `dark-square`     | Dark  | 540 × 540    | None           | DEMO-01 |
| `light-landscape` | Light | 540 × 304    | Synthetic sine | DEMO-02 |
| `dark-portrait`   | Dark  | 360 × 640    | Synthetic sine | DEMO-03 |

The screenshot media panel is the decoded first frame from its corresponding
video, with no resize. The seven rectangles are tight `[x, y, width, height]`
coordinates in the complete screenshot: source avatar, source identity, source
prose, media, reply avatar, reply identity and reply prose. The identity crops
include name, demo badge and handle. Every age, timestamp, action/count row,
legacy-media strip, navigation item and composer is outside those rectangles.

The screenshots intentionally retain the surrounding UI clutter. A broad crop
can include it; the teaching cards show why that is wrong. Real captures must
retain their original literal identity and prose pixels. The generator is only
for fictional test inputs; never use it to reconstruct real posts.

## Teaching cards

All cards mark the left image `WRONG` and the right image `CORRECT`.

- `teaching-cards/01-timestamps.png`: an age and overflow included in identity.
- `teaching-cards/02-aspect-ratio.png`: a square source stretched horizontally.
- `teaching-cards/03-final-word.png`: the last word clipped at the crop edge.
- `teaching-cards/04-old-media-strip.png`: an old media strip retained above reply.
- `teaching-cards/05-controls.png`: actions, counts and composer retained in prose.
- `teaching-cards/06-media-match.png`: an unrelated source video paired to capture.

For actual render practice, start with a complete screenshot and its exact
video, inspect at native and phone size, select the seven regions, and compare
the result with the supplied region truth. A JSON success result does not
replace reviewing whether the entire last word is visible.

## Rebuild

From the kit root, install the kit requirements, then run:

```sh
python3 scripts/make_examples.py
```

Use `--font path/to/font.ttf` if the bundled or system fallback is unavailable.
FFmpeg is discovered from `FFMPEG_BINARY`, the system executable, or
`imageio_ffmpeg`. The same source, font and encoder produce the same fixtures.
Hashes in each `regions.json` bind the rectangles to the current output bytes.
The generator checks that every rectangle fits inside the screenshot and that
its media pixels exactly equal the decoded video first frame.

An external evaluation fixture may be generated with `--spec`, `--out`, and
`--expected-only`. Keep its input specification and `expected-regions.json`
with the grader, and give a blind trial only its screenshot and video. No
held-out identity, geometry, input or expected answer is embedded in this kit.
