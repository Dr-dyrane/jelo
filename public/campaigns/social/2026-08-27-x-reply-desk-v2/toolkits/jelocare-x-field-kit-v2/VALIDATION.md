# What this kit proves — and what it does not

The v2 integration gate rendered all three fictional worked cases, preserved
silent/audio behavior, rejected 21 unsafe inputs/reviews, and produced the same
MP4 SHA-256 twice for the same input/regions/runtime. Full and phone proofs were
also inspected. `scripts/self_test.py` reproduces the technical gate.

A bounded correction added six crop-edge rejection regressions (three cut
avatars and three cut text blocks), bringing the script to 27 rejection checks.
The original complete fixture crops still pass. Every entry point now recognizes
an exact registered source pair; selecting manual crops cannot override its
approved layout. The corrected known replay preserves the prior proof and MP4
bytes. These code checks do not turn a model's visual self-attestation into proof.

The runtime used for that gate was Python 3.9.6, Pillow 11.3.0, numpy 2.0.2,
imageio-ffmpeg 0.6.0, and its FFmpeg 7.1 macOS arm64 binary. Different operating
systems and encoders are not promised byte-identical files. Source identity,
untyped crop content, proportions, visible media, audio and boundary checks are
the portable visual contract.

`presets/lt015-approved.json` contains only hashes, crop geometry and reviewed
layout for one approved source pair. That is deterministic replay, not an
unseen-case test. No third-party screenshot or video is embedded in the ZIP.

Unseen source selection still requires an image-capable AI to inspect the
source, crops and final proof. Numerical checks cannot certify that a model
really read every word. A model that cannot inspect files must stop, not invent
an output. A chatbot without executable Python cannot produce the video merely
by reading this ZIP.

Fresh-context model trials are graded separately from the fixture test. Any
release-specific trial receipt accompanies the ZIP, rather than being used as
a hidden answer inside the test packet. A failed first attempt must remain
failed even when a later administrator correction looks good.

Everything renders local/private. No test supplies social publication authority
or reuse rights. The packet does not include passwords, sessions or credentials.
