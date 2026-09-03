# Remediation policy and business decisions

Date: 2026-09-03
Decision owner: Dyrane Alexander
Scope: comprehensive remediation gates 6, 7, 9, and 10

This receipt records the founder decisions needed to stop treating the four
gates below as unspecified policy. It does not manufacture external evidence,
grant third-party rights, execute a production deletion, or replace a legal,
provider, or accounting record.

## Concern retention

Customer Concerns are health-shaped sensitive personal context. The approved
customer promise is:

- an active Concern remains available until the customer removes it, clears
  Concerns, or deletes the account;
- remove and clear must hard-delete the corresponding live Concern rows rather
  than retain a reversible customer-linked tombstone;
- a customer export must include the customer's current active Concerns and no
  removed Concern content;
- account deletion must remove every live Concern row owned by that account;
- recovery-only provider backups may retain deleted bytes only for the exact
  configured provider backup window, are not customer-restorable, and must not
  be described as immediately erased until that window is evidenced.

The policy is approved. Repository and migration implementation, provider
backup-window evidence, and one authorized production verification remain
separate delivery gates.

## Ask JeloCare retention operations

The existing 30-day `retain_until` value remains an eligibility boundary, not
automatic deletion. The approved operating policy is a daily owner review and
deletion within 24 hours after eligibility, using only the protected bounded
operator documented in the runbook.

Every production apply remains target-specific and destructive: re-resolve the
direct administrator target, capture a fresh aggregate dry run, obtain fresh
action-time authority, apply one bounded batch, and retain an aggregate-only
receipt. Vercel, cron, queue, cache, and application-runtime credentials do not
receive deletion authority.

## Business cost evidence

JeloCare adopts a source-first, no-estimate rule. A missing provider invoice,
operator time record, retailer receipt variance, acquisition-cost source,
chargeback or refund loss record, messaging or AI invoice, contribution-margin
input, or privacy-safe repeat-order cohort remains `unavailable`; it must not
be replaced with an industry average or a convenient default.

This closes the engineering and decision treatment for missing cost inputs.
It does not claim cost completeness. Each unavailable input closes only when a
dated durable source and its calculation rule enter the private business
evidence register.

## Commercial and legal direction

The founder approves JeloCare's existing disclosed purchasing-agent direction,
the exact-quote and reapproval contract, the implemented governed payment and
returns lifecycle, and the clinical governance boundary already recorded in
ADRs 0016 and 0018.

That approval does not create rights that a third party has not granted. Public
product data, packshots, retailer evidence, community material, fulfilment
relationships, tax treatment, merchant-of-record treatment, chargeback terms,
and clinician or premises claims remain evidence-gated. A source marked
`pending`, `unclear`, or `not-verified` must remain withheld, be replaced with
an owned source, or receive a dated rights/contract record covering permitted
use, transformation, territory, effective date, expiry, and accountable owner.

## Closure boundary

These decisions remove founder-policy ambiguity from gates 6, 7, 9, and 10.
They do not authorize a production database mutation, secret change, external
publication, third-party representation, or destructive retention run. Those
actions keep their existing action-time gates, and unavailable external proof
must remain visible as a residual risk until supplied.
