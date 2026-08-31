# Clinical review scheduled-owner evidence

Date: 2026-08-31
Status: implementation in release verification; natural production run pending

## Outcome

The bounded clinical-governance cell adds a daily, read-only product
care-evidence review owner. It does not alter the existing care matrix or the
exact 39-product `pharmacy-care-review/2026-08-31/v1` attestation. It turns the
remaining evidence and attestation gaps into a deterministic plan for named
human review.

The current checked-in public matrix is 163 products:

- 22 `supportive_eligible`;
- 39 `pharmacist_review`, all carrying the existing context-only v1
  attestation; and
- 102 `insufficient_data`.

The initial plan contains all 163 product rows. The 22 supportive cells remain
directly recommendable under the existing care contract but are queued for a
future credential-bound evidence digest. The 39 context-only attestations
remain valid for their released public wording and are queued for the same
stronger binding. The 102 insufficient cells remain queued for
evidence/ingredient review. Nine products have no care source URL: four in the
pharmacist-context cohort and five in the insufficient cohort.

The deterministic v1 manifest digest for this exact matrix is
`d4af5339f885b43baebe697654eb6fa4122db95846276995ce6b6ff418224d6d`.

## Enforced boundary

- `lib/clinical/clinical-review-plan.ts` owns deterministic inspection,
  care/evidence digests and idempotency keys.
- `/api/cron/clinical-review-health` is secret-authenticated,
  `private, no-store`, and logs aggregate counts only.
- `vercel.json` schedules the natural owner at 05:53 UTC daily.
- The department manifest assigns scheduled execution to Platform Delivery and
  evidence decisions to Clinical Governance.
- The route performs zero writes and imports but does not edit the actively
  reserved product-care manifest.

Automation cannot attest, promote, diagnose, prescribe, dispense, notify a
patient, call another queue, or mutate the database. A named licensed reviewer
must resolve each exact plan item through a later immutable evidence record.

## Licence and service boundary

Dyrane supplied current-year pharmacist and physician practising-licence
documents as private review inputs. They are not copied into the repository,
runtime logs or deployment. Independent registry/competence verification,
applicable facility or electronic-pharmacy authority, indemnity, service
agreements, privacy/DPIA evidence, encounter records and signed clinical
protocols remain launch gates for public consultation or diagnosis claims.

The accepted human-service contract is
[ADR 0018](../../adr/0018-clinician-led-consultation-and-diagnosis.md). The
public Ask guide remains educational until its separate licensed-care cells
pass those gates.

## Release and natural observation

Focused verification passed 22 of 22 tests after the one bounded independent
review correction. The review required all 22 directly recommendable
supportive cells to enter credential binding and required impossible or future
review dates to fail closed; its recheck passed with no further blocker.

The integration gate ran 1,697 tests: 1,694 passed, three expected tests were
skipped, and none failed. Typecheck, documentation and all 53 canonical
migrations passed. Tracked-surface lint plus this cell's new files reported
zero errors and 24 warnings. The unscoped lint process also saw six existing
errors inside the protected untracked campaign-render tree; those unrelated
files were preserved and excluded rather than modified.

The exact commit, READY deployment and first natural 05:53 UTC execution will
be appended after they exist. The endpoint will not be invoked manually. A
passing natural observation requires HTTP 200,
`clinical_review_health_checked`, `attention_required`, the exact deployed
manifest digest and `writesPerformed: 0`.
