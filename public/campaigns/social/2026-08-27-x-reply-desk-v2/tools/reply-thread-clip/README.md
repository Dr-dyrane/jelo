# JeloCare reply-thread clip renderer

This closes the campaign desk's earlier portability gap: clean reply-thread
slides were either generated previews or one-off scripts tied to one machine.
This renderer rebuilds an editorial clip from frozen source pixels and a small
JSON layout file.

## What it does

- crops exact identity and copy regions from a retained reference capture;
- removes timestamps, action rows, counts and compose controls by omission;
- places a static or animated reply asset in a declared layout;
- preserves source GIF frame delays and applies the declared loop setting;
- emits a poster PNG and/or animated GIF; and
- verifies the rebuilt bytes against committed SHA-256 hashes.

It does **not** capture a browser, publish a post, grant reuse rights, or prove
that a generated treatment is a live screenshot. The campaign record remains
the authority for checked-at evidence, exact URLs/copy, publication state,
source rights and claim boundaries.

## Portable use

The renderer imports the repository's pinned `sharp` dependency and resolves
every asset/output path relative to the config file, not the current working
directory. From any clean clone or sandbox:

```bash
npm ci
node public/campaigns/social/2026-08-27-x-reply-desk-v2/tools/reply-thread-clip/render.mjs \
  public/campaigns/social/2026-08-27-x-reply-desk-v2/drafts/<record>/reply-thread-clip.json
```

Run the same command with `--check` to render in memory and fail unless the
result matches the hashes recorded in the config:

```bash
node public/campaigns/social/2026-08-27-x-reply-desk-v2/tools/reply-thread-clip/render.mjs \
  public/campaigns/social/2026-08-27-x-reply-desk-v2/drafts/<record>/reply-thread-clip.json \
  --check
```

The config must name the exact Sharp version from `package-lock.json`. A
mismatched install fails closed instead of silently producing different bytes.

The committed regression records are:

- `drafts/mira-restock-reply-whatsapp-v3-portable/reply-thread-clip.json` —
  crop-and-compose with a three-frame owned GIF; its output is byte-identical
  to the accepted v2 poster and animation.
- `drafts/jaynett-fifth-question-whatsapp-v2-portable/` records the accepted
  output hashes, both non-deterministic image-generation passes, and the exact
  deterministic layout recipe. Its third-party pixels are deliberately absent
  until compatible rightsholder permission makes a portable rebuild lawful.

## Editorial and evidence boundary

Use a freshly observed public post/reply as evidence, then freeze the accepted
reference capture before laying it out. Keep source wording and identity exact;
never invent publication, engagement or verification. Omitting platform chrome
is an editorial treatment, not permission to reuse another person's identity,
words or media on another channel. Store that permission state separately in
the campaign record and keep unverified metrics out of the artwork.

Generated concept art has an additional boundary: prompts are provenance, not
a byte-reproducible source. Freeze the accepted generated output in Git, record
its generation/edit prompts and hash, and feed those accepted pixels into this
deterministic renderer.
