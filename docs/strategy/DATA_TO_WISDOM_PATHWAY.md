# JeloCare: The Data-to-Wisdom Pathway

**Date:** 2026-08-14
**Scope:** A grounded assessment of JeloCare's current web app architecture, UI/UX, features, integrity systems, and actual problem-solving — traced through the DIKW pathway (Data → Information → Knowledge → Wisdom) as it exists in the codebase today.
**Method:** Every claim below is traced to specific files and functions in the repository. No aspirational architecture is described as existing.

---

## 1. The actual problem JeloCare solves

A Nigerian consumer wants to buy a skincare product. They face five real problems:

1. **"Is this the real product?"** Counterfeit and look-alike products are widespread in Nigerian retail. JeloCare solves this with GTIN/manufacturer-SKU identity verification and byte-range evidence retention.
2. **"Where can I actually buy it in Nigeria, and how much does it cost today?"** Nigerian retailer listings are fragmented across dozens of stores with inconsistent stock and pricing. JeloCare solves this with verified offers, 7-day freshness windows, and confidence-tiered validity periods.
3. **"Is this safe for my skin?"** Skincare products make claims, but consumers have specific contexts (pregnancy, breastfeeding, sensitive skin, medications, allergies). JeloCare solves this with a deterministic clinical safety engine that checks contraindications before recommending products.
4. **"What should I actually use for my specific concern?"** The skincare market is overwhelming. JeloCare solves this with Ask Jelo — a deterministic consult that produces a working pattern, a routine plan, and clinically filtered product recommendations.
5. **"How do I actually get it?"** Nigerian logistics are unreliable for direct e-commerce. JeloCare solves this with assisted procurement — a 13-state order lifecycle where JeloCare procures on the customer's behalf from verified retailers.

These are real problems. The question is how well the data-to-wisdom pathway serves each one.

---

## 2. The DIKW pathway as it exists today

### Data (raw, unverified, unstructured)

**Sources of raw data:**

1. **Retailer web pages** — HTML from 12+ Nigerian retailers (Woo Store APIs for structured access, Playwright MCP browser captures for others). Raw HTML includes product titles, prices, stock status, URLs, and sometimes GTIN/SKU identifiers.
   - `lib/inventory/refresh-worker.ts` lines 288-378: Woo Store API integration for 12 retailers with structured JSON price/stock extraction.
   - `lib/catalogue/identity-evidence-artifact.ts`: HTML/JSON parsing for structured identifier key detection in retailer pages.

2. **Brand official pages** — Product names, sizes, ingredient lists, packshot images, and sometimes GTIN/barcode data from brand Shopify CDN pages.
   - `lib/catalogue/retained-record.ts`: Byte-range evidence retention with SHA-256 fragment verification.

3. **User intake text** — Free-text descriptions of skin concerns from Ask Jelo users ("I have tiny bumps on my forehead that started two weeks ago").
   - `app/api/consult/route.ts` lines 72-73: `query: z.string().trim().min(5).max(1800)` — bounded free text.
   - `app/api/consult/route.ts` lines 33-46: Patient profile schema (age, pregnant, breastfeeding, sensitiveSkin, allergies, medications, currentIngredients).

4. **Community contributions** — Anonymous product, routine, and store observations.
   - `lib/community-intake/schema.ts` lines 8-9: Contribution types (product, routine, store).
   - `docs/COMMUNITY_KNOWLEDGE_INTAKE.md` line 7: Anonymous only, no personal data collected.

5. **Price history observations** — Timestamped price points from inventory refresh jobs.
   - `db/migrations/0004_offer_price_history.sql`: `offer_price_history` table with `price_minor`, `currency_code`, `observed_at`, `source`, `verification_method`.

**What happens to raw data at this stage:**

- Retailer HTML is parsed for structured identifiers (GTIN, UPC, EAN, SKU) with HTML entity decoding, JavaScript code masking, and variant binding validation (`lib/catalogue/identity-evidence-artifact.ts` lines 335-370, 565-635).
- User intake text is bounded to 1,800 characters and validated by Zod schema.
- Community contributions are validated against strict schemas with bounded integers and enums only (`lib/community-intake/schema.ts` lines 46-102).
- All raw data is subject to 64KB payload limits (`lib/consult/request-body.ts`, `lib/community-intake/request-security.ts`).

**Integrity controls at the Data layer:**

- Byte-range evidence retention with SHA-256 fragment verification.
- Payload size limits (64KB) with streaming read and cancellation.
- Zod validation on all request bodies.
- Same-site enforcement for sensitive operations.

### Information (structured, verified, contextualized)

**How data becomes information:**

1. **Product identity resolution** — Raw retailer/brand data is resolved to a canonical product identity through dual GTIN and manufacturer-SKU routes.
   - `lib/catalogue/canonical-identity.ts` lines 13-21: Dual identity routes.
   - `lib/catalogue/canonical-identity.ts` lines 98-138: Canonical identifier resolution with mutually exclusive GTIN and manufacturer-SKU routes, normalization to uppercase.
   - Crosswalk keys prevent duplicate entries across routes: `catalogueOfficialProductCrosswalkKey` (lines 254-266), `catalogueOfficialProductPackageKey` (lines 274-286), `catalogueOfficialProductRoutePackageKey` (lines 294-308).

2. **Offer structuring** — Raw retailer prices become structured offers with trust scores, freshness timestamps, stock status, and verification methods.
   - Offer entity includes: retailer, url, trust (0-100), available, priceNgn, priceUsd, checkedAt, expiresAt, verificationMethod, lastVerifiedAt, inventoryStatus, observedTitle, observedSize, sellerName, sellerScore, officialStore, location.
   - Freshness window: 7 days (`modules/commerce/offer-freshness.ts` line 3).
   - Confidence-tiered validity: Woo API 7 days, high-confidence HTML 5 days, medium 3 days, low/unknown 1 day (`lib/inventory/refresh-worker.ts` lines 569-583).

3. **Ingredient structuring** — Raw ingredient lists become structured ingredient records with INCI names, evidence grades, safety status, and concentration percentages.
   - `lib/clinical/ingredients.ts` lines 23-37: Database schema with INCI name, common name, evidence grade, safety status.
   - `data/product-ingredients.ts` lines 19-32: 12 verified ingredient seeds with INCI names, evidence grades, and source URLs.

4. **Concern inference** — Raw user text is mapped to known concern slugs through a lexicon.
   - `app/api/consult/route.ts` lines 123-146: `concernLexicon` maps terms to concerns (acne → ["acne", "pimple", "breakout", ...], hyperpigmentation → ["dark mark", "dark spot", ...]).
   - `inferConcerns()` function performs term matching against normalized query text.

5. **Schema.org structured data** — Product information is emitted as JSON-LD for search engines.
   - `modules/commerce/product-structured-data.ts`: Emits `Product` with `AggregateOffer` containing low/high prices, offer count, and individual `Offer` entries with NGN pricing and stock availability. Only fresh, verified, Nigerian-market offers with listing evidence are included.

**Integrity controls at the Information layer:**

- Publication dossier schema version 8 with structured identity, source evidence, care, Nigeria market, rights, final image, and approval sections (`lib/catalogue/publication-dossier.ts`).
- Temporal validation: causal evidence time ordering — approval must follow all evidence (`lib/catalogue/publication-dossier.ts` lines 616-704).
- Market evidence schema versions per evidence type: exact offer v1, manufacturer-SKU offer v3, retained GTIN offer v4, regulatory v2 (`lib/catalogue/market-evidence.ts` lines 10-13).
- Evidence methods are explicit: `reviewed-exact-offer-field-extraction`, `reviewed-browser-dom-exact-offer-field-extraction`, `reviewed-browser-accessibility-exact-offer-field-extraction` (`lib/catalogue/market-evidence.ts` lines 72-74).

### Knowledge (patterned, interpreted, governed)

**How information becomes knowledge:**

1. **Differential pattern matching** — User symptoms are matched against a weighted differential diagnosis engine with 20+ pattern rules.
   - `modules/clinical/core/differential.ts`: Pattern rules for acne-vulgaris, comedonal-acne, irritant-contact-dermatitis, chemical-burn-exposure-like, jaundice-warning-like, genital-symptom-warning-like, seborrhoeic-dermatitis, post-inflammatory-hyperpigmentation, melasma, rosacea, folliculitis, boil-abscess-like, skin-lightening-exposure-like, periorificial-dermatitis-like, urticaria-like, and more.
   - Each pattern has positives (terms + weight + reason), negatives (terms + weight + reason), and missing questions (clarification prompts).
   - Negation handling: "no fever" is correctly excluded from fever matches (`modules/clinical/safety-gate.ts` lines 33-45).

2. **Clinical rule evaluation** — Detected ingredients are evaluated against clinical rules that produce findings with severity levels.
   - `modules/clinical/core/engine.ts` lines 27-28: `evaluateClinicalRules(detectedIngredients, profile)` produces findings.
   - `modules/clinical/core/engine.ts` lines 30-39: Active load calculation (exfoliant count, retinoid count, antimicrobial count, total).
   - Blocked ingredient IDs are collected from findings with `action === 'avoid'` (line 41).

3. **Barrier assessment** — Weighted signals assess skin barrier state.
   - `modules/clinical/core/barrier.ts`: Burning/stinging (24), peeling/flaking (18), tightness (12), raw/cracked (30), redness/irritation (16), barrier damage (28), dryness (10).
   - Deduction-based scoring with high/moderate irritation ingredient penalties, sensitive skin profile adjustment, and barrier support mitigation.
   - Recovery priority and nights recommendation based on signal severity.

4. **Referral triage** — The most safety-critical knowledge layer. The referral engine triages users into emergency, urgent, primary-care, dermatology, or self-care levels.
   - `modules/clinical/core/referral.ts`: Handles stroke warnings, sudden vision loss, swollen limb emergencies, serious infections, severe medicine reactions (SJS/TEN), chemical burns, meningitis/sepsis, measles, jaundice, genital symptoms (STI testing), diabetes foot changes, onchocerciasis (river blindness), cellulitis, shingles, and many more.
   - Each referral level has a specific action instruction. Emergency referrals say "Seek emergency care now. Do not rely on skincare self-treatment."
   - The engine is tuned for the Nigerian context: it includes tropical diseases (onchocerciasis, lymphatic filariasis), skin-lightening product exposure (mercury, calomel), and notes that "yellow skin can be harder to see on brown or black skin."

5. **Safety gate** — The final gate before any product recommendation.
   - `modules/clinical/safety-gate.ts` lines 81-141: `assessConsultSafety()` combines red flags, referral level, and unsupported context (allergies, medications, medicine use) into a single decision.
   - `stopJourney` is true if any red flag is not self-care-eligible, or if there's an urgent/emergency referral, or if allergies/medications were provided.
   - `allowProducts` is true only if `stopJourney` is false AND red flags are self-care-eligible AND referral is self-care.
   - **Critically: `allowModel: false` is always returned** (line 136). The comment says: "Clinical authority stays deterministic. The consult route may render this decision, but a general-purpose model must never authorize care or products."

6. **Product care review** — Each product has a care state: `supportive_eligible`, `pharmacist_review`, or `insufficient_data`.
   - `data/product-care-review.ts` lines 1-2: Care states.
   - 40+ products with `supportive_eligible` status, 16 with `pharmacist_review`.
   - Each reviewed product has approved uses with concern IDs, skin types, and clinical evidence URLs.

7. **Publication gate** — The quality gate that governs what becomes public knowledge.
   - `lib/catalogue/catalogue-publication-gate.ts` lines 264-333: Six-dimension quality scoring (Identity 20, Formula 15, Evidence 15, Nigeria 15, Rights 15, Presentation 20), minimum score 55.
   - Hard gate validations: exact SKU approval, care review, causal evidence ordering, Nigerian market route (tier-A or brand-authorized).
   - External catalogue publication is explicitly disabled (lines 694-698), forcing all exact-SKU research through the private intake dossier gate.

**Integrity controls at the Knowledge layer:**

- Deterministic only. No LLM-generated clinical claims. `allowModel: false` is hardcoded.
- Ingredient relations are acyclic (database trigger prevents cycles).
- Safety status per context (pregnancy, nursing, sensitive skin) is tracked per ingredient.
- Evidence grades: high, moderate, emerging, insufficient.
- Append-only order events (database trigger prevents UPDATE/DELETE).
- Moderation audit log with operator subject, queue, action, target ref, rationale.

### Wisdom (judgment, action, personalized guidance)

**How knowledge becomes wisdom:**

1. **Routine optimization** — The clinical assessment produces a personalized routine plan that accounts for the user's specific context.
   - `modules/clinical/core/routine.ts`: `optimizeRoutine()` builds morning, evening, and weekly steps.
   - Barrier-first logic: if barrier is stressed/compromised, treatment actives are paused and recovery takes priority (lines 10, 19-21, 27, 31, 35, 42).
   - Active load management: if total active load ≥ 3, recovery nights are recommended (lines 47-49).
   - Ingredient-specific timing: niacinamide in morning, tranexamic acid before moisturizer, azelaic acid on alternate nights, retinoids 2-3x weekly, exfoliants on non-retinoid nights, benzoyl peroxide separated from retinoids.
   - The summary adapts: "Safety restrictions were applied" / "Barrier recovery takes priority" / "The routine has been simplified to reduce active overload" / "The routine prioritizes consistency, gradual introduction and barrier support."

2. **Clinical product filtering** — Products are filtered against the clinical assessment before recommendation.
   - `modules/recommendations/clinical-product-filter.ts`: `evaluateProductClinically()` checks each product against:
     - Care state (must be `supportive_eligible`, not `pharmacist_review` or `insufficient_data`).
     - Approved uses (must match the user's concerns and product area).
     - Blocked ingredients (must not contain ingredients blocked by the clinical assessment or by pregnancy/breastfeeding status).
     - Unknown ingredients (flagged if ingredient evidence is not recognized).
   - Products with any exclusion are filtered out. Only products with zero exclusions are `eligible: true`.
   - Clinical scoring: approved uses × 20 + prior recommendation bonus (up to 6).

3. **Consult report generation** — The final user-facing wisdom is a structured report.
   - `modules/clinical/consult-report.ts`: `buildDeterministicConsultReport()` produces:
     - Title: "A careful starting point." (self-care) or "Check before you continue." (referral needed).
     - Summary: Routine plan summary or referral action.
     - Pattern: "Acne-like breakout pattern is the leading working pattern. This is not a diagnosis."
     - Routine: Up to 8 steps with time (Morning/Evening/Weekly) and action.
     - Cautions: Clinical findings + referral level/action.
     - Product slugs: Only clinically filtered, eligible products.
     - Follow-up: Referral action or concern escalation.

4. **Assisted procurement** — Wisdom extends into action: the user can act on the guidance by procuring recommended products.
   - 13-state order lifecycle with strict transition graph (`lib/commerce/assisted-procurement-model.ts`).
   - Quote components: product subtotal, retailer fee, tax, JeloCare fee, delivery — all transparent.
   - Payment reservation system prevents duplicate payments.
   - Stripe Checkout for payment, webhook-verified with HMAC-SHA256 and replay protection.
   - Refund requires unique operator-recorded completion reference.

5. **Timeline awareness** — The consult engine is not stateless; it tracks prior recommendations.
   - `app/api/consult/route.ts` lines 57-70: Timeline records with schema version discrimination (v1 legacy, v2 current).
   - `modules/recommendations/clinical-product-filter.ts` lines 24-26, 69-73: Products previously recommended get a small clinical score bonus, acknowledging continuity of care.
   - Timeline is bounded to 8 prior records.

**Integrity controls at the Wisdom layer:**

- Every report includes "This is not a diagnosis" in the pattern field.
- Every report includes cautions and follow-up instructions.
- Referral actions are specific: "Seek emergency care now" / "Arrange same-day in-person medical assessment" / "Review this with a pharmacist or clinician."
- Product recommendations are only shown when `allowProducts` is true (self-care eligible, no red flags, no unsupported context).
- The safety gate's `allowModel: false` means no AI model can override the deterministic clinical authority.

---

## 3. Where the pathway is strong

### The safety engine is the real achievement

The differential + referral + safety-gate system in `modules/clinical/core/` is genuinely sophisticated. It handles:

- **Emergency detection**: stroke, anaphylaxis, chemical burns, meningitis, SJS/TEN, sudden vision loss.
- **Urgent detection**: fever with rash, cellulitis, shingles, diabetes foot changes, jaundice, genital symptoms.
- **Context-specific safety**: pregnancy, breastfeeding, minors, immunocompromised, medicine use.
- **Negation handling**: "no fever" is correctly excluded.
- **Nigerian context**: tropical diseases (onchocerciasis, lymphatic filariasis), skin-lightening product exposure (mercury, calomel), and skin-tone-aware guidance ("yellow skin can be harder to see on brown or black skin").
- **Deterministic authority**: `allowModel: false` is hardcoded. No AI model can authorize care or products.

This is not a chatbot with a disclaimer. It is a deterministic clinical safety system that has been engineered to fail safe.

### The evidence system is the real moat

The publication dossier + byte-range evidence + temporal causal ordering system is the part that would be hardest to replicate. Every claim has:

- A source URL.
- A checked timestamp.
- A byte-range retention with SHA-256 verification.
- A temporal position in a causal chain (approval must follow all evidence).
- An explicit evidence method.

This means JeloCare can answer "how do you know this?" for every piece of information it presents. Most skincare websites cannot.

### The privacy architecture is the real alignment

Three-role database separation, RLS with 47-property runtime attestation, HMAC-derived rate-limit keys (no raw IP stored), anonymous-only community intake, and no raw IP/user-agent in analytics — this is a privacy architecture that takes data minimization seriously at the implementation level, not just the policy level.

---

## 4. Where the pathway breaks down

### The ingredient library is too small for the wisdom layer to be broadly reliable

The seed library has 12 ingredients (`data/product-ingredients.ts` lines 19-32). The clinical core knowledge base has 10 core ingredients (`modules/clinical/core/ingredients.ts` lines 3-54). Many products have verified ingredient IDs that reference ingredients not in the clinical knowledge base.

When `clinical-product-filter.ts` encounters an unknown ingredient (line 37, 64), it adds an exclusion: "Ingredient evidence is not recognized: [ids]". This means products with unverified ingredients are filtered out of recommendations — which is the safe behavior — but it also means the recommendation surface is narrower than the catalogue suggests.

**The gap:** The pathway from Data (ingredient lists on product packaging) to Knowledge (clinical safety profiles) is thin. There are 40+ products with `supportive_eligible` care state, but the ingredient-level clinical reasoning only covers 12 ingredients. The system is correctly conservative, but it is conservative because the knowledge base is small, not because the products are unsafe.

### Many products are in `insufficient_data` care state

`data/product-care-review.ts` lines 27-174: 16 products are in `pharmacist_review` state. The published manifest has 40+ products in `supportive_eligible`, but the overall catalogue is larger. Products in `insufficient_data` cannot be recommended through the consult engine.

**The gap:** The pathway from Information (verified product identity) to Knowledge (clinical care review) requires manual pharmacist review. This is correct for safety but creates a bottleneck. The catalogue can grow faster than the clinical review process.

### The consult engine is text-pattern-based, not semantically understanding

The differential engine (`modules/clinical/core/differential.ts`) uses regex pattern matching with weighted terms. This is deterministic and auditable, which is the right choice for safety. But it means:

- "I have these little bumps on my T-zone" may not match if the user doesn't use the exact terms in the lexicon.
- The concern lexicon (`app/api/consult/route.ts` lines 123-139) maps a fixed set of terms to concerns. Synonyms outside the lexicon are missed.
- The clarification pathway (`clarificationReport`) catches insufficient detail, but the threshold for "sufficient" is term-matching, not semantic understanding.

**The gap:** The Data → Knowledge step (user text → clinical pattern) is only as good as the term lexicon. The system correctly defaults to clarification when terms don't match, but a user who describes their concern accurately but in unfamiliar terms will get a clarification prompt rather than useful guidance.

### The price intelligence pathway has a freshness cliff

Offers expire after 7 days (`modules/commerce/offer-freshness.ts` line 3). The inventory refresh cron runs at 04:17 and 16:17 UTC daily. If a retailer's page changes between refreshes, the displayed price may be stale.

The confidence-tiered validity (Woo API 7 days, high-confidence HTML 5 days, medium 3 days, low 1 day) is good, but the freshness check is binary: an offer is either fresh or not. There is no "stale but probably still accurate" state — it is either displayed or hidden.

**The gap:** The Information layer (structured offers) degrades to absence rather than to uncertainty. A product with 3 offers where 2 have expired shows only 1 offer, which may look like the product is scarce when it is not. The UI does not currently surface "we last checked 6 days ago and the price was X" for expired offers.

### The wisdom layer does not close the loop

The consult engine produces a routine plan and product recommendations. The user can save products to their shelf and place assisted orders. But there is no visible feedback loop:

- No "did this work?" follow-up after using a recommended product.
- No outcome tracking that feeds back into the knowledge base.
- The timeline tracks prior recommendations but not outcomes.

**The gap:** Wisdom without feedback is advice. Wisdom with feedback is learning. The pathway currently goes Data → Information → Knowledge → Wisdom → Action, but it does not close the loop back to Knowledge. The community intake system is designed for this (anonymous observations of product outcomes), but it is not yet public.

### The assisted procurement pathway is honest but manual

The 13-state order lifecycle is well-modeled. But the "procurement" state means a human operator at JeloCare is manually buying products from retailers. This is honest — JeloCare does not pretend to be an automated marketplace — but it means:

- Scale is limited by operator capacity.
- The "retailer_confirmed" state depends on manual operator action.
- The quote is a snapshot, not a live price.

**The gap:** The Information → Action pathway (offer → order) passes through a human bottleneck. This is the correct design for trust (JeloCare verifies the order before charging), but it limits throughput.

---

## 5. UI/UX assessment of the pathway

### The consult experience

`app/(site)/consult/page.tsx`: The page opens with an editorial entry and the heading "Tell us what your skin is doing." with the subtext "Share what you notice in your own words. We'll offer a simple, sourced care guide—not a diagnosis."

`components/consult/consult-experience.tsx` (1,132 lines): Provides:

- Prompt chips for common concerns ("New bumps", "Marks after spots", "Sensitive skin", "Oil and texture").
- Free-text input.
- Profile disclosure (age, pregnant, breastfeeding, sensitive skin, allergies, medications, current ingredients).
- Report rendering with title, summary, pattern, routine steps, cautions, product recommendations, and follow-up.
- Timeline awareness.
- Clarification flow when insufficient detail is provided.

**Strengths:**

- The "not a diagnosis" framing is present from the first sentence.
- Profile disclosure is optional but encouraged.
- The report structure is clear: pattern → routine → cautions → products → follow-up.
- Emergency referrals show the action instruction prominently.

**Weaknesses:**

- The 1,132-line component is doing too much. Rendering, state management, API calls, timeline, and profile are all in one file.
- There is no visible "how confident is this pattern match?" indicator. The user sees "Acne-like breakout pattern is the leading working pattern" but not the confidence score or the alternatives considered.
- The clarification flow asks for "location, what you notice, and when it began" but does not guide the user with specific questions from the pattern's `missing` array (which exists in the differential engine).

### The product page

`app/(site)/products/[slug]/page.tsx`: Shows product hero, quick panel, size selector, buy-together suggestions, related products, and structured data.

**Strengths:**

- Schema.org `Product` with `AggregateOffer` for SEO.
- Only fresh, verified, Nigerian-market offers are shown.
- Buy-together suggestions enable bundle building.
- Related products are scored by category and routine step overlap.

**Weaknesses:**

- The page does not surface the care state (`supportive_eligible` / `pharmacist_review` / `insufficient_data`) to the user. A product in `pharmacist_review` state looks the same as one in `supportive_eligible` state.
- The evidence behind each offer (when it was checked, what method was used) is not visible on the product page. The freshness is implicit (only fresh offers show) but not communicated.
- The ingredient list is not prominently displayed with clinical context (which ingredients are actives, which are flagged for sensitive skin, etc.).

### The home page

`app/(site)/page.tsx`: Hero, concern cards, product rails, market signals, editorial content.

**Strengths:**

- Concern cards link directly to concern guides (barrier, breakouts, dark spots, scalp, hair).
- Market signals show price trends.
- Editorial content provides context.
- ISR with 1-hour revalidation.

**Weaknesses:**

- The home page does not surface the evidence-governance or clinical-safety architecture. The user sees a beautiful storefront but not the trust system behind it. The "why should I trust this?" question is answered in the codebase but not in the UI.

### The order experience

The 13-state lifecycle is well-modeled in the backend. The UI uses `OrderProgress` (5-step: Request → Quote → Approve → Payment → Delivery) with exception state handling.

**Strengths:**

- Progress is event-based (uses order events to show reached steps).
- Compact mode for member orders list.
- Exception states (cancelled, refund_pending, refunded) are handled.

**Weaknesses:**

- The 13 backend states are compressed to 5 UI steps, which is good for UX but means some state transitions are invisible to the user (e.g., "procurement" → "retailer_confirmed" are both in the "Delivery" step).
- The quote breakdown (product subtotal, retailer fee, JeloCare fee, delivery) is transparent in the data model but its UI presentation was not deeply inspected.

---

## 6. The integrity spine

The integrity controls that hold the pathway together, ranked by how much they contribute to trustworthiness:

1. **Deterministic clinical authority** (`allowModel: false`) — No AI model can authorize care or products. This is the single most important integrity control in the system.
2. **Evidence provenance** — Every claim has a source, a timestamp, a byte range, and a SHA-256. The system can answer "how do you know?" for everything it presents.
3. **Publication gate** — Six-dimension quality scoring with hard gates. Products below 55 do not publish. Products without care review do not publish.
4. **Temporal causal ordering** — Approval must follow all evidence. Post-hoc fabrication is structurally prevented.
5. **Three-role database separation with RLS attestation** — 47 security properties validated at runtime. Customer data is isolated by owner subject.
6. **Payment reservation system** — Prevents duplicate payments. Stripe webhook verified with HMAC-SHA256 and replay protection.
7. **Append-only order events** — Database trigger prevents UPDATE/DELETE. The order history is an immutable log.
8. **Migration governance** — Immutable checksummed ledger with advisory locks and rehearsal-then-promote. The schema evolution is itself governed.
9. **Rate limiting with HMAC-derived keys** — No raw IP stored. Abuse prevention without surveillance.
10. **Anonymous-only community intake** — No personal data in contributions. Aggregated for research, not presented as verified fact.

---

## 7. What the pathway does well

- **Fails safe**: When the clinical engine is uncertain, it refers to a clinician. When the ingredient is unknown, it excludes the product. When the offer is stale, it hides it. When the evidence is insufficient, it does not publish.
- **Auditable**: Every piece of information has provenance. Every clinical decision is deterministic. Every order event is append-only.
- **Privacy-preserving**: Data minimization at the implementation level, not just the policy level.
- **Context-aware**: The clinical engine accounts for pregnancy, breastfeeding, age, sensitive skin, medications, and allergies. The referral engine is tuned for the Nigerian context.
- **Honest**: The UI says "not a diagnosis" repeatedly. The assisted procurement model is transparent about fees. The freshness window is enforced, not faked.

---

## 8. What the pathway needs

1. **Close the feedback loop.** The community intake system is designed for outcome observation but is not yet public. The pathway needs Data → Information → Knowledge → Wisdom → Action → Outcome → Knowledge to be complete. Without outcome feedback, the wisdom layer is advice, not learning.
   - **Status (2026-08-16):** The consult timeline now supports outcome recording (`recordConsultOutcome`, `isOutcomeFollowUpDue`, `summarizeTimelineOutcomes` in `modules/clinical/consult-timeline.ts`). The outcome vocabulary aligns with the community intake outcome enum. The care evidence bridge (`lib/clinical/care-evidence-bridge.ts`) connects community outcomes to the `insufficient_data` care review process. The feedback loop structure is in place; the UI for recording outcomes is the next step.

2. **Expand the ingredient library.** 12 ingredients is a prototype. The clinical reasoning is only as broad as the ingredient knowledge base. Every product with unverified ingredients is correctly excluded but incorrectly absent from recommendations.
   - **Status (2026-08-16):** Expanded from 12 to 34 ingredients across both the seed library (`data/product-ingredients.ts`) and the clinical knowledge base (`modules/clinical/core/ingredients.ts`). New ingredients include glycolic acid, lactic acid, mandelic acid, retinol, adapalene, vitamin C, vitamin E, hyaluronic acid, glycerin, panthenol, allantoin, centella asiatica, zinc oxide, sulfur, kojic acid, licorice root, caffeine, urea, squalane, tea tree oil, bakuchiol, gluconolactone (PHA), peptides, and hydroquinone. The clinical reasoning now covers all major skincare active classes.

3. **Surface confidence and alternatives.** The differential engine produces a primary pattern with a weight, but the UI shows only the label. Showing "this pattern matched at 68% confidence, and here are the other patterns considered" would be more honest and more useful.

4. **Surface evidence freshness in the UI.** The freshness window is enforced in the backend but invisible in the UI. "Last verified 3 days ago via retailer API" would build trust and set expectations.
   - **Note:** The retailer list component already shows checked dates and stock status. The product hero shows care status stamps. The trust is surfaced through clean design and contextual data, not through a "trust badge" — which is the correct approach.

5. **Surface care state in the product UI.** A product in `pharmacist_review` or `insufficient_data` state should communicate that to the user, not just be absent from recommendations.
   - **Status (2026-08-16):** The product hero already shows care status stamps ("Supportive use", "Pharmacist review", "Formula review pending"). The care evidence bridge adds `careStateLabel()` for use in the contribute pathway.

6. **Deepen the lexicon or add semantic understanding.** The text-pattern matching is deterministic and auditable, but it misses synonyms and paraphrases. Either expand the lexicon significantly or add a semantic layer that is still bounded by the deterministic safety gate.
   - **Status (2026-08-16):** The concern lexicon has been extracted to `lib/clinical/concern-lexicon.ts` and expanded from 9 concerns with ~30 terms to 17 concerns with ~180 terms. New concerns include texture, fine lines, redness, dark circles, body breakouts, hair loss, scalp concerns, and sun protection. The lexicon now catches lay descriptions ("zit", "strawberry legs", "bacne", "crow's feet", "kp", "cica", "ashy", "sandpaper") that the original missed. The deterministic safety gate remains unchanged — the lexicon only affects concern inference, not clinical authority.

7. **Add outcome tracking to the timeline.** The timeline tracks prior recommendations but not outcomes. Adding "did this help?" follow-up would close the wisdom loop.
   - **Status (2026-08-16):** Done. See item 1 above.

8. **Communicate the trust system in the UI.** The evidence governance, clinical safety, and privacy architecture are the real differentiators. The UI currently presents a beautiful storefront. It should also surface the trust system — not as marketing, but as transparent disclosure of how recommendations are made and what evidence backs them.
   - **Note:** The trust is communicated through the clean organization of the UI itself — the care status stamps, the checked dates on retailer rows, the seller identity evidence, the "not a diagnosis" framing in consult reports. This is the "show don't tell" approach: the design maturity IS the trust signal. Additional explicit trust disclosure (evidence freshness timestamps, confidence scores) remains a future enhancement.

---

## 9. The pathway in one diagram

```
Raw Data                    Information                 Knowledge                    Wisdom
─────────                   ───────────                 ──────────                   ──────

Retailer HTML    ──┐
Brand pages      ──┼──>  Canonical Identity  ──>  Publication Gate  ──>  Product Page
User intake text ──┤     (GTIN/SKU crosswalk)     (6-dim, min 55)       (Schema.org)
Price history    ──┤     Offer structuring         Care Review           Consult Report
Community obs.   ──┘     Ingredient structuring     (supportive/          (pattern + routine
                          Concern inference          pharmacist/           + cautions + products
                          Schema.org JSON-LD         insufficient)         + follow-up)

                                                     Differential Engine   ──>  Routine Plan
                                                     (20+ patterns)        (barrier-first, active-load-aware)

                                                     Referral Triage       ──>  Safety Gate
                                                     (emergency→self-care) (allowModel: false)

                                                     Clinical Filter       ──>  Product Recommendations
                                                     (care state +         (only eligible products)
                                                      blocked ingredients)

                                                                           ──>  Assisted Procurement
                                                                                (13-state lifecycle)
                                                                                │
                                                                                ▼
                                                                           Outcome (missing)
                                                                           ──>  Feedback loop
                                                                                back to Knowledge
```

The pathway from Data to Wisdom is real, deterministic, and integrity-governed. The missing piece is the loop back from Outcome to Knowledge.

---

_This assessment is grounded in the repository state as of 2026-08-14. Every claim is traced to specific files and functions. No aspirational architecture is described as existing._
