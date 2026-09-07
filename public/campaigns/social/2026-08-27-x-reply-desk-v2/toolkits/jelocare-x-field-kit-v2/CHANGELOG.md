# Changelog

## 2.0.0 — 2026-09-07

- Replaces the operator-facing raw recipe route with `zapshot.py` preparation,
  crop preview, bound visual review, and rendering stages.
- Adds original-coordinate inspection, media contact sheets, seven explicit
  crop regions, crop/phone proofs, and a step-by-step crop playbook.
- Delegates layout, source proportions, media fit, audio handling, and QA limits
  to code. The AI owns actual source matching and visual checks.
- Starts with `run`: registered exact source pairs use the approved preset;
  unfamiliar inputs return prepared `NEEDS_REGIONS` cases for guided selection.
  Direct `prepare`/`preview` entry points also preserve the known pair's canonical
  crop/layout.
- Adds fixed `CROP_EDGE` rejection for boundary-touching identity/prose and
  substantially cut avatars. Requires complete content with small clean padding,
  safe expansion and a fresh preview; edge checks do not certify semantic
  completeness.
- Clarifies required host vision/runtime, fictional examples, and the difference
  between replay evidence, unseen-case evidence, rights, and publication.
- Preserves the reply, follow-up, article, product, safety, and approval rules.

## 1.0.0 — 2026-09-04

- First tool-neutral release.
- Adds the one-file bootstrap, structured references, work-order and campaign
  templates, deterministic FFmpeg Zapshot renderer, synthetic self-test,
  secret/path validation, and SHA-256 manifest.
- Carries no credentials, sessions, customer data, third-party screenshots, or
  third-party media.
