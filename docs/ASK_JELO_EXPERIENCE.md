# Ask Jelo experience direction

Ask Jelo is a guided education canvas, not a chat transcript, diagnosis tool, or draggable flow editor.

## Product principles

- Show one active question at a time.
- Keep a compact trail of completed answers.
- Let people edit an earlier answer and invalidate only dependent answers.
- Run safety checks before products or any optional language layer.
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

A red flag replaces the normal journey with a concise care action and returns
zero products.

The current Ask Jelo care authority is fully deterministic. Safety and
condition paths project reviewed guidance, everyday-care paths use reviewed
product authority, and unclear descriptions ask for more detail. Only that last
branch may call Vercel AI Gateway to classify which neutral detail is missing.
The model returns an enum; JeloCare renders the reviewed question. With the
flag off or on any model, persistence, timeout, or schema failure, the original
deterministic questions are returned.

## Authenticated My JeloCare adapter

`/me/consult` renders the same `ConsultExperience` and submits to the same
reviewed `/api/consult` safety and guidance authority as public `/consult`. It
does not create a second engine or persist a transcript. The optional
clarification classifier follows the same privacy and safety boundary on both
surfaces.

Private member context is always excluded initially. A customer may explicitly
include saved Concern references or exact products currently on Shelf or in a
Routine for that session. The interface previews every included item before a
submission. The server ignores unknown Concern and product slugs, resolves
known products through the canonical catalogue, and supplies only their
verified ingredient identifiers to clinical screening. Retailer copy, public
marketing claims, and arbitrary client ingredient text cannot be promoted into
member product context through this adapter.

## Everyday care requests

An explicit, non-diagnostic request for everyday care does not need a disease-pattern result. Ask Jelo can route daily sun protection, ordinary sweat or body odour, dry or rough body skin, dry or frizzy hair, dry facial skin, sensitive-feeling skin, and oily skin to their canonical concern guides.

Products appear only when an explicit `supportive_eligible` product-care record
names the same canonical concern slug and its area and requested product step
are compatible. Legacy concern words, product names, catalogue copy, retailer
claims, and condition-pattern slugs cannot create a match.

The precedence is fixed:

1. Emergency and urgent signals stop the journey.
2. A directed clinical pattern or referral suppresses everyday care.
3. A supported everyday-care intent may reach reviewed product uses.
4. An unclear description asks for more detail.

Everyday-care results say what the person asked for rather than presenting a possible condition. They do not expose the low-confidence pattern scores used internally to check whether a safer route should take precedence.

Naming a product type does not make a description ordinary care. Rash, pain,
itch, burning, bleeding, swelling, discharge, hair loss, or a sudden
unexplained change suppresses this bridge even when the same sentence asks for
lotion, conditioner, deodorant, or sunscreen. The normal clarification or
directed-care path handles that description without ordinary-care products.

## Launch safety contract

- Emergency, condition-guide, ordinary-care, clarification, and referral copy is deterministic; the optional model selects only a clarification-focus enum.
- Serious working patterns surface their pharmacist, primary-care, or dermatology referral before clarification.
- A person under 18, including age stated in prose, stops before product guidance.
- Submitted allergies or medicines stop before product guidance because JeloCare does not evaluate allergy or medicine interactions.
- Reviewed server rules, not model output, resolve guides, authorize products, set urgency, and compose the public result.
- Public results contain only the guide, care steps, safe product fields,
  canonical source links, and session-only check-in fields. Rule identifiers,
  scores, ingredient internals, and recommendation diagnostics stay server-side.

The active AI Gateway cell is limited to clarification-focus classification.
It uses the existing production-fail-closed consult limiter, bounded input and
output, a two-model allowlist, zero-data-retention and no-training routing, and
an audited digest-only generation record. Guide resolution, product authority,
urgency, and displayed care remain outside the model. The exact rollback,
credential, model, cost, and failure boundaries are recorded in the
[Ask Jelo AI Gateway plan](./ai/ASK_JELO_GATEWAY_PLAN.md).

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

1. Unify safety and privacy. Remove automatic health-data persistence, stop urgent requests before product guidance, and let one safety decision gate products.
2. Add a typed assessment graph and reducer with answer, back, edit, invalidate, interrupt, and complete transitions.
3. Replace the long result stack with Now, Routine, Products, and Why views.
4. Add contextual people photography and reduced-motion/reduced-transparency behavior.
5. Continue testing every branch with keyboard, screen reader, 320–1440 px layouts, slow network, browser Back, and an expanding qualified-review red-flag corpus.

Interaction references: [NHS textarea guidance](https://service-manual.nhs.uk/design-system/components/textarea), [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/), and [Apple sheets](https://developer.apple.com/design/human-interface-guidelines/sheets).
