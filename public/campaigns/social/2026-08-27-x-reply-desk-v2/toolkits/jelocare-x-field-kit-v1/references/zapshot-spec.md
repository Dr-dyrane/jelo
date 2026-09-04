# Zapshot specification

## Purpose

A Zapshot turns a verified live X source/reply pair into a vertical editorial
creative while keeping identity and wording truthful. It is not a generated X
interface and must not be presented as one.

## Required literal pixels

Crop from a complete native capture:

- source avatar;
- source display name, badge, and handle;
- exact source prose and emojis;
- literal thread connector;
- JeloCare avatar;
- JeloCare display name, badge, and handle;
- exact JeloCare reply and emojis.

Stop if a required region is clipped or unreadable. Never reconstruct it with a
font, OCR, generative fill, or a guessed handle.

## Required omissions

Relative ages/timestamps, Grok, overflow, action controls, interaction numbers,
bookmarks, composer, navigation, quoted duplicate cards, and adjacent posts.

## Motion and audio

- Canvas: 1080 × 1920, black background.
- Only layers with `kind: media` may animate.
- Preserve full source aspect ratio unless a crop is explicitly approved.
- The primary MP4 keeps synchronized source audio when audio is present and
  usable. A silent MP4/GIF is a fallback, not the primary.
- Do not add unrelated stock music.
- Watermark `@jelocare` and a unique `LT·NNN` trace without obscuring the source.

## Recipe

Fill `templates/zapshot-recipe.json`. Crop coordinates are in pixels from the
original capture. Layer order is visual back-to-front. Use `fit: contain` when
the full native frame matters and `fit: cover` only with explicit approval.

The renderer accepts PNG/JPEG/WebP literal layers and one MP4/MOV/WebM/GIF
media layer. It discovers a system `ffmpeg` or Python's `imageio_ffmpeg` binary.
Owned or licensed media remains private until the recipe explicitly records
`scope: public-channel-authorized` and names one or more
`authorizedChannels`. Unknown or platform-native-only scope cannot advance.

## Outputs and proof

- `*-primary-audio.mp4` when source audio exists;
- `*-silent.mp4` fallback;
- `*-poster.png`;
- `*-phone-390.png`;
- optional `*.gif`;
- `render-receipt.json`;
- `SHA256SUMS`.

The receipt must record source audio presence and output audio presence. It must
also sample decoded frames and report the maximum channel delta outside the
media rectangle. The static-region threshold is declared in the recipe; a
failure stops delivery.

Review the poster and a motion frame at full size and 390 px. Confirm identities,
exact prose, emoji, connector, media fit, watermark, trace, and exclusions.
