# JeloCare X Field Kit v1

This is the portable version of JeloCare's X desk. Upload this folder or the
ZIP to a capable AI, then attach a post URL, a complete native screenshot, and
any original media needed for the job.

## Fastest start

1. Upload the ZIP. If the AI cannot inspect ZIP files, extract it and upload
   `JeloCare-X-Field-Kit.md` instead.
2. Say `BOOT`. The AI must tell you what it can actually access: uploaded
   files, public web, a signed-in X session, Python, FFmpeg, and scheduling.
3. Give a short command such as:

   - `NEXT` — find or assess the next reply opportunity.
   - `REPLY` — draft one source-fit reply from a URL or screenshot.
   - `FOLLOWUPS` — surface only new substantive replies to JeloCare.
   - `ZAPSHOT` — build a live-thread creative from a complete screenshot and
     authorized original media.
   - `ARTICLE` — outline or draft a concise X article and its hooks.
   - `SPOTLIGHT` — make a product or retailer spotlight.
   - `REPURPOSE` — adapt an approved X moment for WhatsApp or Instagram.
   - `MEASURE` — record and interpret public 1 h, 6 h, or 24 h observations.
   - `POST` — prepare or perform one exact approved external action.

Example:

```text
REPLY
Goal: join the joke without sounding like an advert
Source: https://x.com/example/status/123
Channel: X reply
Files: complete screenshot attached
```

The AI normalizes this into a work order. You do not need to write JSON.

## What travels and what does not

The voice, judgement, safety rules, reply engine, QA gates, record templates,
and Zapshot renderer travel in this packet. Your X login does not. No password,
cookie, access token, private customer data, third-party screenshot, or media is
bundled.

| Host capability               | Safe result                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Text, image, and file reading | Draft, classify, review, plan, and make an exact publication preview                       |
| Public web or browser         | Fresh source checks, trend scouting, thread ancestry, duplicate checks, and public metrics |
| Python and FFmpeg             | Render a poster, 1080 × 1920 audio MP4, 390 px proof, GIF fallback, receipt, and hashes    |
| Signed-in X control           | Submit one approved pair and verify its public URL                                         |
| Scheduler plus browser        | Monitor follow-ups and suppress unchanged items                                            |

If a capability is missing, the AI must degrade honestly. It may create a
render-ready recipe when it cannot render, or a draft when it cannot browse. It
must never pretend that evidence is fresh, a file exists, or a post is live.

## Zapshot input

Supply:

- a complete native X screenshot containing the source and live JeloCare reply;
- the original source video or owned/licensed replacement, if motion is wanted;
- the source URL and JeloCare reply URL;
- the rights state: `owned`, `licensed`, `platform-native-only`, or `unknown`.

The AI should preserve avatar, badge, handle, and exact prose as literal static
pixels. Only the declared media panel moves. Ages, controls, action rows,
engagement counts, composer, navigation, and adjacent posts stay out. If the
source video has usable audio, the primary MP4 keeps synchronized audio; a
silent derivative is only a fallback.

For a host with Python and FFmpeg:

```bash
python3 scripts/render_zapshot.py templates/zapshot-recipe.json
```

Run the included synthetic test before first use:

```bash
python3 scripts/self_test.py
```

## The publication boundary

Default state is read-only draft. Before any external action, the AI must show:

- exact target URL;
- exact final copy;
- exact media file or `none`, plus SHA-256 when media exists;
- a fresh duplicate/source check and checked-at time;
- the single action it proposes to take.

Only an explicit confirmation of that exact pair authorizes that action. Any
copy, target, or media change cancels the earlier approval. After submission,
the AI must verify the public URL, exact text, media, and reply ancestry. A click
without that proof is `submitted-unverified`, never `published`.

## Portable states

- `draft`
- `ready-for-approval`
- `local-private-unpublished`
- `submitted-unverified`
- `live-verified`

Start with `JeloCare-X-Field-Kit.md`. The smaller files under `references/`
exist for platforms that can read a folder and need more precise routing.

To rebuild the same sorted packet archive after an intentional edit:

```bash
python3 scripts/hash_assets.py .
python3 scripts/build_packet.py .
```
