# ADR 0003: Retailer partnership intake

Status: Accepted

Date: 2026-07-23

## Context

Many useful Nigerian skincare retailers operate through physical stores, WhatsApp, Instagram, delivery, or a mix of channels. Requiring a website or sending a generic partnership email creates unnecessary friction and produces unstructured information.

Retailer submissions also contain identifiable business contacts. They do not belong in the anonymous community intake.

## Decision

JeloCare will provide a dedicated retailer partnership journey at `/retailers`.

- A website is optional.
- An email and contact consent are required.
- The first durable save creates a private application.
- A 30-day magic link lets the retailer continue without an account.
- The edit secret is stored only as a hash and transported through a scoped HttpOnly cookie.
- Saves use optimistic revisions.
- Final submission is idempotent.
- Submitted data remains private until partnership review.
- Approval feeds the existing retailer and offer verification system; it does not bypass it.

The footer partnership action routes into this journey instead of opening email.

## Consequences

JeloCare can support retailers without websites and collect consistent operational details with less effort for the retailer.

The platform must operate:

- transactional mail delivery and retry states;
- application retention and expiry;
- a private review queue;
- consent and access controls;
- verification before canonical retailer or price publication.

Email verification confirms mailbox access only. It is not retailer identity, regulator, brand authorization, listing, or authenticity evidence.

## Alternatives rejected

- **Generic email:** high friction, incomplete structure, difficult to resume.
- **Anonymous community intake:** wrong privacy and trust boundary.
- **Account creation:** unnecessary for the first contribution.
- **Immediate public listing:** bypasses JeloCare's evidence model.

Implementation details live in [Retailer partnership intake](../retailers/PARTNERSHIP_INTAKE.md).
