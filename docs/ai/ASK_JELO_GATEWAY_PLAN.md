# Ask Jelo AI Gateway plan

Updated: 2026-08-13

## Implementation status

Phase 1 is implemented as an explicitly flagged intake shadow on the existing
`/api/consult` route. The deterministic emergency gate runs first. Only an
ordinary-care, clarification, or guide-only outcome may schedule the shadow,
and the customer receives the unchanged deterministic response without waiting
for it.

The shadow uses `ASK_JELO_AI_INTAKE_SHADOW=true` plus the reviewed
`ASK_JELO_INTAKE_MODEL=openai/gpt-5.6-terra` configuration. It requests one
strict non-clinical object through AI Gateway with zero-data-retention and
prompt-training disabled. Before the call, JeloCare creates a pending
`consult_ai_generations` row. The row stores only a SHA-256 digest and character
count for the customer text, the deterministic outcome class, the constrained
proposal, token usage, exact Gateway cost metadata when supplied, latency, and
settlement state. Raw health text, member context, contact data, and customer-
visible wording are not persisted in this lane. Retention is 30 days.

Turning the flag off is the complete rollback. Phase 1 does not authorize model
wording, guide selection, product selection, urgency, voice, concern writes, or
orders.

Ask Jelo remains deterministic today. The first AI release should improve
intake and wording without giving a model clinical, product, urgency, or state
authority. Vercel AI Gateway is the single provider boundary; direct provider
SDKs and browser-exposed keys are excluded.

## Authority split

```text
typed or transcribed customer words
  -> bounded input and deterministic emergency/safety gate
  -> language model proposes structured interpretation and one clarification
  -> deterministic JeloCare guide/product authority resolves the result
  -> language model may rewrite only the already-approved presentation fields
  -> deterministic validator removes any unsupported claim or product
```

The model cannot select a condition guide, change urgency, authorize a product,
invent care, infer pregnancy/medicine compatibility, persist a concern, place
an order, or call a retailer. Existing reviewed rules and source-backed data
remain the source of truth.

## Gateway and model selection

Use the Vercel AI SDK already installed in the application and a Gateway model
identifier supplied by server-only environment configuration:

| Variable | Purpose | Initial class |
| --- | --- | --- |
| `ASK_JELO_INTAKE_MODEL` | Short structured extraction and clarification | Fast, low-cost text model; current candidate `openai/gpt-5.6-terra` |
| `ASK_JELO_WORDING_MODEL` | Carefully bounded final explanation from approved facts | Higher-reasoning text model; current candidate `openai/gpt-5.6-sol` |
| `ASK_JELO_TRANSCRIPTION_MODEL` | Optional speech-to-text only | Gateway-supported transcription model selected at implementation review |

Model names are configuration, not hard-coded clinical policy. Before release,
verify each configured identifier against the live Gateway model catalogue and
pin the accepted fallback order. Gateway routing may fail over between approved
providers of the same model class; it may not silently fall back to a model
outside the tested allowlist.

On Vercel, prefer project OIDC (`VERCEL_OIDC_TOKEN`) when supported by the
Gateway runtime. Use `AI_GATEWAY_API_KEY` only as the server-only local or
explicit fallback credential. Neither value is `NEXT_PUBLIC_*`, logged,
returned, or placed in provider metadata. Configure separate Preview and
Production values and budgets.

Every request carries privacy-safe operational metadata only: route version,
schema version, anonymous request ID, selected model lane, latency, token use,
and outcome class. Do not send email, phone, address, raw IP, order data, Shelf,
Routine, saved concerns, or a transcript identifier as Gateway tags. Signed-in
context remains explicit opt-in and is reduced to the already-approved public
product fields before a model sees it.

## Structured contracts

The intake call returns a strict schema such as:

- normalized body area from an allowlist;
- observable terms copied or conservatively normalized from the customer;
- requested care step or product type from an allowlist;
- one clarification question when required; and
- `cannot_interpret` when the schema cannot be satisfied.

It returns no diagnosis, urgency, guide slug, product slug, treatment, or prose
advice. The deterministic engine receives the original bounded text plus this
untrusted proposal and makes the actual decision.

The wording call receives only the engine's approved result projection and a
fixed output schema. A post-validator requires every guide, care step, product,
source, warning, and referral to match that projection exactly. On timeout,
provider failure, schema failure, unsupported wording, or budget exhaustion,
serve the current deterministic result unchanged.

## Voice intake

Voice is an input convenience, not a separate consultation engine.

1. The browser records only after explicit action and shows recording state.
2. The server accepts a bounded MIME allowlist, byte limit, and duration limit.
3. Audio is sent server-to-server for transcription and is not retained by
   JeloCare after the response.
4. The customer reviews or edits the transcript before submitting it to the
   same deterministic safety and intake path as typed text.
5. Transcription confidence or failure never changes urgency; unclear speech
   asks the person to type or try again.

Provider retention and training settings must be reviewed before enabling
voice. Until then, the transcription route remains absent.

## Runtime shape

- Keep `/api/consult` as the single public authority. Add model calls behind an
  explicit server feature flag and schema version, not a second recommendation
  endpoint.
- Stream optional wording only after the deterministic result exists. Preserve
  the non-streamed deterministic response for assistive technology and failure.
- Use existing Upstash production-fail-closed abuse control, with a separate
  model-cost allowance and hard per-request token/output limits.
- Do not cache personal prompts or generated wording. Cache only public,
  versioned static system instructions if the selected provider supports it.
- Ordinary request/response execution is sufficient. Use Vercel Workflow only
  for a future task that genuinely must survive beyond the request, such as a
  reviewed asynchronous human follow-up; do not introduce it for chat turns.

## Release sequence

1. Structured intake shadow mode on the existing regression corpus; no output
   reaches customers.
2. Compare model proposals with deterministic resolutions, including emergency,
   under-18, medicine/allergy, ambiguity, prompt-injection, and unsupported-
   product cases.
3. Enable intake for a small Preview cohort; deterministic output remains the
   customer result.
4. Enable bounded wording only after source/claim equivalence, accessibility,
   latency, cost, and failure tests pass.
5. Add voice last, after audio privacy, retention, upload abuse, and transcript
   confirmation pass.

Rollback is one server flag: stop model calls and serve the current deterministic
Ask Jelo result. No customer care record or order can depend on a generation.

Official references: [Vercel AI Gateway](https://vercel.com/docs/ai-gateway),
[Vercel AI SDK](https://ai-sdk.dev/docs), and
[Vercel OIDC](https://vercel.com/docs/oidc).
