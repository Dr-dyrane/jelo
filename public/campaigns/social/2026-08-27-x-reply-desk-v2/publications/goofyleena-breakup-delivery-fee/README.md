# Goofyleena breakup delivery-fee reply

Live X reply:

`https://x.com/jelocare/status/2093211465645948942`

Exact published copy:

> At least breakup no collect delivery fee 😭

The reply was published through X's native GIF picker with `Cry Love GIF by
Showmax`. The user separately supplied a downloaded 480 × 480 reference GIF
for private clipping. The platform-native selection—not the downloaded upload—
is the published media route.

## Private Zapshot rebuild — LT·002

`goofyleena-breakup-delivery-fee-thread-clip.gif` is a local 1080 × 1920
derivative built from the user-supplied live screenshot and GIF. The source and
reply pixels remain static. Only the declared 900 × 900 media panel animates.
Counts, timestamps, action rows, Grok controls, and overflow menus are omitted
rather than reconstructed. X's native `GIF` and `ALT` pills are retained as
fixed overlays because they truthfully describe the moving panel; Showmax's
embedded red mark also remains untouched. The fixed `@jelocare` and `LT·002`
marks identify the outer clip treatment; they do not claim ownership of the
media.

Rebuild and verify from the repository root:

```bash
node public/campaigns/social/2026-08-27-x-reply-desk-v2/publications/goofyleena-breakup-delivery-fee/build-watermark-overlay.mjs
node public/campaigns/social/2026-08-27-x-reply-desk-v2/tools/reply-thread-clip/render.mjs public/campaigns/social/2026-08-27-x-reply-desk-v2/publications/goofyleena-breakup-delivery-fee/reply-thread-clip.json
node public/campaigns/social/2026-08-27-x-reply-desk-v2/tools/reply-thread-clip/render.mjs public/campaigns/social/2026-08-27-x-reply-desk-v2/publications/goofyleena-breakup-delivery-fee/reply-thread-clip.json --check
node public/campaigns/social/2026-08-27-x-reply-desk-v2/publications/goofyleena-breakup-delivery-fee/verify-thread-static.mjs
```

The locked scripts require Sharp `0.34.5`. The exact private screenshot and GIF
must be supplied at the ignored paths with the hashes recorded in
`source-provenance.json`; the renderer fails closed on output hashes in
`--check` mode.

## Rights and publication boundary

The Showmax/GIPHY GIF depicts an identifiable person and retains Showmax and
sponsor marks. The live screenshot includes a third-party account identity and
wording. JeloCare does not own those pixels. The private reference inputs and
rendered clip are deliberately ignored by Git. Do not crop out attribution,
add an ownership claim over the media, commit/deploy the ignored binaries, or
publish the clip to WhatsApp, Instagram, paid media, or another platform
without compatible permission and fresh action-time confirmation.
