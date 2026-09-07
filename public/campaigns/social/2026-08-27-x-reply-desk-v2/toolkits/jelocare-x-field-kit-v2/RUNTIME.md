# Render runtime

Editorial drafting needs no software installation. Actual Zapshot output needs
a writable filesystem, Python 3.9+, the packages in `requirements.txt`, and a
usable FFmpeg build. The renderer runs locally without an LLM, API key, X login,
or network request to an AI service. The host AI still needs image inspection to
choose and review regions for an unseen screenshot.

## Check first

From the extracted kit directory:

```bash
python3 scripts/zapshot.py doctor
```

Read the actual result before promising a render. A recognized executable is
not proof of image-reading capability, available file attachments, or public
web access. If dependencies are absent and the host permits installation:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/zapshot.py doctor
```

On systems where Python is named `python` rather than `python3`, use that
interpreter after checking its version. FFmpeg may be supplied by the system
or the packaged Python dependency. Report the exact missing dependency if
`doctor` cannot establish a usable runtime; do not invent successful output.
Never request an AI API key to make this renderer work.

## Guided render

Use fresh paths outside the distributed kit for private work. The case path
must be a new directory; retain a prior case instead of overwriting it.

The current pipeline accepts a decodable video longer than 0 and no longer than
60 seconds, plus a screenshot at least 320 pixels on each side. Clips shorter
than 6 seconds repeat as complete loops to reach at least 6 seconds, including
their synchronized audio. It does not silently trim a long video. A static-only
input cannot pass the moving-media QA. Report an unsupported input and obtain
the appropriate source or an explicitly requested alternative scope.

```bash
python3 scripts/zapshot.py prepare --screenshot /path/thread.png --video /path/source.mp4 --case /path/case-001
python3 scripts/zapshot.py preview --case /path/case-001 --regions /path/case-001/regions.json
python3 scripts/zapshot.py render --case /path/case-001 --review /path/case-001/review.json
```

These are three stages, not a single copy-and-run block. Between `prepare` and
`preview`, inspect the original screenshot, original-coordinate grid, and media
contact sheet; create `regions.json` from the generated template. Between
`preview` and `render`, inspect all three visual proofs and fill the generated
review. See [the crop playbook](references/crop-playbook.md).

The review is bound to the plan and source assets. Do not edit hashes, reuse a
review after changing crops, or change a source file inside a prepared case.
For changed input bytes, prepare a new case. For changed regions, create a new
preview and complete its new review. Preserve failed evidence; never weaken QA
or fill every check automatically to make rendering continue.

Once an `output/` directory exists, a second render does not overwrite it.
Use a new case for a corrected final; preserve any `FAILED.json` evidence and
do not deliver a failed MP4 merely because a file was written.

## Known-pair replay

```bash
python3 scripts/zapshot.py run --screenshot /path/thread.png --video /path/source.mp4 --case /path/case-002
```

Only the exact screenshot/video hash pair can select a registered preset.
Resizing, recompressing, trimming, or replacing either input makes it another
pair. `NEEDS_REGIONS` is the expected handoff to the guided flow, not permission
to choose the nearest preset. Continue from the prepared case it created.

The fictional visual examples exercise layout cases. Replaying supplied regions
or presets proves only those cases. To assess unseen-case handling, use a
previously unseen screenshot/video pair and record the AI's actual source,
crop, preview, phone, and final inspection. Do not label scripted replays an
independent visual judgment.

## Output and reproducibility

The case's `output/` directory contains `final.mp4`, `poster.png`, `phone.png`,
`render-receipt.json`, and `SHA256SUMS`. Inspect the final video and receipt.
Audio-stream presence must agree with the supplied video; a screenshot's mute
control is not an audio decision. Render success cannot verify social ancestry,
rights, or public availability.

Encoded bytes can differ across FFmpeg builds and operating systems. Source
hashes, crop selection, plan binding, fixed QA, audio presence, and output
properties remain auditable. Promise identical encoded bytes only within a
locked and actually verified runtime.

## Maintaining the packet

After intentional packet edits, the maintainer can run the bundled validation
and packaging commands. These are maintenance commands, not steps an operator
must perform for every Zapshot:

```bash
python3 scripts/validate_packet.py .
python3 scripts/self_test.py
python3 scripts/hash_assets.py .
python3 scripts/build_packet.py .
```

Do not add real source captures, private case folders, credentials, or campaign
media to the portable archive. A test pass is evidence only for what that test
actually exercised.
