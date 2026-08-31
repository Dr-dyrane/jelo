# ADR 0011: Guide resolution and clinical product authority stay separate

Status: Accepted

Date: 2026-07-27

## Context

JeloCare has 58 public concern guides, a deterministic Ask Jelo pattern
registry, and a reviewed 52-product catalogue. The individual boundaries are
strong: every condition pattern has no product terms, direct recommendations
require a reviewed care state, and urgent paths can stop model and product
output.

The remaining risk is at the joins between those systems. A July 2026
cross-surface audit found that:

- ordinary vocabulary such as `flaky` could authorize generic dryness products
  even when the person explicitly described an itchy scalp;
- condition-shaped queries could enter a generic routine and model-backed
  product selector instead of using the published guide's care;
- an oral medicine mention such as tranexamic-acid tablets could be interpreted
  as a topical ingredient instruction;
- an exact condition-guide search with no matching products could still offer a
  `missing_product` contribution;
- search typeahead exposed only a small subset of guides and could put
  pharmacist-review products ahead of the acne guide; and
- urgent guide actions were stored in escalation copy but presented after
  optional care.

These are authority errors, not merely copy or ranking issues. The application
must decide whether the person needs a guide, ordinary product discovery, or
time-sensitive human care before it ranks any product.

## Decision

JeloCare will use three explicit, non-interchangeable authorities.

### 1. Guide resolution

A public concern or condition guide resolves an observed-pattern or education
query. An exact guide match ranks before product suggestions. When a guide
matches and no eligible product does, the guide is the answer; the interface
must not describe the query as a missing product or invite a product
submission.

Every published guide is eligible for typeahead and route resolution. A
condition-pattern guide may appear in navigation, search, and education, but
never in a product facet that implies suitability.

### 2. Ordinary product eligibility

Products can appear as care guidance only when all of the following are true:

1. the request resolves to a canonical ordinary guide whose `kind` is
   `concern`;
2. the care intent emits that guide's canonical `concernSlugs` value;
3. the product-care manifest explicitly approves the same slug;
4. the product is `supportive_eligible`;
5. the product's body area, category, and requested routine step are compatible;
6. no red flag, condition pattern, medication context, or unresolved symptom
   language has taken precedence.

Raw lexicon IDs, catalogue marketing text, ingredient names, community volume,
and model output have no product-authorizing power. A pharmacist-review product
may appear only as clearly labelled catalogue context; it is not a direct
recommendation.

### 3. Condition and urgent-care authority

A condition-shaped path consumes reviewed guide care deterministically. It
returns no products and makes no model call. When the evidence is sufficient,
its public copy may state JeloCare's best supported possible explanation while
making the uncertainty and any need for examination or testing clear. It must
not present an unverified cause as confirmed.

Guide care is ordered by urgency:

1. emergency or same-day action under **What to do now**;
2. prompt clinician or pharmacist action;
3. safe self-care while waiting, when applicable;
4. supporting explanation and sources.

Urgent action is never rendered as one optional card after cosmetic care.
Self-care patterns such as prickly bumps after heat or shaving-related bumps
still use their own guide care rather than a generic
cleanser/moisturiser/sunscreen routine.

### Medication context

An ingredient token inside oral or prescribed-medicine language is a medicine
mention, not a topical request. Words and structures such as `tablet`,
`capsule`, `taking`, `I take`, `prescribed`, `dose`, and `for heavy periods`
must suppress topical-use instructions for that mention. JeloCare may advise
the person to check with the relevant prescriber or pharmacist; it must not turn
the medicine into “apply … to your skin.”

This rule is especially important for tranexamic acid, which may be prescribed
or taken orally for bleeding. Product or ingredient education must require
explicitly topical context before it describes application.

### Public response boundary

The public Ask Jelo response contains the information needed to render the
assessment, care actions, uncertainty, timing, sources, and eligible products.
It may include a plain-language possible explanation, other reasonable
possibilities, and the observations that support the assessment. Internal
differential IDs, numeric scores, prompt text, and model diagnostics are not
public UI data.

Ask Jelo may call the bounded AI Gateway intake classifier only after
deterministic code has selected clarification. The model returns a
missing-detail enum and cannot supply displayed prose. Condition paths,
products, urgency, and care remain outside the model. Any future language-only
lane still requires a separate reviewed boundary.

## Lane contract

| Lane                         | Owns                                                                                                       | Must preserve                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `consult-safety-p0`          | Ask Jelo routing, care projection, medication context, API response and regression tests                   | Same-site and rate-limit controls, emergency precedence, evidence-bound assessment voice, zero products/model calls for condition paths |
| `catalogue-guide-resolution` | Product-search guide suggestions, exact-guide ranking, no-result handoff, query-param resolution and tests | Direct-product eligibility boundary, public catalogue projection privacy, community intake trust boundary                               |
| `concern-urgency-ui`         | Guide urgency metadata, static concern composition, source parity and rendering tests                      | Stable guide slugs/routes, `productTerms: []` for condition patterns, inclusive observable language                                     |
| `catalogue-product-lane`     | Product evidence, release dossiers, prices and packshots                                                   | This ADR's authority rules; catalogue growth does not wait for unrelated guide UI work                                                  |

These lanes may run in parallel only while their owned paths remain disjoint.
Any shared clinical contract change is reconciled through one integration pass
before release.

## Required regression evidence

At minimum, release tests must prove:

- “dandruff and an itchy flaky scalp” returns no Face products;
- heat- or shaving-shaped condition queries use guide care with zero products
  and zero model calls;
- “I take tranexamic acid tablets for heavy periods” never produces a topical
  application instruction;
- an exact condition-guide search never creates a missing-product handoff;
- `acne` exposes the guide before pharmacist-review catalogue context;
- urgent guide pages render time-sensitive action first; and
- ordinary care still reaches only explicitly reviewed, area-compatible
  supportive products.

Run lint, typecheck, focused clinical/search/guide tests, the complete release
gate, production build, and browser checks for the affected public journeys.

## Consequences

- Search, guides, Ask Jelo, and product discovery can share vocabulary without
  sharing authority.
- Product growth can continue independently because condition guides do not
  become catalogue blockers or recommendation inputs.
- Public guidance has no paid-model runtime or provider dependency.
- More searches end in a useful guide instead of an inaccurate product request.
- Urgent routes become visually and semantically harder to miss.
- New guides require route, care, source, urgency, and reverse-parity tests
  before publication.

## Alternatives rejected

- **Let the model choose products for unresolved symptoms.** Rejected because a
  plausible product list is not reviewed clinical authority.
- **Use raw keyword overlap as ordinary-care intent.** Rejected because words
  such as `flaky`, `dry`, or an ingredient name lose body-area and medication
  context.
- **Treat every zero-product query as product demand.** Rejected because many
  exact guide searches are already resolved educationally.
- **Hide pharmacist-review products entirely.** Rejected. They may remain
  discoverable as neutral catalogue context, with an explicit review label,
  while staying outside direct recommendations.
- **Present a guide title as a confirmed diagnosis.** Rejected. JeloCare may
  state the most likely explanation, but it continues to show uncertainty and
  say when an examination or test is needed to settle the cause.
