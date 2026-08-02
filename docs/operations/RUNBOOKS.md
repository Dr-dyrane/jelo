# Operational runbooks

Updated: 2026-07-26

Lead with evidence. Preserve data. Prefer a forward repair.

## Production build fails

1. Identify the exact deployment and commit.
2. Read the first real failing command, not only the final exit code.
3. Reproduce with the same environment boundary.
4. If CI passed but production failed, inspect migrations, staged asset promotion, seeds, and service credentials.
5. Fix the cause in a small commit.
6. Re-run local gates and verify the next exact deployment.

Do not disable migrations to conceal a bad migration.

## A preview lane closes

The lane that creates a preview owns its cleanup. Preview resources are
temporary; production releases and rollback history follow a separate retention
decision.

Protect these before resolving deletion targets:

- Git `main`, `pages-v1-static`, and the `pages-v1.0` tag;
- the Neon primary/default `main` branch;
- the current production deployment;
- `jelocare.com`, `www.jelocare.com`, the stable Vercel project/main aliases,
  and the localhost origins intentionally used by Ops.

Then:

1. Run `git fetch --prune` and prove the feature branch is merged before
   deleting its remote ref.
2. List Vercel Preview deployments and aliases. Remove only the closed lane's
   Preview deployments and branch aliases.
3. List Neon branches. Delete the corresponding non-primary preview branch,
   including its compute and Auth instance.
4. List Neon Auth trusted domains on `main`. Remove immutable deployment
   origins that are no longer current; retain only the approved stable origins,
   localhost development origins, and the current production deployment origin.
5. Re-list Git, Vercel, Neon branches, and trusted domains. A delete request is
   not evidence that cleanup finished.
6. Smoke-test the custom domain and the exact production commit.

Useful read-only inventory commands:

```bash
git ls-remote --heads origin
vercel ls --environment preview --format json --limit 100
vercel alias ls
neonctl branches list --project-id "$NEON_PROJECT_ID" --output json
neonctl neon-auth domain list \
  --project-id "$NEON_PROJECT_ID" \
  --branch main \
  --output json
```

Do not bulk-delete production deployments while cleaning previews. Establish and
record a production retention window first so rollback evidence is preserved.
If the Neon plan refuses branch protection, record that provider limitation;
never unprotect an unrelated project to make room silently.

## Neon is unavailable

Expected public behavior: catalogue reads fall back to reviewed static data.

1. Confirm the failure is Neon, not application query logic.
2. Check project and branch health in Neon.
3. Confirm the production connection variable names and scope.
4. Avoid repeated write operators.
5. Verify the public fallback.
6. After recovery, run inventory, price, clinical, and asset audits.

Community and retailer intake should return a temporary unavailable response rather than pretend to save.

## A migration fails

1. Record the migration filename and PostgreSQL error.
2. Confirm it is absent from `schema_migrations`.
3. Inspect whether PostgreSQL committed any non-transactional side effect.
4. If the migration was never shared or applied, repair it.
5. Otherwise add a new forward migration.
6. Rehearse on a Neon branch before production.

## Operator access cannot be changed

1. Confirm the signed-in operator is an active admin. Do not bypass the role
   check or edit an auth subject in the browser.
2. Confirm migration `0025_operator_access_lifecycle.sql` is present in
   `schema_migrations`. Before it is applied, the directory intentionally
   remains readable and all access mutations fail closed.
3. For a pending invitation, confirm the normalized invited email exactly
   matches the mailbox Neon Auth verified. Never synthesize a subject from an
   email address.
4. If delivery failed, keep the pending invitation and retry from its inspector
   after checking the configured mail transport. Do not create a duplicate.
5. If a role or pause action is refused, check the self-lockout and last-active-
   admin guards before investigating the database.
6. Confirm the resulting event in `moderation_operator_access_audit`. Corrective
   work is a new audited action; never rewrite the access trail.

## Catalogue count or queue drifts

```bash
npm run catalogue:pipeline:status
npm run catalogue:intake:audit
npm run catalogue:research:verify
npm test
```

If the research queue differs, rebuild it with its operator. Do not hand-edit the projection.

## Product image looks clipped or opaque

1. Remove it from public consideration if identity or package completeness is uncertain.
2. Compare the public Blob bytes with the recorded hash and dimensions.
3. Inspect alpha and silhouette audits.
4. Review on peach, pink, and dark surfaces.
5. Re-run the exact-SKU preparation path from a traceable source.
6. Update the candidate and release only through the normal gate.

Never heal a mismatched package with generation.

## Price or stock looks wrong

1. Open the exact retailer page.
2. Confirm final URL, title, variant, size, seller, currency, price, stock, and observation time.
3. Check whether the public observation is expired.
4. Inspect extraction evidence and response-scope checks.
5. Queue or run the smallest inventory refresh.
6. Preserve the prior price in history.
7. Withhold ambiguous or search-only observations.

## Inventory cron fails

1. Verify `CRON_SECRET` and the Authorization header.
2. Inspect the response or `inventory_refresh_cron_completed` log. `run`
   separates completed, retrying, terminal-failed, discarded, lease-recovered,
   and deadline-stopped work; `backlog` reports queued, due, processing, and
   lease-expired counts.
3. Check retailer response status, MIME type, size, redirects, and adapter.
4. Look for product or market scope rejection.
5. Let bounded retries and the two-minute processing lease work; do not create
   duplicate active jobs or manually reclaim an unexpired worker. An expired
   job below the attempt cap is reclaimed, while one at the cap fails
   terminally.
6. Manually inspect any retailer that blocks automation.

An in-flight result is deliberately discarded if another worker or a manual
observation supersedes its claim. An offer that becomes unpublished,
non-exact, or non-HTTPS is cancelled; an exact offer whose URL changes is
queued for a fresh claim. Do not relax those gates to clear a backlog.

### Private manual browser observation

For a retailer that blocks the bounded fetch worker, record an observation only
after opening the exact product page in a browser and confirming its title,
measurable size, stock, and (when supplied) NGN price. This is a private CLI,
not an API. It resolves one pre-existing `exact` offer from product slug,
retailer name, and optionally its exact URL; it never creates an offer, changes
match kind, or approves a product.

An active `operator` or `admin` mapping is required through
`MODERATION_OPERATOR_EMAIL`. The command is a dry run unless `--apply` is
present. It records manual verification timestamps, a 1–168 hour expiry,
structured browser evidence and rationale, price history when a price is given,
and completes only the matching active refresh job. It does not print the email,
browser evidence, rationale, URL, or other raw observation payload.
A passing manual observation may refresh an already approved exact public offer
through the same title, size, route, market, and freshness gates as automation.
It cannot create or approve a product, retailer, or offer identity.

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run inventory:observe:manual -- \
  --product-slug exact-product-slug \
  --retailer "Exact Retailer Name" \
  --market-code NG \
  --stock in_stock \
  --price-naira 23500 \
  --observed-title "Exact product title shown by the retailer" \
  --observed-size "473 ml" \
  --evidence-note "Price and stock visible on the browser product page." \
  --rationale "Retailer blocks automated verification." \
  --valid-for-hours 24
```

After reviewing the dry-run result, repeat the same command with `--apply`:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run inventory:observe:manual -- \
  --product-slug exact-product-slug \
  --retailer "Exact Retailer Name" \
  --market-code NG \
  --stock in_stock \
  --price-naira 23500 \
  --observed-title "Exact product title shown by the retailer" \
  --observed-size "473 ml" \
  --evidence-note "Price and stock visible on the browser product page." \
  --rationale "Retailer blocks automated verification." \
  --valid-for-hours 24 \
  --apply
```

Omit `--price-naira` only when the page does not show a reliable whole-naira
price. Supply `--market-code` whenever the product/retailer pair can resolve to
more than one market offer (including duplicate exact URLs); use the canonical
market code such as `NG`. `--url` identifies the retailer listing but does not
replace market scope. Do not use this command for a search result, variant
ambiguity, or a retailer page whose title or size cannot be verified.

## Community submissions arrive

```bash
npm run community:research:signals
```

Use aggregate signals to prioritize research. Review custom vocabulary in the moderation queue. Do not publish prices, outcomes, or retailer claims directly from a community record.

Never report unique contributor counts until a privacy-reviewed stable anonymous identifier exists.

### Private moderation operator

Use `/ops` for item-by-item review. The command-line operator is the private,
aggregate-first fallback for an authenticated operator; it is not an API and must
never be wrapped in a public route.

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate
```

The default inspection is read-only and prints aggregate backlog, research-lane,
and integrity counts without raw contribution payloads. Every mutation requires:

- an email matching one active row in `moderation_operators`;
- the capability granted to that operator role;
- an explicit action, target, and rationale;
- `--apply`.

Without `--apply`, a valid command performs a dry run:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action reject \
  --queue community_contribution \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --rationale "Duplicate test submission."
```

After reviewing the dry run, append `--apply`. Contribution rejection also rejects
its still-pending edges and observations and recalculates affected research signal
counts in the same transaction. The parent decision and cascade counts are written
to `moderation_audit_log`.

Map a custom term only to an existing canonical slug:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action map \
  --queue community_moderation_value \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --canonical-kind purpose \
  --canonical-ref keratosis-pilaris \
  --rationale "Common-language alias for the existing concern."
```

An admin can reconcile materialized research counters after a retention or recovery
event. This also defaults to a dry run:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action reconcile \
  --rationale "Scheduled retention reconciliation."
```

Never copy a connection string, raw payload, operator subject, or contributor text
into a ticket, commit, terminal transcript, or chat. Use queue row IDs for handoff.

If later exact-identity review shows that an approved product observation cannot
stay approved, an admin can correct it without rewriting the original audit
entry. `defer` returns it to review; `reject` records that the product-level fact
cannot be retained as an exact-SKU observation. The command is dry-run by
default:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action correct \
  --queue community_observation \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --disposition defer \
  --rationale "Exact product identity still needs review."
```

Repeat with `--apply` only after reviewing the dry run. The applied correction
adds a new attributable audit action and never creates a product, offer, price,
outcome, retailer, or canonical relationship.

### Research ownership and outcomes

Use `/ops/research` for the normal manual pathway. Assigning a task records the
active operator; blocking it requires the exact next evidence action. Both are
durable task state and append an attributable audit event. They do not resolve
the identity or change catalogue data.

The private command is available for recovery and scripted adjudication. It is
dry-run by default:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run community:moderate -- \
  --action defer \
  --queue community_research_task \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --rationale "Exact next evidence action or source blocker."
```

Repeat with `--apply` after review. `claim` uses the same command shape and
records `assigned` rather than `blocked`.

The dry run checks the current owner and workflow state. Resolution dry-runs
also check the task namespace and outcome, existing published target or eligible
unreleased candidate, and prior resolution. Apply rechecks those guards inside
the locked transaction; a successful preview is not permission to weaken a
later concurrency failure.

Only the current owner may move active research into `retry`, with the next
bounded evidence step recorded. Admin takeover is reserved for work that already
belongs to a different operator and preserves the displaced owner in the audit
trail. Canonical tasks must resolve to the exact product or retailer named by
their namespaced task reference; ambiguous and duplicate outcomes remain
available only for custom identity work.

Product outcomes use `npm run community:research:resolve`. Existing-product
targets must be published, and deliberate-intake targets must already exist in
the checked-in intake manifest, remain unreleased, and originate from a custom
product-identity task. Retailer outcomes use the parallel private
command:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run community:retailer-research:resolve -- \
  --task-id 00000000-0000-4000-8000-000000000000 \
  --outcome existing-canonical-retailer \
  --canonical-slug exact-retailer-slug \
  --rationale "Exact evidence binding the task to the existing retailer."
```

The other retailer outcomes are `ambiguous-retailer` and
`dismissed-duplicate`. Add `--apply` only after the dry-run is correct. A
resolution closes the task but never creates or changes a retailer, offer,
price, product, or publication record.

## Retailer application email fails

1. Confirm the application saved before retrying email.
2. Check `EMAIL_PROVIDER`, sender address, and Production/Preview scope.
3. For `hostinger-api`, confirm `EMAIL_API_TOKEN` is a mailbox-scoped Agentic
   Mail token and that `/api/v1/me` includes the sender.
4. For `hostinger-smtp`, confirm `EMAIL_SMTP_PASSWORD` is the mailbox password,
   not an API token.
5. Use the resend endpoint only within its rate limit.
6. Do not print the private link or token in logs.

The application can remain saved even when delivery reports `failed` or `unavailable`.

## Secret exposure

1. Revoke or rotate the credential immediately.
2. Remove it from current files and output.
3. Assess Git history, build logs, screenshots, and copied artifacts.
4. Replace it in every required environment scope.
5. Redeploy and exercise the dependent feature.
6. Add a prevention check if the exposure route was repeatable.
