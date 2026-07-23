# Operational runbooks

Updated: 2026-07-23

Lead with evidence. Preserve data. Prefer a forward repair.

## Production build fails

1. Identify the exact deployment and commit.
2. Read the first real failing command, not only the final exit code.
3. Reproduce with the same environment boundary.
4. If CI passed but production failed, inspect migrations, staged asset promotion, seeds, and service credentials.
5. Fix the cause in a small commit.
6. Re-run local gates and verify the next exact deployment.

Do not disable migrations to conceal a bad migration.

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
2. Inspect queued and processing jobs.
3. Check retailer response status, MIME type, size, redirects, and adapter.
4. Look for product or market scope rejection.
5. Let bounded retries work; do not create duplicate active jobs.
6. Manually inspect any retailer that blocks automation.

## Community submissions arrive

```bash
npm run community:research:signals
```

Use aggregate signals to prioritize research. Review custom vocabulary in the moderation queue. Do not publish prices, outcomes, or retailer claims directly from a community record.

Never report unique contributor counts until a privacy-reviewed stable anonymous identifier exists.

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
