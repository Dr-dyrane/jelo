# Ask Jelo experience direction

Ask Jelo is a guided education canvas, not a chat transcript, diagnosis tool, or draggable flow editor.

## Product principles

- Show one active question at a time.
- Keep a compact trail of completed answers.
- Let people edit an earlier answer and invalidate only dependent answers.
- Run safety checks before products or AI.
- Use structured choices first. Free text is optional context.
- Show a short review before building guidance.
- Keep results action-first: **Now**, **Routine**, **Products**, **Why**.
- Never call a working pattern a diagnosis or show an unvalidated confidence percentage.
- Keep health answers in session memory by default. Device saving must be explicit, reversible, and explained.

## Journey

1. Where is it?
2. What do you notice?
3. Safety check
4. When did it start?
5. How does it feel?
6. Triggers and current routine
7. Only relevant personal context
8. One to three targeted follow-ups when needed
9. Review and edit
10. Results workspace

A red flag replaces the normal journey with a concise care action. It makes zero model calls and returns zero products.

## Launch safety contract

- Emergency and urgent care copy is deterministic. Model output cannot replace it.
- Serious working patterns surface their pharmacist, primary-care, or dermatology referral before clarification.
- A person under 18, including age stated in prose, stops before AI and products.
- Submitted allergies or medicines stop before AI and products because JeloCare does not evaluate allergy or medicine interactions.
- The model may choose only from a rule-filtered catalogue shortlist. It does not write the displayed pattern, care action, routine, or referral.
- Public results describe reported signals and internal guidance notes. They do not present an exact barrier score or claim external clinical review.

The initial red-flag vocabulary follows public guidance from [NHS anaphylaxis](https://www.nhs.uk/conditions/anaphylaxis/), [AAD Rash 101](https://www.aad.org/public/everyday-care/itchy-skin/rash/rash-101), and [NHS vision loss](https://www.nhs.uk/conditions/vision-loss/). These references support emergency action for breathing or throat/tongue symptoms and prompt in-person care for relevant swelling, eye symptoms, rapid spread, blistering, pain, or fever. The checked phrase corpus remains deliberately conservative and must expand through qualified review.

## Responsive interaction

Desktop uses a completed-node rail, one generous question stage, and a small contextual media area. Editing and evidence use a focused right sheet.

Mobile keeps one question in the usable viewport. Completed nodes become a compact horizontal rail with a visible next-item peek. Editing uses a native modal bottom sheet with a grabber, Close action, Escape support, focus containment, and focus restoration.

## Visual system

- Cream, paper, peach, and pale pink surfaces.
- Tonal separation and shadow instead of decorative borders.
- Glass only on floating navigation or active sheet chrome, with solid fallbacks.
- Guidance sits beside photography on a solid surface, never directly over a face.
- People photography appears at the start, in contextual face/hair/body paths, beside care escalation, and near routine or product shelves.
- Use varied ages, genders, skin tones, skin variation, and hair textures without before-and-after claims.

## Accessibility contract

- Native forms, fieldsets, legends, radios, checkboxes, dialogs, and buttons.
- Focus moves to each new question heading.
- Only short status updates use `aria-live`.
- Back restores exact state.
- Sheets follow the [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Result tabs follow the [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- Minimum 44 px targets, visible focus, 4.5:1 small-text contrast, 200% zoom, and 320 px reflow.
- Hidden scrollbars still need a next-item peek, fade, or labeled controls.

## Implementation phases

1. Unify safety and privacy. Remove automatic health-data persistence, stop urgent requests before AI, and let one safety decision gate products.
2. Add a typed assessment graph and reducer with answer, back, edit, invalidate, interrupt, and complete transitions.
3. Replace the long result stack with Now, Routine, Products, and Why views.
4. Add contextual people photography and reduced-motion/reduced-transparency behavior.
5. Continue testing every branch with keyboard, screen reader, 320–1440 px layouts, slow network, browser Back, and an expanding qualified-review red-flag corpus.

Interaction references: [NHS textarea guidance](https://service-manual.nhs.uk/design-system/components/textarea), [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/), and [Apple sheets](https://developer.apple.com/design/human-interface-guidelines/sheets).
