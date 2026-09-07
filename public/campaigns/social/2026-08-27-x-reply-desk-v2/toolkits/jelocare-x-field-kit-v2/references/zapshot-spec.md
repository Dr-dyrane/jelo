# Zapshot specification

A Zapshot presents a source/reply pair as a vertical editorial creative while
preserving its identity and wording. It cannot establish that the pair is
currently live. Real inputs stay outside the portable packet; included examples
are fictional test fixtures.

The supported operator route is `scripts/zapshot.py`. Read
[the crop playbook](crop-playbook.md) before choosing regions. Legacy low-level
recipe files are not the v2 starter workflow.

## Inputs and source binding

Start with `run --screenshot PATH --video PATH --case NEWDIR`. It uses the
approved crop/layout for an exact known source pair. Unknown pairs return
`NEEDS_REGIONS` with a prepared case for inspection and the guided workflow.

`prepare --screenshot PATH --video PATH --case NEWDIR` retains original copies,
records their hashes/dimensions in `input.json`, and emits `inspect.png`,
`media-contact.png`, and `regions.template.json`. The case must be new.

The screenshot must show the complete intended source, media panel, and JeloCare
reply with unobstructed identity and prose. The supplied video must belong to
that panel. A URL alone, a thumbnail, a missing MP4, or a different video cannot
satisfy the moving-media input. A static-only creative is a separate request;
do not invent motion to conceal missing media.

The current runtime accepts clips longer than 0 and no longer than 60 seconds;
it repeats a clip shorter than 6 seconds as complete synchronized loops to reach
at least 6 seconds. Screenshots must be at least 320 pixels on each side. Do not
silently trim, fabricate motion, or upscale missing detail to bypass an input
limit.

`regions.json` is copied from the prepared template. Its schema version is 2.
Preserve `screenshotSha256` and `videoSha256`; set `coordinateSpace` to the full
image width and height used for measurement. Prefer original dimensions. A full
resized image is permitted only with its actual size and matching aspect ratio.
The renderer validates the ratio and maps to original pixels. A viewport crop,
letterboxed viewer, or unknown thumbnail size cannot be used as a coordinate
space.

The `regions` object contains exactly these required boxes, each
`[x, y, width, height]`:

| Region            | Required contents                                                            |
| ----------------- | ---------------------------------------------------------------------------- |
| `source_avatar`   | Entire source avatar with its original shape.                                |
| `source_identity` | Exact source name, genuine badge if present, and handle.                     |
| `source_text`     | All source prose, punctuation, and emojis.                                   |
| `media`           | Full visible boundary of the source media panel, used as the reference area. |
| `reply_avatar`    | Entire JeloCare avatar with its original shape.                              |
| `reply_identity`  | Exact JeloCare name, genuine badge if present, and handle.                   |
| `reply_text`      | All intended JeloCare reply prose, punctuation, and emojis.                  |

All boxes use the same coordinate space. Width/height are sizes, not right and
bottom coordinates. Require nonnegative origins, positive sizes, and boxes fully
inside the declared image. Set `source_media_match: true` only after visual
source/video comparison. Set `theme` to `dark` or `light` to match the source
and `trace` to a unique identifier such as `LT-014`.

Regions must not overlap. The native screenshot must place source identity/text,
then media, then reply in that order. Avatar boxes must be close to square and
retain the complete avatar; every normalized box must be at least 8 pixels on
each side. Add small clean background padding around complete identity/prose
and the full circular avatar. Keep glyphs, badge edges, and emoji away from crop
boundaries while excluding ages, controls, and old media. A rejection calls for
corrected source regions, not relaxed limits.

## Literal pixels, layout, and motion

Avatars, names, real badges, handles, exact prose, punctuation, and emojis remain
static source pixels. Never retype them, use OCR output as replacement text,
redraw a badge, sharpen invented detail, or fill an obstruction. OCR can help
locate a line; it cannot supply missing pixels.

The renderer makes a 1080 × 1920 composition using fixed source-proportional
sizing. It samples a visible connector below the source avatar and extends that
native stripe as a static connector. A missing visible connector is not invented.
The selected theme supports the original light or dark source. Layout, fitting,
positions, scale, and QA thresholds are code-owned.

Only the video panel moves. Preserve the full original video frame and its
aspect ratio for square, portrait, and landscape clips. Do not stretch it,
zoom into faces, crop it to force a square, or animate the surrounding screenshot.
Fit padding is acceptable; missing video content is not. Do not leave a second
static strip of the old media in a text crop.

Exclude ages/timestamps, Grok, overflow, action controls, interaction counts,
bookmarks, composer, navigation, quoted duplicate cards, and adjacent posts
from retained identity/text/avatar crops. An original overlay inside the media
reference is replaced by the actual source video; it must not survive as a
separate literal layer.

Keep synchronized source audio in `final.mp4` when the file has an audio stream.
A mute icon describes screenshot playback UI, not the file's audio. A source
without audio stays silent. Do not add music, synthesize an absent voice, use a
different audio track, or let a silent/GIF fallback replace an audible primary.
Any requested extra derivative must be labelled and separately checked.

## Preview and bound review

`preview --case DIR --regions JSON` emits `crops.png`, `preview.png`,
`phone.png`, `plan.json`, and `review.template.json` in the case directory.
The AI must open the original and all three generated proofs. Fix failed crops
and regenerate the preview before completing its review.

The fixed `CROP_EDGE` check rejects visible identity/text at crop boundaries and
substantially cut circular avatars. Expand the crop safely to include complete
content and small clean background padding, then rerun `preview`. Do not relax
thresholds or include forbidden chrome to bypass a failure. If clean expansion
cannot recover the content, obtain a complete source. `CROP_EDGE` is not semantic
certification: it cannot prove that the selected identity or every prose line
is correct and complete. Actual visual comparison remains required.

Copy the generated template to `review.json`, preserve `planSha256`, and set
the following checks to Boolean `true` only after actual inspection:

- `source_identity_complete`
- `source_text_complete`
- `reply_identity_complete`
- `reply_text_complete`
- `no_chrome_or_old_media`
- `media_matches_source`
- `media_fully_visible`
- `phone_readable`
- `no_obstruction`

Do not bulk-fill checks from command success. The review is bound to the plan
and assets; changing the inputs or plan invalidates prior review. Code checks
consistency and fixed QA rules, while the reviewer supplies the visual judgment.
A technical pass cannot prove that a person actually inspected an image.

## Outputs and evidence

`render --case DIR --review FILE` produces these files inside `output/`:

- `final.mp4`
- `poster.png`
- `phone.png` at 390 px width
- `render-receipt.json`
- `SHA256SUMS`

Review the final video/proofs and the receipt. The receipt records output/source
bindings, audio presence, and QA evidence. QA must constrain motion to the media
panel and use the renderer's fixed limits. Never lower them or edit receipts to
turn a failed file into a passed one.

The output state is always `local-private-unpublished`. Record source/reply
URLs, rights, provenance, checked time, and permitted channels separately.
Ownership/licensing, reuse scope, exact action approval, and target-level
publication verification remain distinct gates. The renderer makes no rights
or public posting decision.

## Known sources and unseen inputs

`run --screenshot PATH --video PATH --case NEWDIR` can use a registered preset
only when both original input hashes match exactly. On an unfamiliar pair,
`NEEDS_REGIONS` leaves preparation artifacts for the guided flow. Similar
appearance, author, filename, dimensions, or wording is insufficient.

Direct `prepare` and `preview` entry points also detect exact known pairs and
select their approved preset automatically. A known pair's canonical crop/layout
cannot be overridden through a hand-authored region file or alternate entry
point. Unseen pairs still require the complete guided visual review.

A known replay or fixture run proves only that case. Unseen-case handling
requires actual AI vision plus runtime, with the inspected regions and review
retained. Never claim broad chatbot compatibility or independent generalization
from preset or scripted-fixture success.
