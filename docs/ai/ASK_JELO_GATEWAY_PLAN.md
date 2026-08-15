# Ask Jelo AI Gateway plan

Updated: 2026-08-13

## Implementation status

The first customer-facing cell is implemented on the existing `/api/consult`
route shared by public Ask Jelo and authenticated Ask Me. The deterministic
emergency and care engine always runs first. AI Gateway is awaited only when
that engine has already decided that more detail is required. The model may
select one missing-detail enum; JeloCare maps that enum to reviewed neutral
question copy. Model prose is never displayed.

The compatibility flag `ASK_JELO_AI_INTAKE_SHADOW=true` enables this bounded
intake cell, and turning it off is the complete rollback. The primary model is
the server-only `ASK_JELO_INTAKE_MODEL=google/gemini-2.5-flash-lite`. One
reviewed cross-provider fallback is accepted through
`ASK_JELO_INTAKE_FALLBACK_MODEL`; it defaults to
`openai/gpt-5.4-nano`. Unknown primary or fallback identifiers disable the AI
cell and serve the unchanged deterministic clarification.

Every call requests one strict non-clinical schema through AI Gateway with
zero-data-retention and prompt-training disabled, no SDK retry, an eight-second
total timeout, a 220-token output ceiling, and one fallback at most. Before the
call, JeloCare creates a pending `consult_ai_generations` row. The row stores
only a SHA-256 digest and character count for the customer text, the
deterministic outcome class, the constrained proposal, token usage, exact
Gateway cost metadata when supplied, latency, and settlement state. Raw health
text, member context, contact data, and customer-visible wording are not
persisted. Retention is 30 days. The historical database lane name remains
`intake_shadow`, but schema version 2 records that its enum can select a
JeloCare-owned clarification question.

Persistence failure, Gateway authentication or provider failure, timeout,
fallback exhaustion, or schema failure all return the original deterministic
clarification. This cell does not authorize model wording, guide selection,
product selection, urgency, voice, concern writes, or orders.

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

| Variable                         | Purpose                                                 | Initial class                                                           |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ASK_JELO_INTAKE_MODEL`          | Short structured clarification classification           | Primary `google/gemini-2.5-flash-lite`                                  |
| `ASK_JELO_INTAKE_FALLBACK_MODEL` | One bounded cross-provider fallback                     | Default `openai/gpt-5.4-nano`; unknown identifiers disable the cell     |
| `ASK_JELO_WORDING_MODEL`         | Carefully bounded final explanation from approved facts | Higher-reasoning text model; current candidate `openai/gpt-5.6-sol`     |
| `ASK_JELO_TRANSCRIPTION_MODEL`   | Optional speech-to-text only                            | Gateway-supported transcription model selected at implementation review |

Model names are configuration, not clinical policy. The accepted two-model
allowlist and fallback order are pinned in code and verified against the live
Gateway model catalogue. Gateway routing may fail over between approved
providers of the same model, but it cannot select a model outside the allowlist.

As checked on 2026-08-14, Vercel lists Gemini 2.5 Flash Lite at $0.10 per
million input tokens and $0.40 per million output tokens, and GPT-5.4 Nano at
$0.20 and $1.25 respectively. Vercel includes $5 of monthly Gateway credit for
free-tier teams; that is a credit allowance, not a permanently free model.
See the official [Gemini 2.5 Flash Lite model page](https://vercel.com/ai-gateway/models/gemini-2.5-flash-lite),
[GPT-5.4 Nano model page](https://vercel.com/ai-gateway/models/gpt-5.4-nano),
and [Gateway pricing](https://vercel.com/docs/ai-gateway/pricing).

Vercel deployments authenticate through the automatically provided project OIDC
token. `AI_GATEWAY_API_KEY` is only a server-only local fallback credential.
Neither value is `NEXT_PUBLIC_*`, logged, returned, or placed in provider
metadata. Production and Preview already carry the intake flag and primary
model configuration; local live-model testing requires a fresh OIDC token from
`vercel env pull` or a server-only Gateway key. See [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok).

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
- one missing-detail focus from a fixed allowlist; and
- `cannot_interpret` when the schema cannot be satisfied.

It returns no diagnosis, urgency, guide slug, product slug, treatment,
customer-visible question, or prose advice. The deterministic engine has
already made the outcome decision. Only its clarification branch may map the
untrusted focus enum to JeloCare-owned copy.

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

1. Structured intake shadow mode on the existing regression corpus; completed.
2. Customer-facing clarification-focus classification behind the same rollback
   flag; implemented without model prose or care authority.
3. Compare the active focus choices with deterministic fallback questions,
   including emergency, under-18, medicine/allergy, ambiguity,
   prompt-injection, timeout, persistence failure, and fallback exhaustion.
4. Enable bounded wording only after source/claim equivalence, accessibility,
   latency, cost, and failure tests pass.
5. Add voice last, after audio privacy, retention, upload abuse, and transcript
   confirmation pass.

Rollback is one server flag: stop model calls and serve the current deterministic
Ask Jelo result. No customer care record or order can depend on a generation.

Official references: [Vercel AI Gateway](https://vercel.com/docs/ai-gateway),
[Vercel AI SDK](https://ai-sdk.dev/docs), and
[Vercel OIDC](https://vercel.com/docs/oidc).
