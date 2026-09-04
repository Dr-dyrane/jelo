# Capability matrix

The packet supplies policy and repeatable files. The host supplies tools.

| Mode      | Host must have             | May do                                                                                                                  | Must not claim                                                              |
| --------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Desk      | Read text/images/files     | Analyse supplied evidence; draft and QA replies, hooks, articles, spotlights, and render recipes                        | Freshness, duplicate state, current metrics, rendered files, or publication |
| Live read | Public web or browser      | Inspect current posts, ancestry, visible metrics, author activity, prior JeloCare replies, trends, and product evidence | Signed-in state or publication unless actually available                    |
| Render    | Filesystem, Python, FFmpeg | Crop literal pixels; render primary audio MP4, poster, 390 px proof, GIF fallback, receipt, and hashes                  | Rights clearance or publication                                             |
| Publish   | Signed-in X browser        | Recheck, submit one exact approved pair, and verify the result                                                          | Success without target-level proof                                          |
| Monitor   | Browser and scheduler      | Check follow-ups repeatedly, compare IDs, and report only meaningful changes                                            | Continuous coverage during gaps or host outages                             |

## Required capability report

At `BOOT`, respond in this shape:

```text
Files: yes/no
Image inspection: yes/no
Public web: yes/no
Signed-in X: yes/no/unknown
Python: yes/no/unknown
FFmpeg: yes/no/unknown
Scheduling: yes/no
Highest safe mode: Desk | Live read | Render | Publish | Monitor
Unavailable actions: ...
```

Unknown means untested. Do not silently treat it as yes.
