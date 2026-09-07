# Capability matrix

The packet supplies instructions and a local renderer. The host supplies access,
image inspection, execution, and any authenticated services. An uploaded ZIP
does not turn every chatbot into a rendering environment.

| Capability                             | Enables                                                                      | Required limit                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Text/files                             | Draft replies, articles, spotlights, work orders, and handoffs.              | Do not claim unseen image contents or fresh source evidence.                       |
| Image inspection                       | Inspect supplied screenshots, video contact sheets, crops, and phone proofs. | A displayed thumbnail may use different coordinates from the source.               |
| Public web/browser                     | Check current source text, ancestry, duplicate state, and visible metrics.   | Do not infer signed-in access or rights from public accessibility.                 |
| Writable files + Python + FFmpeg       | Prepare inputs and render local media with QA/hashes.                        | Pass `doctor`; no LLM/API key is required by the renderer.                         |
| Image inspection + render runtime      | Complete the guided flow for an unseen source pair.                          | Actually inspect originals and generated proofs before setting review checks true. |
| Exact registered source pair + runtime | Replay its hash-matched preset.                                              | This is known-case evidence, not unseen-case generalization.                       |
| Signed-in X control                    | Submit one exact approved unit and verify the result.                        | A tool success without target-level proof is `submitted-unverified`.               |
| Scheduler + browser                    | Monitor fresh observations and suppress unchanged items.                     | Do not imply continuous coverage during gaps or host outages.                      |

## Required capability report

At `BOOT`, respond in this shape, then do an already-specified job:

```text
Files/ZIP access: yes/no/unknown
Image inspection: yes/no/unknown
Writable case directory: yes/no/unknown
Public web: yes/no/unknown
Signed-in X: yes/no/unknown
Python/FFmpeg doctor: passed/failed/not-run
Scheduling: yes/no/unknown
Available work: ...
Unavailable actions and exact reason: ...
```

Unknown means untested. Test relevant capabilities rather than silently treating
unknown as yes. If no job was specified, `BOOT` ends after the report.

Without vision, do not guess crop coordinates or visually approve a case.
Without execution, return a source-evidence summary and a runtime handoff; do
not promise that a file exists or that the proposed regions render correctly.
With both capabilities, the AI owns routine region selection and completion of
the local flow. Only an incomplete/obstructed/mismatched source or a real missing
capability calls for operator input on that flow.
