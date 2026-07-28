# Team handoff

Updated: 2026-07-27

This checklist transfers operating knowledge without transferring assumptions.

## First day

Read:

1. [Handbook index](../README.md)
2. [North star](../product/NORTH_STAR.md)
3. [Architecture](../architecture/OVERVIEW.md)
4. [Design system](../design/SYSTEM.md)
5. [Catalogue operations](../catalogue/OPERATIONS.md)
6. [Environments](./ENVIRONMENTS.md)
7. [Release process](./RELEASE.md)

Then inspect:

```bash
git status --short
git branch -vv
git log -12 --oneline
npm run catalogue:pipeline:status
npm run lint
npm run typecheck
npm test
```

## Access to transfer

Do not paste credentials into the handoff.

- GitHub repository and Actions access;
- Vercel project, deployments, Analytics, Blob, and environment access;
- Neon project and branch access;
- Upstash Redis access;
- Hostinger mailbox, Agentic Mail API, and SMTP administration;
- domain and DNS administration;
- retailer and clinical review contacts.

Verify access by performing a read-only check in each system.

## Current-state packet

The outgoing team should provide:

- current commit and active branch;
- clean or explained working-tree status;
- exact production deployment;
- CI status for the current commit;
- current catalogue pipeline report;
- recent inventory and price audits;
- pending migrations;
- active incidents and temporary controls;
- current product candidate and its next blocker;
- community moderation and retailer application queue sizes;
- Ask Jelo limiter configuration and recent 403, 413, or 429 signals;
- any secret rotation in progress.

## Workstream ownership

Keep these lanes independent:

| Lane | Owns |
| --- | --- |
| Product and design | Journeys, copy, accessibility, visual contract |
| Catalogue research | Identity, care, offer, rights, and candidate evidence |
| Media | Exact-SKU package integrity, transparency, Blob publication |
| Clinical | Evidence, deterministic Ask Jelo rules, concern parity, recommendation eligibility |
| Retail operations | Retailer registry, refresh, price history, confidence |
| Community operations | Moderation and research signals |
| Partnerships | Private retailer applications and verification |
| Platform | Next.js, Neon, Vercel, Redis, email, CI, security |

One lane may inform another. It must not silently publish through it.

## Definition of done

A change is complete when:

- its public and data contract is clear;
- code and documentation agree;
- relevant automated gates pass;
- desktop and mobile behavior is verified;
- production deployment for the exact commit is ready;
- the custom domain serves it;
- operational follow-up is recorded.

## Questions the incoming team must answer

- Which records are public, recommendation-eligible, or research-only?
- How is an exact retailer offer proven?
- What prevents community data from becoming fact?
- What happens when Neon or the Ask Jelo limiter is unavailable?
- Which build steps can mutate production data?
- How is a bad public product or migration repaired?
- Who may approve clinical, catalogue, and retailer evidence?

If those answers are unclear, the handoff is not complete.

Ask Jelo has no current model runtime or AI Gateway access requirement. Do not
add provider credentials as a handoff shortcut. Any future language-only lane
needs a separate reviewed architecture decision and must preserve deterministic
guide, product-authority, urgency, care, privacy, and abuse-cost boundaries.
