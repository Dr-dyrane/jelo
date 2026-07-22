# JeloCare interface contract

Updated: 2026-07-22

This is a build rule, not a mood board. New UI should satisfy it before review.

## Calm, clear, human

- Use peach, blush, pink, and cream for page surfaces. Brown is an accent, never the dominant page field.
- Keep copy short and plain. One thought per line. Remove technical or promotional prose when the interface can explain itself.
- Use regular display and body weights. Semibold is for compact controls and status only; bold is exceptional.
- Use people photography throughout the story, not only in a hero. Show varied skin tones, ages, hair textures, and care contexts.
- Keep text beside photography or on a reliably opaque surface. Never assume a photo will preserve contrast.

## Every action answers

Every click that changes state must make the change understandable.

- Show the applied state immediately or take the person to the changed result.
- Name what changed and show the new result count when relevant.
- Keep URL state for searchable and shareable catalogue views.
- Provide Undo for the last reversible change and Clear for a filter group.
- Preserve keyboard focus and announce concise state changes through a dedicated polite status region.
- Use subtle motion as orientation, never as the only feedback. Respect reduced-motion settings.
- Do not turn an entire result grid into a live region.

## Progressive disclosure

- Keep the primary task visible. Put secondary detail in a focused modal, side sheet on desktop, or bottom sheet on mobile.
- Do not stack expandable panels inside expandable panels.
- Do not make people scroll past long explanations to reach price, provider, use, or safety information.
- Keep a visible trigger near the decision point and return focus to it when a sheet closes.
- A sheet must have a clear title, close control, primary action, and safe dismissal behavior.

## Surface hierarchy

- Avoid decorative borders. Separate areas with spacing, tone, translucency, and restrained shadow.
- Use glass only for floating controls or depth over imagery. Maintain readable contrast and provide an opaque fallback.
- Use rounded forms consistently. A pill is a control or short status, not a container for paragraphs.
- Hide rail scrollbars while retaining keyboard/touch scrolling, snap behavior, and a visible next-card cue.
- Use Lucide icons already in the system. Never use emoji as interface icons.

## Product truth

- Public product imagery uses a real, traceable packshot with the complete pack visible. It must have a genuinely transparent background, remain centred, be at least 1,000 × 1,000, and have a hash-bound peach/pink/dark surface approval; opaque studio canvases, hidden pale planes, undersized images, and placeholders stay private.
- Background removal may isolate source pixels; it must not redraw packaging, labels, claims, sizes, or ingredients.
- Poor, clipped, mismatched, or untraceable product images are quarantined, not polished into false evidence.
- Company names remain quiet text labels. Do not add decorative brand badges or mixed-quality logo marks.
- Prices appear only for a fresh, exact product offer in the selected market. Search-result prices and stale observations do not count.
- Reviewed and community-sourced records remain visually and functionally distinct.

## Information system, not a shop

- Lead with comparison, provenance, fit, and where an exact product can be found.
- Affiliate value never changes product guidance, ranking, or safety boundaries.
- Do not fabricate ratings, sale states, stock pressure, gender/sex suitability, diagnoses, or treatment claims.
- Concern matching is guidance for reviewed products, not diagnostic proof.

## Release check

Before shipping a new interaction, verify:

1. The action has visible and screen-reader feedback.
2. The change can be reversed or cleared.
3. Focus, keyboard use, mobile sheets, contrast, and reduced motion work.
4. Copy is shorter than the first draft and still clear.
5. No border, badge, weight, icon, image, price, or claim violates this contract.
