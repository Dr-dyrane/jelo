# JeloCare X Field Kit v2 verification

Build checkpoint: local-uncommitted, private artifact build. At that checkpoint
nothing had been committed, pushed, deployed, published, or sent externally.
Subsequent Git archival/publication is recorded by repository history; this
report is evidence of the frozen build and trials, not current deployment or
social publication state. Git archival does not change source-media reuse rights.

Archive: `JeloCare-X-Field-Kit-v2.0.0.zip`, 14,448,321 bytes.
SHA-256: `47247d3af73a9d2010d56209c078365c05a38d20e087e43ceb8d0f61de4f67d5`.

## Reproducibility and technical gates

- Clean extraction verified safe ZIP paths and every internal SHA-256 entry.
- Rebuilding from that extraction produced the identical archive hash.
- Three fictional cases covered square silent, landscape audible, and portrait
  audible media. Their complete native crops and phone proofs were inspected.
- The initial integration gate passed 21 negative tests. The single correction
  added six targeted clipped-avatar/text rejection checks, all passing, without
  rejecting the original complete fixture crops. The shipped self-test includes
  all 27 rejection tests.
- Decoded frames verified actual motion, source-frame correspondence, static
  identity/thread pixels outside the media box, and whole-file decoding.
- Audible fixtures retained source audio, with correlation above 0.9999 within
  the fixed 20ms comparison window. Silent-source output stayed silent.
- Same input, reviewed regions, renderer, dependencies and encoder produced
  byte-identical MP4s in separate clean case directories.
- The approved exact-pair route cannot be bypassed by using manual preview:
  the correction test supplied the failed crops, and the CLI used the canonical
  hash-matched regions/layout instead. Both original file hashes are required.

Runtime tested: Python 3.9.6, Pillow 11.3.0, numpy 2.0.2,
imageio-ffmpeg 0.6.0 / FFmpeg 7.1, macOS arm64.

## Independent smaller-model trial

Setting: gpt-5.6-luna, low reasoning, fresh context. Allowed inputs were only
the frozen ZIP and two screenshot/video pairs. No earlier conversation, hidden
fixture geometry, previous output, administrator crop hints or code changes
were allowed. Model-owned preview corrections taught by the kit were allowed.

The first candidate ZIP was **not accepted**. Case A severely clipped identities
and prose despite passing self-attestation. Case B was legible, but detailed
inspection found minor crop-edge cuts. Both failed the exact visual standard.
That ZIP and those artifacts remain retained; later changes do not erase them.

One bounded package correction added automatic canonical routing on every
supported entry point and foreground crop-edge rejection. No new held-out
coordinates or source assets were added to the ZIP. A second fresh agent was
given the corrected frozen package and the same pairs.

- Known case A: passed. The actual MP4 matched the reviewed reference SHA-256
  `8fea70bca623b4bf807cffa231a732efd477ceb883181ead607fd69b57b5f9cb`.
  Full avatars, handles, source prose and reply were retained, with only the
  matching media panel moving. The source contains no audio stream.
- Unseen case B: passed. The model expanded its own crops after `CROP_EDGE`,
  then produced the final without administrator input. Root inspected the full
  decoded poster and phone proof: complete circular avatars, fictional demo
  badges, names, handles, and every line remained visible, including KESTREL
  and MARIGOLD. No ages, engagement, controls or adjacent-post content remained.
  The correct moving media and source audio were retained. Audio correlation
  was 0.999964 within 20ms; outside-media maximum pixel delta was 5, below the
  fixed limit of 20. MP4 SHA-256:
  `4f8487fac4c69aede4f9cfc652c4d2d3586f5998f3691182e95edba13100d946`.

Both actual outputs and their receipt checksums were verified. All 70 files in
the extracted kit's internal hash manifest remained unchanged during the trial.
The model reported no assistance, network access, posting or external delivery.
This is acceptance of the corrected packet on these two cases, not of the
failed first candidate. The unseen case was original test material rather than
another real-world X screenshot, so broader real-world generalization remains
untested.

## Scope of the claim

This is one supported runtime and one model setting, not certification of every
chatbot or every screenshot layout. A ZIP does not provide image inspection,
code execution, writable storage, or dependencies to a host that lacks them.
New screenshots still need the AI to select and inspect complete source crops.
Crop-edge rejection catches visible boundary cuts; it cannot prove that a model
included every entire word, correctly read a thread, or genuinely inspected it.

Exact encoded bytes are promised only for the same verified runtime and locked
inputs/regions. Cross-platform output can have different encoded hashes while
preserving the visual and audio contract.

The campaign workflow preserves native identities/prose, source audio, private
composition, and exact-action publication approval. The ZIP contains no
credentials, sessions, customer data, fonts, or reusable third-party media.
Its media examples are original fictional fixtures. Local rendering does not
establish public reuse rights or authorize posting.

## Git archival checkpoint — 7 September 2026

The user authorized tracking and Git publication with “ok track n publish”.
Integration fast-forwarded to `54d15215` (two non-overlapping inventory commits).
Packet validation, internal checksums and a clean-extraction identical rebuild
passed again. The non-production application build also passed.
The complete packet self-test was rerun before archival: all three fixture
renders and 27 rejection checks passed, and repeated render bytes matched.
The four archived public-reply records passed their checksum and linkage checks;
two repository-state fields were labelled explicitly as record-creation state.

Git publication is held: `npm run verify:release` failed its Node-test gate,
including daily-campaign expectations, the stored catalogue research-queue
projection, and the expected Slique Beauty offer for Mediana. These application
and catalogue files are outside this archive change. No test, catalogue data,
release threshold, or production configuration was changed to bypass the gate.
The archive can be retained as a local commit; a push requires resolving the
repository failure under a separately authorized scope. No social action or
manual deployment was performed.
