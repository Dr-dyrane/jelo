# Member Privacy Operations Runbook

> **Status:** Review-ready operational contract for the architecture accepted by [ADR 0012](../adr/0012-private-member-shelf-and-routine-portal.md). The member system does not yet exist, so these are required implementation and exercise procedures—not claims of deployed controls.
>
> **Authority:** This runbook does not authorise member migration or production collection. That remains blocked until Gate G0 in the [Member Privacy and Data-Lifecycle Foundation](../privacy/MEMBER_PRIVACY_AND_DATA_LIFECYCLE.md#13-human-decision-and-signature-gates) records the required named-human approvals.

Use this runbook for member privacy incidents, rights jobs, legal holds, restore replay, provider failure and feature rollback. Existing public catalogue and community operations remain governed by [RUNBOOKS.md](RUNBOOKS.md); operator authentication and member authorisation must never be bridged.

## 1. Safety invariants

1. Never copy Shelf/Routine contents, OTPs, cookies, tokens, email/phone, export contents or raw request bodies into logs, chat, tickets, metrics, screenshots or incident documents.
2. Refer to a person by a case ID and approved pseudonymous member/job identifier. Put necessary direct contact data only in the approved case system with case-scoped access.
3. Stop affected member reads/writes before accepting an ownership or cross-privilege uncertainty. Public catalogue routes remain independent.
4. Disabling an automated feature does not suspend privacy rights: keep a verified manual intake and fulfilment route.
5. Never serve a restored member datastore until deletion-ledger/removal replay passes and the required humans release it.
6. Never improvise a legal basis, regulator notice, data-subject notice, legal hold, transfer mechanism or processor approval. Escalate to the named qualified Nigerian Privacy/legal approver.
7. Never use a consumer session for operator action or an operator session to impersonate a member.

## 2. Required role and contact record

This table must be completed and exercised before staff alpha. `UNASSIGNED` is a release blocker, not an invitation for an engineer or AI to assume the role.

| Role | Named human / channel | Decision authority |
|---|---|---|
| Incident commander | **UNASSIGNED** | Coordinates containment, evidence, recovery and status cadence |
| Qualified Nigerian Privacy/legal approver | **UNASSIGNED — G0 blocker** | Determines legal/regulatory notification, rights, lawful-basis, hold and transfer decisions |
| Data Administration owner | **UNASSIGNED** | Rights-job reconciliation, deletion evidence and restore replay |
| Security owner | **UNASSIGNED** | Auth/abuse containment, forensic boundaries and credential rotation |
| Platform release owner | **UNASSIGNED** | Feature switches, deployment rollback and exact-revision evidence |
| Support/rights intake owner | **UNASSIGNED** | Verified member communications and manual-rights continuity |
| Accountable controller executive | **UNASSIGNED — G0 blocker** | Accepts residual organisational risk and controller obligations |
| Processor/Procurement owner | **UNASSIGNED** | Provider escalation, contract/DPA and subprocessor evidence |

The approved contact register must live in the restricted operational system, not this public repository. Its evidence link, last test date, backup delegate and escalation deadline belong in the Gate G0 record.

## 3. Severity and feature response

| Condition | Initial classification | Immediate safe action |
|---|---|---|
| Suspected cross-member read/write, IDOR, cross-audience token acceptance, private cache/log leak, restored deletion, credential compromise | Privacy/security incident; highest severity until scoped | Disable affected member read/write/auth surface, preserve allowlisted evidence, page Incident/Privacy/Security |
| OTP flooding, enumeration, recovery replay, export scraping, deletion takeover | Security/abuse incident | Disable or tighten affected send/job initiation; revoke relevant sessions; retain verified manual rights intake |
| Export/deletion deadline at risk, provider deletion failure, replica/backup evidence missing | Privacy operations incident | Page Data Administration and Privacy; stop new affected jobs if needed; do not mark complete |
| Analytics/notification contains disallowed member/product/content field | Privacy incident | Disable emitter/provider, quarantine access, begin exposure assessment and deletion reconciliation |
| Rate-limit dependency unavailable | Security dependency incident | Fail closed for OTP/recovery/export/delete initiation; keep public routes and a verified manual rights route available |
| Ordinary provider outage without evidence of disclosure | Availability incident | Disable affected bounded feature, use approved status communication, do not bypass authorisation/privacy controls |

Initial severity can be reduced only by the named Incident commander with Security and Privacy evidence. “No evidence” is not the same as “evidence of no exposure.”

## 4. Privacy/security incident procedure

The qualified Privacy/legal approver determines legal applicability. The official [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf), including section 40, requires human review of controller notification to the NDPC within 72 hours where a breach is likely to result in risk, and immediate communication to affected data subjects where it is likely to result in high risk. The [NDPC GAID 2025](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf) informs the current breach record and notice review. This runbook does not decide that threshold.

### A. Open and contain

1. Open a restricted incident case with UTC discovery time, reporter, affected environment/revision/provider, allowed coarse signal, and incident commander.
2. Page the named Privacy/legal, Security, Data Administration and Platform owners. Record acknowledgement times.
3. Set `T0` to the earliest confirmed-breach time as determined by the incident team; also preserve discovery and awareness timestamps. Do not delay escalation while debating the final threshold.
4. Activate the narrowest safe switch: enrolment, sign-in, Shelf read, Shelf write, Routine, OTP/recovery, exports, notifications or analytics. For ownership/cross-privilege uncertainty, disable both affected reads and writes.
5. Revoke exposed sessions/credentials and isolate unsafe deployments, caches, logs, analytics destinations or restores. Never solve an incident by opening a privilege bypass.
6. Preserve allowlisted metadata and integrity hashes under case scope. Do not duplicate private payloads “for evidence.” If contents are indispensable, Privacy/Security must approve the minimal encrypted evidence location, reader list and deletion time.

### B. Scope and decide notifications

Record without private content:

- affected data classes, purposes, systems, environments, regions, processors/subprocessors and exact revisions;
- first/last exposure time, likely affected count/range, confidentiality/integrity/availability effect and whether data was encrypted/pseudonymised;
- containment state, session/secret rotation, provider case IDs and deletion/recall requests;
- likely consequences, vulnerable-person considerations, residual risk and evidence confidence;
- notification decision owner, decision time, statutory/regulatory analysis, proposed recipients and deadline.

Only the named qualified Privacy/legal approver can decide NDPC, data-subject, FCCPC or other authority notification. The decision—including a decision not to notify—must be written, signed and linked to evidence. Communications must be plain, accurate, non-diagnostic and avoid exposing another person's data.

### C. Recover and close

1. Patch and validate in a non-production environment using synthetic data.
2. Run the affected authorisation, privacy, abuse, cache/log, rights-job and cross-audience negative tests on the exact release revision.
3. If data was restored, complete section 9 before traffic. If data left a provider boundary, obtain provider deletion/containment evidence.
4. Named Security, Data Administration, Platform and Privacy humans sign the recovery decision; the Incident commander records the rollout cohort and observation window.
5. Monitor content-free guardrails, reconcile all affected export/deletion/notification jobs and close only when deadlines/evidence are complete.
6. Within the approved post-incident interval, record root cause, control gaps, durable owner/due date, regulatory/subject follow-up and evidence-destruction date. Update the architecture/runbook through normal review if a contract changed.

## 5. Member erasure and seven-day cancellation

### A. Intake and identity

1. Accept the request through an authenticated member session or the approved recovery/manual rights channel. Never ask support to inspect Shelf/Routine contents as identity proof.
2. Use step-up or re-verified consumer authentication. A separate operator relationship does not verify the member request.
3. Create one idempotent deletion job and return its opaque case/job reference, immediate effects, seven-day cancellation deadline, expected primary/provider/backup lifecycle, legal-hold caveat and support route in approved plain language.
4. Immediately lock member writes and revoke consumer sessions. Optional notifications/analytics stop. Shelf/Routine is unavailable to the member and operators during cancellation.

### B. Cancellation window

1. Keep the job in `cancellation_window` for seven calendar days from the recorded UTC request time.
2. Accept cancellation only through fresh/re-verified consumer auth; make the transition atomic and append an audit event.
3. On valid cancellation, restore the account from the still-live primary state, rotate sessions and notify through the approved minimal channel. Never restore from backup for routine cancellation.
4. At the deadline, atomically enter `irreversible`. A late cancellation becomes a new enrolment question after deletion completes; it cannot resurrect data.

### C. Irreversible deletion

The worker is retry-safe and records a content-free result for each step:

1. Confirm no active approved legal hold. If held, follow section 8 and keep service locked.
2. Delete notification endpoints and provider handles for the member purpose.
3. Delete Routine, Shelf, consent/account data according to approved cascade and evidence requirements. Consent evidence may remain only for the approved 24-month post-close rule and must be inaccessible to product/member reads.
4. Remove consumer auth credentials/session state from the approved provider within 30 days. If the same provider subject has a separately justified operator relationship, preserve only that operator credential, delete all member linkage/data, and use the approved disclosure/evidence path.
5. Complete primary deletion by day 30. Confirm replicas apply within 24 hours of the primary change.
6. Append the content-free deletion tombstone outside the restore boundary. Record the latest backup generation that could contain the data and its expiry, no later than 35 days under the approved policy.
7. Purge/link-break raw analytics, exports, cache and job artifacts; aggregates can remain only if they satisfy the approved non-identifiable cohort ≥20 contract.
8. Mark complete only after provider reconciliation, replica proof, ledger write and backup-expiry schedule exist. Send approved minimal completion notice and retain only authorised evidence.

### D. Required erasure evidence

```text
case/job pseudonym:
request UTC / irreversible UTC:
verification method code (no secret):
primary deletion UTC + revision:
provider work items + completion UTC:
replica confirmation UTC:
deletion-ledger generation/hash:
last affected backup generation / expiry UTC:
analytics/cache/export reconciliation:
legal hold decision/evidence:
exceptions and named Privacy approval:
Data Administration signer/date:
Privacy signer/date:
member completion communication UTC:
```

Evidence records counts, states, timestamps and integrity hashes—not deleted contents.

## 6. Export and deletion failed-job procedure

| Deadline signal | Required response |
|---|---|
| Export retry or queue age reaches 12h | Page Data Administration; inspect content-free failure code/provider health; reserve manual fulfilment capacity |
| Export reaches 20h without ready artifact | Page Privacy and Incident/Support; create approved manual plan to meet 24h; pause new exports if resource contention risks existing rights jobs |
| Export exceeds 24h | Privacy operations incident; notify member with approved accurate wording; record cause, remedy and legal review |
| Deletion step retry threatens any 24h replica or 30d primary/provider deadline | Page Privacy, Data Administration, Security and provider owner; open provider escalation; do not mark complete |
| Backup evidence threatens 35d maximum | Privacy/security incident; isolate affected recovery generation; require named Privacy decision and provider evidence |
| Job state/count/checksum mismatch | Stop worker for affected scope, preserve job metadata, investigate replay/idempotency; never rerun an unconstrained bulk delete |

Repair rules:

1. Claim jobs with bounded leases; expired leases are recoverable. State transitions compare the expected prior state.
2. Every external operation has an idempotency key and reconciles actual provider state before retry.
3. A retry cannot broaden member, class, provider or time scope. Bulk repair requires a reviewed manifest, dry-run counts and two named human approvals (Data Administration plus Privacy/Security as appropriate).
4. “Provider accepted” is not “deleted.” Completion requires provider state or contractually approved evidence.
5. Manual fulfilment uses the same identity, scope, audit, encryption and expiry controls as automation.

## 7. Provider and rate-limit outage

| Dependency | Safe degraded behaviour | Forbidden shortcut |
|---|---|---|
| Consumer auth / Neon Auth | Disable enrolment/sign-in/recovery as affected; existing sessions handled per Security decision; manual rights intake available | Local ad-hoc passwords, operator login, accepting expired/unverified OTP |
| Member datastore / Neon | Disable member reads/writes and job transitions; queue no unconstrained mutations; public catalogue remains available | Restoring an un-replayed backup, using preview data, bypassing owner policy |
| Upstash/rate limiter | OTP/recovery/export/delete initiation fail closed; content-free health alert; verified manual rights intake | Silent allow-all, storing raw email/IP/private contents in an alternate cache |
| Transactional mail | Stop sends, keep uniform UI response, reconcile accepted/provider state before retry | Logging destination/token, switching to unapproved personal mail, duplicate OTP sends |
| Vercel runtime/logging | Disable affected feature or roll back to verified safe revision; preserve public routes where safe | Enabling verbose request/body/auth logging, bypassing CSRF/authorisation |
| Notification/analytics | Disable immediately without blocking the core account/rights path | Sending private details in a fallback message or joining analytics to member data |

The provider owner records incident/case IDs, actual region/service affected, data involved, failover decision, DPA/security contact, recovery evidence and deletion/reconciliation evidence. A new provider or region is a Gate G0 change, not an emergency implementation detail.

## 8. Legal-hold procedure

Only the named qualified Privacy/legal approver may create, amend, renew or release a hold.

1. Receive a written authority/case reference, exact pseudonymous subjects/data classes, purpose, jurisdiction, approver, start, review and expiry.
2. Data Administration validates that the hold is technically precise. Reject open-ended “all data” scope unless the approver explicitly documents legal necessity.
3. Store the hold record in the separate control boundary. It prevents only the authorised purge step and never restores application/member/operator reads.
4. Continue all non-conflicting deletion steps and tell the member only what approved law and notice permit. Record every delayed step/deadline.
5. Review before expiry. No response means expiry and resumed purge unless the signed authority explicitly provides otherwise.
6. On release, resume the idempotent deletion job, reconcile providers/replicas/backups and complete the normal evidence template.

A hold is not a remedy for engineering failure, missing processor deletion, indefinite analytics retention or an unapproved business desire.

## 9. Backup restore and deletion-ledger replay

This procedure is mandatory for point-in-time recovery, snapshot restore, provider restore or copied production data.

### A. Authorise and isolate

1. Open a change/incident case identifying exact source generation/time, purpose, target isolated environment, data classes, region, expiry and named owners.
2. Obtain Data Administration, Security and Privacy approval. Confirm the target cannot receive public/member traffic, send mail/notifications, run analytics, invoke webhooks or share preview credentials.
3. Restore with least-privilege credentials into the isolated boundary. Record provider job/generation and checksum metadata without inspecting private contents.

### B. Replay before traffic

1. Verify schema and control-ledger compatibility against the exact application revision.
2. Load all deletion tombstones, item-removal events, closed-account states, provider reconciliation requirements and active legal holds newer than the restored generation.
3. Dry-run the replay: report bounded counts by class/state and expected changes, never contents. Investigate any missing/ambiguous owner or generation.
4. Execute idempotently with constrained worker identity. Re-run until the second pass produces zero outstanding changes.
5. Test purpose-built deleted canaries, withdrawn consent canaries, cross-member isolation and consumer/operator audience separation.
6. Reconcile provider/session/notification state: a restored row cannot revive a provider credential, endpoint, session or send.
7. Produce signed replay evidence: source/target generation, exact revision, ledger high-water mark, before/after counts, zero-change pass, canary results, unresolved exceptions and temporary-environment deletion deadline.

### C. Release or destroy

Only named Data Administration, Security, Platform and Privacy humans may release the restored state. If any replay, canary, policy or reconciliation check fails, keep traffic disabled and destroy the unsafe restore through the provider-approved recoverable process. After successful cutover, monitor content-free guardrails and securely remove the replaced/temporary environment on the approved schedule.

No incident commander may waive deletion replay to improve recovery time. Recovery objectives must be designed around this requirement.

## 10. Rollback and feature-disable procedure

Implementation rollback is a feature/control operation, not a data rollback:

1. Record trigger, exact current/target revisions, affected cohort/data classes, open rights jobs and named release authority.
2. Disable the narrow feature first. For an authorisation/privacy defect, stop both affected reads and writes.
3. Continue or manually fulfil due deletion/export work under the same controls. Do not roll back their state machines or tombstones.
4. Roll application code only to a revision compatible with the current schema, consent versions, sessions, job states and deletion ledger. Never reverse a migration that would lose rights/audit evidence or re-expose removed content.
5. Run public-route smoke tests and affected privacy/security tests on the exact deployed revision; confirm production aliases and feature-switch state.
6. Monitor, reconcile jobs/providers, and obtain Platform/Security/Data Administration/Privacy closure signatures.

For this documentation foundation, rollback is limited to reverting the packet, this runbook and their direct documentation links. That does not create authority to collect member data.

## 11. Exercise and release evidence

Before Gate G1, use synthetic members and contents only. Each exercise records exact revision, environment, participants, UTC start/end, expected result, actual result, content-free metrics, defects/owners/due dates and human sign-off.

Required exercises:

- two-member IDOR and cross-audience consumer/operator negative tests;
- OTP enumeration/flood/replay and rate-limiter outage;
- export scraping, expiry, retry and 24-hour manual fallback;
- deletion cancellation race, provider failure, replica delay and deadline alert;
- log/cache/analytics canary leakage;
- admin capability misuse/expiry and break-glass review;
- isolated backup restore with deletion-ledger replay and deleted canaries;
- member feature rollback while public routes and manual rights intake remain available;
- incident tabletop covering the Privacy/legal 72-hour and high-risk notification decisions.

No exercise passes through screenshots or assertions alone. Attach machine results, configuration/provider evidence, exact deployed revision and the required named-human decision. Private test contents remain synthetic and are deleted after the exercise.

## 12. Operational handback template

```text
Outcome:
Exact revision/environment:
Case/change/job references:
Member features disabled/enabled:
Data classes/providers/regions affected:
Rights deadlines and state:
Evidence produced (content-free links):
Human decisions/signatures:
Privacy/legal notification or hold decision:
Remaining risk/blocker and owner/due date:
Follow-up control/runbook change:
```

An empty human-decision field is a blocker. Operational convenience, provider defaults, code review or AI analysis never substitutes for the named Privacy/legal gate.
