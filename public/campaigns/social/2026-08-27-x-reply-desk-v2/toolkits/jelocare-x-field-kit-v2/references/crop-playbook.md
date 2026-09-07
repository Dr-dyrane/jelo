# Crop playbook: a new screenshot to a reviewed Zapshot

Use this guide for every screenshot/video pair without an exact registered
preset. The AI inspects the images and chooses regions. The operator supplies
complete sources, not hand-measured coordinates. The renderer determines layout,
scale, fitting, audio handling, and QA thresholds.

## 1. Establish a usable source

Run `python3 scripts/zapshot.py doctor`. If runtime support is absent, report the
specific capability and hand off the sources without claiming rendered output.
A host without image inspection cannot perform this playbook by guessing.

Open the original screenshot. Locate the exact source post and the intended
JeloCare reply. Both avatars and complete identity/text must be present. Check
that this is the correct reply in the thread, not an adjacent comment or a
quoted duplicate. Do not infer current live status from a screenshot.

Look for obstruction before choosing boxes: menus, tooltips, notifications,
login sheets, image viewers, highlighted text, a keyboard, cursor overlays,
partial scrolling, cut-off lines, or a collapsed “Show more.” If any required
identity or prose is hidden, obtain a complete capture. If an already-authorized
browser is available, recapture the same thread cleanly. Otherwise request the
specific missing view. Never reconstruct hidden words or badges from context.

Check that the supplied video file exists and is actually a moving-media input.
A renamed file, thumbnail, link, audio-only file, or missing MP4 is not enough.
Do not search for substitute footage or download restricted media to complete
the composition. A mismatch calls for the matching original.

## 2. Start with run, then inspect an unknown pair

From the kit directory, replace the example paths:

```bash
python3 scripts/zapshot.py run --screenshot /path/thread.png --video /path/source.mp4 --case /path/case-001
```

Choose a new case directory. An exact known screenshot/video hash pair uses its
approved crop/layout and renders through the preset path; inspect its final
output. `prepare` and `preview` also select that exact preset automatically.
Do not attempt to replace canonical regions/layout by choosing a different
entry point. A near-match cannot use the preset.

For an unknown pair, `run` returns `NEEDS_REGIONS` after copying the originals,
recording hashes/dimensions in `input.json`, and creating `inspect.png`,
`media-contact.png`, and `regions.template.json`. Continue below in that prepared
case. Do not rerun `prepare` into it. Keep private cases outside the portable kit.

Actually open the original screenshot, `inspect.png`, and `media-contact.png`.
Match several contact-sheet frames to the source panel using the scene, people
or objects, camera view, and sequence. A single generic frame or the same author
is insufficient. The screenshot may show a later moment than the first video
frame; inspect more of the supplied video when the sampled sheet is inconclusive.
If no frame establishes the match, leave it unresolved and request the matching
original. Do not set `source_media_match` merely because filenames look related.

## 3. Use one coordinate space correctly

Read the original width `W` and height `H` in `input.json`. The generated
`inspect.png` is 720 pixels wide; its numbered grid labels report ORIGINAL
source coordinates. Your chat's image viewer may resize it again. The grid
numbers are source coordinates, not thumbnail pixel measurements.

Preferred method: measure in original pixels and leave
`coordinateSpace: {"width": W, "height": H}` as generated. Use the grid to
locate regions, then inspect the original at sufficient detail to refine edges.
When using the grid labels, do not multiply those already-original numbers again.

If measuring a full resized view instead, put its actual full dimensions in
`coordinateSpace` and express every box in that resized space. The renderer
checks the aspect ratio and maps it back. Never mix spaces across boxes.

Example arithmetic only: an original 1440 × 2400 screenshot displayed as a full
720 × 1200 image has scale factors 2 and 2. A measured box
`[60,100,180,80]` corresponds to original `[120,200,360,160]`. Either use the
original box with a 1440 × 2400 coordinate space, or the measured box with a
720 × 1200 coordinate space. Do not use the smaller box with original dimensions.
These example numbers are not a preset for any screenshot.

General conversion is:

```text
x_original = x_measured × W / measured_width
y_original = y_measured × H / measured_height
width_original = width_measured × W / measured_width
height_original = height_measured × H / measured_height
```

A zoomed viewport, screenshot of an image viewer, added border, or padded
thumbnail is not the full resized source image. Its offset/padding is not
accounted for by a simple scale. Reopen the actual full original rather than
inventing a coordinate space. If exact displayed dimensions are unknown, use
the original-coordinate grid and original image.

Every box is `[x, y, width, height]`, with `x,y` at the upper-left corner.
It is not `[left,top,right,bottom]`. For original-space boxes require:

```text
x >= 0, y >= 0, width > 0, height > 0
x + width <= W
y + height <= H
```

For resized-space boxes, use the declared resized width/height for those bounds.
Never rely on clipping outside the image to fix a bad measurement.

## 4. Select the seven regions

Copy `regions.template.json` to `regions.json`. Preserve its schema version 2,
`screenshotSha256`, and `videoSha256`; do not replace hashes with filenames or
invented values. Fill these seven fields inside `regions`:

| Field             | Include                                                                | Exclude and inspect                                                                      |
| ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `source_avatar`   | Whole original source avatar, including its edge.                      | Adjacent controls and accidental pieces of text; do not square-crop a circle's edges.    |
| `source_identity` | Complete display name, genuine badge if present, and complete handle.  | Relative age, timestamp, separator dot belonging to age, overflow, Grok.                 |
| `source_text`     | Every line, punctuation mark, and emoji in the source prose.           | Any strip of the media panel, action row, counts, or adjacent post.                      |
| `media`           | Full visible source panel boundary from top-left to bottom-right.      | Caption prose and action rows; this box identifies the panel, not a desired output crop. |
| `reply_avatar`    | Whole original JeloCare avatar.                                        | Unrelated avatar, thread action, or cut-off edge.                                        |
| `reply_identity`  | Complete JeloCare name, genuine badge if present, and complete handle. | Relative age, timestamp, overflow, Grok, or neighboring reply.                           |
| `reply_text`      | Every line, punctuation mark, and emoji of the intended reply.         | Interaction counts, buttons, composer, next reply, or old media strip.                   |

Inspect first and last letters, descenders, apostrophes, emoji edges, and the
last line. Include a small clean background margin on every side of complete
identity/prose. Required letters, badge edges, punctuation, and emojis must not
touch the crop boundary. Keep the full circular avatar and a small surrounding
margin; a near-square box alone does not prove that the circle is intact.

The right edge should sit beyond the last required glyph with visible clean
padding, not at that glyph or at the full screen edge. The lower edge should
sit below the complete last line with clean padding and above the media/action
area. Check that added padding has not included an age, old media strip, action
row, or other region. Never trade complete content for a tighter box.

A badge can sit immediately beside a name while an age sits beside the handle.
Retain the genuine badge and handle while excluding the age. Do not erase the
whole right side, omit a badge to fit a rectangle, copy a badge from another
account, or type the handle elsewhere. If one rectangle cannot contain the
required identity without forbidden content, obtain a clean native capture
whose layout permits it; do not paint out the obstacle.

The native connector below the source avatar is sampled by the renderer and
extended as static pixels. No eighth region is required. Confirm its appearance
in the preview. Do not add an invented connector when the source has none.

Set `theme` to the source's `dark` or `light` appearance. Do not invert literal
text to force the other theme. Set a unique `trace` such as `LT-014`. Set
`source_media_match: true` only after the comparison in step 2.

## 5. Preview before rendering

```bash
python3 scripts/zapshot.py preview --case /path/case-001 --regions /path/case-001/regions.json
```

Open all of `crops.png`, `preview.png`, and `phone.png`; read `plan.json`.
Opening only the JSON, reading a filename, or seeing “success” in the console
is not image review.

For a rejected region file, read the exact error. Check source hashes, declared
coordinate space, bounds, non-overlap, near-square full avatars, and source →
media → reply order. Correct those facts instead of adjusting renderer limits.

`CROP_EDGE` rejects identity/prose touching crop boundaries or a substantially
cut circular avatar. Expand the affected region outward to include the complete
content and small clean background padding. Stay within source bounds, avoid
other regions and forbidden chrome, then rerun `preview` and inspect its new
proofs. Do not paint a border, trim a glyph, omit an emoji, alter the source, or
relax the threshold to force a pass. If no clean expansion is possible, obtain
a complete unobstructed capture.

This fixed check detects edge problems; it does not certify semantic
completeness. A crop can exclude an entire line or select the wrong identity
without leaving marks at its edges. Passing `CROP_EDGE` never replaces comparing
the full source and reply with the original.

First inspect `crops.png` against the original:

- Match both avatars, exact names/handles, and real badges.
- Read every source and reply line. Preserve spelling, line content,
  punctuation, and emoji exactly. Do not “improve” original copy.
- Check that no timestamp, old media strip, duplicate quote, navigation,
  composer, action row, or interaction count entered the static regions.
- Distinguish the media reference crop from retained static content: a screenshot
  playback control inside the media panel is replaced by original video pixels.
  It must not remain outside the replacement panel.

Next inspect `preview.png` for the whole composition:

- Source and reply order and ownership must be clear.
- Each avatar, identity and prose crop must retain its own source aspect ratio.
  The program determines role sizes; do not manually stretch or rescale them.
- Check background/theme edges, connector, watermark, and trace for obstruction.
- The only area assigned motion must be the intended media panel.

Then inspect `phone.png` at its 390 px width. Read both identities and all prose
without relying on a zoomed crop. Check line endings, emojis, and overlap. A
large desktop preview cannot establish phone readability.

## 6. Preserve square, portrait, and landscape media

The renderer determines media fitting from the source/video proportions.
The `media` box is the native reference boundary, never a request to force a
different shape. Inspect all four video edges in the preview.

| Source video | Check                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Square       | Complete square frame; no tall stretch or clipped edge.                                |
| Portrait     | Full top and bottom; no automatic face zoom, head crop, or missing lower caption.      |
| Landscape    | Full left and right; no forced square that removes people, objects, or burned-in text. |

Padding can be a correct result of fitting a full frame. Do not crop away content
to eliminate padding or enlarge a video until prose no longer fits. A black
first frame can be real; compare contact-sheet frames before calling it missing.
If the supplied original itself has borders or burned-in text, preserve that
content. If an app-control recording is supplied instead of the original clip,
request the original rather than hiding the problem with a new crop.

The pipeline accepts clips longer than 0 and no longer than 60 seconds. A clip
shorter than 6 seconds repeats as complete synchronized loops to reach at least
6 seconds. Do not silently trim a longer source or invent motion for a still.

## 7. Complete the bound review honestly

Copy `review.template.json` to `review.json`. Keep its `planSha256` and
generated structure unchanged. Set each check to Boolean `true` only after the
corresponding observation:

| Check                      | Evidence required                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `source_identity_complete` | Source avatar, full name, real badge if any, and handle agree with the original.        |
| `source_text_complete`     | Every source line, punctuation mark, and emoji survives.                                |
| `reply_identity_complete`  | Intended JeloCare avatar/name/badge/handle agree with the original.                     |
| `reply_text_complete`      | Every intended reply line, punctuation mark, and emoji survives.                        |
| `no_chrome_or_old_media`   | Retained static regions exclude ages, controls, counts, and any old media strip.        |
| `media_matches_source`     | Original video visually matches the screenshot's actual source panel.                   |
| `media_fully_visible`      | Full video content and aspect ratio survive the preview.                                |
| `phone_readable`           | Both identities and all prose can actually be read in the 390 px proof.                 |
| `no_obstruction`           | No required source content or rendered text/identity is hidden, cut off, or overlapped. |

A failed check means fix the source selection or regions and make a new preview.
Review the new artifacts and use its newly generated review template. Do not
carry forward an old plan hash, edit hashes to match by hand, auto-tick all
checks, skip the preview, or lower QA thresholds. If clean source evidence
cannot resolve the failure, name the exact missing input. A tool cannot know
whether the AI actually looked; the visual attestation must be truthful.

## 8. Render and inspect the delivered files

```bash
python3 scripts/zapshot.py render --case /path/case-001 --review /path/case-001/review.json
```

Open `output/final.mp4`, `output/poster.png`, and `output/phone.png`. Read
`output/render-receipt.json` and retain `output/SHA256SUMS`. Check a beginning,
middle, and later video moment for static identities/prose and correctly moving
media. Code's fixed QA must pass; do not treat rendering alone as QA clearance.
An `output/FAILED.json` marks a failed attempt, even when an MP4 exists. Outputs
are not overwritten: use a new case for a corrected render and preserve the
failed case as evidence.

Inspect source/output audio evidence. When the original has an audio stream,
the final must keep it synchronized with that original video. A mute icon in
the screenshot only describes playback UI. Do not discard audio because a
preview image cannot play it, because the UI was muted, or because a GIF is
easier to share. A source without audio stays silent. Do not add stock music,
a synthetic voice, or an unrelated track. If the host cannot listen/play video,
state that limitation and do not claim a playback/listening check.

Deliver the actual file path and its state, `local-private-unpublished`, with
any unresolved evidence or inspection limitation. Renderer success does not
grant rights, prove a live source, or authorize a post. Keep provenance and
rights in the campaign/work-order record. Public use has its separate gate.

## 9. Know what the known-pair route proves

The `run` command can replay a preset only for an exact registered
screenshot/video hash pair. If it returns `NEEDS_REGIONS`, it has already
prepared the case: start with inspection in step 2 and continue from there.
Do not rerun `prepare` into that directory or select a similar-looking preset.
Direct `prepare`/`preview` calls still bind an exact known pair to its approved
preset. Alternate entry points do not authorize different crops or layout.

A crop choice that worked for one screenshot is not portable to a screenshot
with another scale, font wrap, theme, avatar position, video shape, or reply.
Even recompressed/resized copies have different hashes. Known fixture/preset
success is known-case evidence. An unseen-case claim needs the new inputs,
actual image inspection, its chosen regions, a bound review, and final output
evidence. Fictional fixture names and supplied regions must not be presented as
real posts, fresh source verification, or proof that every chatbot can do this.
