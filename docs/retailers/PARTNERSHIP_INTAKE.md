# Retailer partnership intake

Updated: 2026-07-23

Physical, social, and web retailers use one path: `/retailers`.

A website is optional. An email is required because it carries the private continuation link.

## Experience

The public journey asks one thing at a time:

1. store name;
2. selling channels;
3. state, city, and optional address;
4. email and contact consent;
5. optional phone, WhatsApp, website, Instagram, and Facebook;
6. brands and services;
7. optional sample product and price;
8. review and submit.

The first durable save creates the application and sends a private magic link. The user can continue in the current browser through an HttpOnly cookie or return through email for 30 days.

No website is required. A physical store, WhatsApp seller, Instagram retailer,
Facebook business, delivery business, or mixed retailer can apply.

## Data flow

```text
/retailers
  -> create application
  -> Neon draft + consent timestamp
  -> private token in scoped HttpOnly cookie
  -> Hostinger Mail magic link
  -> email verification on open
  -> optimistic draft saves
  -> idempotent final submission
  -> partnership review
  -> verified canonical retailer and offer onboarding
```

The application is not a public retailer record. Approval must still pass the retailer and exact-offer verification process.

## Trust boundary

- Store contacts and addresses are confidential business data.
- Plain edit secrets are never stored.
- Email verification proves access to that mailbox, not business legitimacy.
- A submitted product and price are research leads, not public price observations.
- Partnership approval does not prove every physical item is authentic.
- Seller identity, retailer identity, regulator match, brand authorization, listing evidence, and physical authenticity remain separate.

## Implementation

| Area | Files |
| --- | --- |
| Public route and experience | `app/retailers/`, `components/retailers/` |
| API | `app/api/retailers/` |
| Schema | `lib/retailer-partnership/schema.ts` |
| Security and token format | `lib/retailer-partnership/security.ts`, `lib/retailer-partnership/token.ts` |
| Repository | `lib/retailer-partnership/repository.ts` |
| Email | `lib/email/mailer.ts` |
| Database | `db/migrations/0016_retailer_partnership_intake.sql` |

The API supports create, restore, save, resend, magic-link open, and submit. The public footer and retailer-page partnership actions should route to `/retailers#list-your-store`, not an email composer.

## Operations

Application states:

```text
draft -> submitted -> approved or declined
draft -> expired
```

Events record creation, link sends, link opens, draft saves, and submission.

Before approval:

1. confirm contact and location;
2. confirm the retailer's public or physical presence;
3. map brands and channels;
4. research exact product listings independently;
5. create or update canonical retailer records;
6. add price observations only through the retail evidence path.

Do not expose raw application payloads in a public dashboard.

## Release checklist

- Migration applied.
- Production PostgreSQL configured.
- Upstash configured.
- Hostinger Agentic Mail token or SMTP fallback and sender configured.
- Canonical site origin configured.
- Footer and retailer-page links open the intake.
- Magic link works in a fresh browser.
- Save conflict, expired link, resend, missing email, and mail failure states work.
- Mobile keyboard, focus, and back behavior work.
- Submitted applications remain private.
- An operations owner can review the queue safely.
