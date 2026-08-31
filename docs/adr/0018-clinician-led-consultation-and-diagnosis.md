# ADR 0018: Clinician-led consultation and diagnosis

- **Status:** Accepted; implementation and public claims gated
- **Date:** 2026-08-31
- **Decision owners:** Founder/medical clinical lead and JeloCare pharmacist
- **Extends:** [ADR 0011](0011-guide-resolution-and-clinical-product-authority.md), [ADR 0015](0015-customer-concern-consultation.md)
- **Supersedes:** None

## Outcome

JeloCare may add full, human-delivered pharmacist and physician consultations.
A named physician may record a diagnosis or working diagnosis after an adequate
clinical encounter within that physician's competence. A named pharmacist may
provide medicines counselling, medication review, adherence and interaction
support, and referral within pharmacy practice.

The public Ask Jelo guide remains educational and non-diagnostic. Software may
structure intake, retrieve reviewed evidence, screen for red flags, and prepare
a clinician work queue. It cannot independently issue a diagnosis,
prescription, medicine change, product-care approval, or other final
patient-specific clinical decision.

## Authority boundaries

| Activity                       | Accountable authority                                                     | Required record                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Catalogue product context      | Named licensed pharmacist or physician reviewing an exact evidence packet | Versioned product/evidence digest, disposition, reviewer identity, licence validity boundary, review and expiry dates    |
| Pharmacist consultation        | Named current pharmacist                                                  | Consent, medication and allergy history, advice, interaction/adherence findings, referral and follow-up                  |
| Physician consultation         | Named current physician                                                   | Identity/location, consent, history, remote-examination limitations, assessment, plan, red flags, follow-up and referral |
| Diagnosis or working diagnosis | Named physician after an adequate encounter                               | Clinician-signed conclusion, uncertainty and alternatives, supporting findings, exclusions and safety-net advice         |
| Prescription                   | Named authorized prescriber                                               | Patient-specific signed prescription, indication, medicine, dose, route, duration, monitoring and review                 |
| Dispensing                     | Licensed pharmacist and authorized premises/service                       | Prescription validation, dispensing evidence, counselling and medicine provenance                                        |
| Automated assistance           | JeloCare decision-support system under human oversight                    | Model/rule version, inputs used, bounded output, clinician acceptance or correction, audit and rollback reference        |

## Encounter contract

A licensed-care encounter cannot begin until the service has:

1. verified the patient's identity, location, eligibility and emergency status;
2. verified the assigned practitioner's current licence, role and competence;
3. captured affirmative clinical and sensitive-data consent, including the use
   and limits of automated assistance;
4. stated the service scope, price, expected response time, limitations,
   complaints route and emergency exclusions;
5. collected the minimum history required for the requested service and routed
   examination-dependent or urgent cases to appropriate in-person or emergency
   care; and
6. opened an immutable, owner-scoped clinical record with access, correction,
   export, retention and lawful-deletion controls.

The clinician owns the assessment. A product card, catalogue care state,
community outcome, generated differential, confidence score, or pharmacist
product attestation cannot substitute for an encounter or diagnosis.

## Product review relationship

`pharmacy-care-review/2026-08-31/v1` remains bound to its exact 39-product
cohort and its `reviewed_context_only` disposition. This decision does not
promote those products to `supportive_eligible` and does not extend that record
to any new or changed product.

Future review records must be immutable and exact-cohort. They must bind the
product and care-evidence digest, an opaque reviewer identity backed by private
credential evidence, a disposition, approval time, review due/expiry time, and
supersession or revocation when applicable. Licence validity limits the review
validity period. Changed identity, formula, evidence, licence status, or
disposition fails closed into a new review.

## Scheduled review owner

The read-only `/api/cron/clinical-review-health` owner inventories the public
catalogue daily and emits a deterministic human-review plan. It may identify
missing care cells, insufficient evidence, absent sources or ingredients,
unattested pharmacist context, legacy attestations needing credential binding,
and malformed review dates. It performs no writes and cannot approve, expire,
revoke, diagnose, prescribe, dispense, queue a database job, or notify a
patient.

Only a named licensed clinician may resolve a clinical review item. Repeated
cron output is an idempotent reminder, not a second review or approval.

## Public-claim and launch gates

Before JeloCare publicly claims clinician consultation or diagnosis, the
clinical owners must approve and record:

- independent current licence and registered-competence verification;
- the clinical lead, pharmacist owner, hours, response SLO, referral network,
  emergency owner and complaints process;
- applicable facility, clinic, electronic-pharmacy or dispensing-premises
  authority and professional indemnity;
- service scope, exclusions, pricing, prescribing formulary, restricted-drug
  exclusions and dispensing partner;
- the health-data privacy notice, lawful basis, affirmative consent, DPIA,
  processor/cross-border terms, breach plan and patient-rights workflow;
- the clinical-record schema, access model, retention, correction, export and
  lawful-deletion policy;
- signed assessment, prescribing, referral, adverse-event and missed-escalation
  protocols; and
- the exact public wording, clinician identity presentation and specialty
  claims.

The supplied 2026 licence documents are private evidence inputs. They are not
committed, deployed, logged, or treated as proof of a specialty, premises
licence, electronic-pharmacy authorization, indemnity, or registry good
standing.

## Verification boundary

The first implementation cell is the read-only scheduled review owner. A
clinician-facing approval workflow, patient encounter, clinical-record store,
diagnosis, prescription, dispensing integration, or public service claim is a
separate release cell with its own authority, privacy, migration, security,
rendered-flow and production-smoke gates.
