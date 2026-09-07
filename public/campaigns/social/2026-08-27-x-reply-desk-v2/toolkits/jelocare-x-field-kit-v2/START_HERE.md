# JeloCare X Field Kit v2

Give a capable AI this kit, a complete native thread screenshot, and the matching
original video. It should inspect the sources, select the crops, review its
preview, and render a Zapshot. You do not need to write JSON or measure boxes.
The same kit also handles replies, follow-ups, articles, and product spotlights.

## Start in a new AI chat

1. Upload the ZIP and paste `COPY_PASTE_THIS.txt` into the chat. If the host
   cannot open a ZIP, extract it first and supply `JeloCare-X-Field-Kit.md`.
   Actual rendering still needs the scripts, dependencies, and source files.
2. The AI runs `BOOT` and reports what it can actually do. A chatbot may read
   text while lacking image inspection, a filesystem, or code execution.
   Uploading a ZIP does not supply those capabilities.
3. Give the job in ordinary language. For example:

   ```text
   Make a Zapshot from the attached complete native screenshot and matching
   original MP4. Read the crop playbook and start with zapshot.py run. Use the
   approved preset if this exact source pair is known; if NEEDS_REGIONS is
   returned, inspect both sources, choose regions, and finish the guided flow.
   Keep the exact avatars, real badges, handles, prose, and emojis. Omit ages,
   controls, and interaction counts. Keep source audio if present.
   Source URL: [if available]
   JeloCare reply URL: [if available]
   Media rights: unknown; keep this local and private.
   ```

The AI should perform the local work already requested. It should ask for a
replacement source only when required pixels or media are missing, obstructed,
unreadable, or mismatched. It should report a missing host capability plainly.
Routine crop measurement and layout decisions belong to the AI and renderer.

## What to attach for a Zapshot

- A complete native screenshot containing the source post, its media panel,
  and the intended JeloCare reply. Both avatars, names, genuine badges if any,
  handles, and all prose/emoji must be visible and unobstructed.
- The original video that belongs to that source panel. A screenshot, thumbnail,
  unrelated MP4, or different clip from the same account is not a substitute.
- Source/reply URLs when available and the known rights scope. Supplied evidence
  can support private composition; it cannot prove current live state.

Do not resize, annotate, crop, or paint over the source before sending it. The
kit copies and hashes the originals. A mute icon in the screenshot does not
prove that the video file has no audio.

## The AI's working sequence

Run commands from the extracted kit folder. Paths below are examples: the AI
replaces them with actual file locations and chooses a new case directory.

```bash
python3 scripts/zapshot.py doctor
python3 scripts/zapshot.py run --screenshot /path/thread.png --video /path/source.mp4 --case /path/case-001
```

Start with `run`. For an exact known screenshot/video hash pair, it uses the
approved preset and renders the canonical crop/layout. Inspect that output.
Choosing `prepare` and `preview` directly cannot override a known pair's approved
crop/layout; those entry points select the same exact preset automatically.

An unknown pair returns `NEEDS_REGIONS` after preparing the case. This is the
expected continuation point, not a failed render. Preparation retains originals
and creates `input.json`, `regions.template.json`, `inspect.png` with a numbered
grid labelled in original image coordinates, and `media-contact.png` showing
video frames. Continue in that case; do not rerun `prepare` into it.

The AI must open the original screenshot and both inspection images. It then
follows [the crop playbook](references/crop-playbook.md), fills `regions.json`
from the generated template. Include small clean background padding around all
complete identity/prose and retain each full circular avatar. It then runs:

```bash
python3 scripts/zapshot.py preview --case /path/case-001 --regions /path/case-001/regions.json
```

The AI opens `crops.png`, `preview.png`, and `phone.png`, checks them against
the originals, and reads `plan.json`. It copies the generated
`review.template.json` to `review.json` and sets each check to `true` only after
actually inspecting the evidence. `CROP_EDGE` means expand the affected crop
safely to include complete content and clean padding, then preview again. Keep
forbidden chrome and old media out; never relax thresholds. This edge check does
not certify semantic completeness, so inspect every line and identity yourself.
A failed visual check means correct the regions and preview again, or stop for
the specific missing source. Then:

```bash
python3 scripts/zapshot.py render --case /path/case-001 --review /path/case-001/review.json
```

Inside the case, `output/` contains `final.mp4`, `poster.png`, `phone.png`,
`render-receipt.json`, and `SHA256SUMS`. Inspect the final output as well.
Source audio is kept synchronized when present; video without an audio stream
stays silent. The renderer uses fixed layout and QA rules. The AI does not set
output positions, invent a scale, or lower a threshold to force a pass.

### What the known-pair route proves

A registered preset requires both original file hashes to match. The AI must
not select a similar preset or use another entry point to change a known pair's
approved crop/layout. Passing a known replay demonstrates that preset, not
general handling of unseen screenshots. Unseen inputs require actual AI image
inspection plus the runtime; do not keep rerunning `run` after `NEEDS_REGIONS`
or ask the operator to measure boxes.

## Other jobs

| Say               | Result                                                             |
| ----------------- | ------------------------------------------------------------------ |
| `NEXT` or `REPLY` | Assess a source and draft one source-fit reply.                    |
| `FOLLOWUPS`       | Surface new substantive replies and meaningful changes.            |
| `ARTICLE`         | Draft a concise X article and WhatsApp/Instagram hooks.            |
| `SPOTLIGHT`       | Prepare an evidence-bounded product or retailer feature.           |
| `REPURPOSE`       | Adapt an approved moment within its recorded rights scope.         |
| `MEASURE`         | Record public observations and distinguish them from inference.    |
| `AUDIT`           | Review an existing reply, creative, record, or profile.            |
| `POST`            | Run the exact action preview, confirmation, and verification flow. |

The operator can speak naturally; the AI creates any internal work order.

## Capabilities and publication

The renderer needs no LLM or API key. It needs a usable Python/FFmpeg runtime;
see [RUNTIME.md](RUNTIME.md). A host handling an unseen screenshot also needs
image inspection and writable files. Without web access, current facts remain
`not-live-verified`. Without rendering capabilities, the AI can provide a draft
and a specific handoff, but must not call an unreviewed recipe render-ready.

The kit contains no login, credentials, customer data, or reusable third-party
media. Its visual examples are fictional test fixtures, not live campaigns.
Creating a valid local video supplies neither rights clearance nor permission
to publish it. The renderer's output state is `local-private-unpublished`.

Before an external action, show the exact target, copy, media/hash, fresh source
and duplicate check, checked-at time, and single proposed action. Obtain explicit
confirmation of that exact unit. A changed unit needs fresh confirmation.
Verify the submitted result at its target; without that proof, use
`submitted-unverified`. Private file delivery and public publication are separate
actions.

Read `JeloCare-X-Field-Kit.md` for the full editorial and publication rules,
`references/crop-playbook.md` for crop decisions, and
`references/zapshot-spec.md` for the rendering contract.
