# Zapshot playbook

Read [the complete crop playbook](references/crop-playbook.md) before selecting
regions. It covers coordinate scaling, exact identities/prose, media matching,
square/portrait/landscape fitting, audio, and the nine visual review checks.

The working sequence is:

1. Run `scripts/zapshot.py doctor` and establish image inspection capability.
2. Run `prepare` with the complete screenshot, matching original video, and a
   new case directory. Open the original, `inspect.png`, and `media-contact.png`.
3. Fill `regions.json` from the generated template, using one declared image
   coordinate space and the seven exact regions. The AI measures the regions.
4. Run `preview`, then actually open `crops.png`, `preview.png`, and `phone.png`.
5. Correct any failure and repeat the preview. Complete its generated review
   only after each visual check passes; retain the exact plan binding.
6. Run `render`; inspect `output/final.mp4`, the final proofs, and QA receipt.

If `run` returned `NEEDS_REGIONS`, preparation is already done. Continue at
step 2's inspection, then steps 3–6 in that prepared case. Do not rerun
`prepare` into the same directory or copy a similar-looking preset.

Known-pair replay does not prove unseen-case handling. The renderer needs no
LLM/API key; unseen inputs need host vision plus runtime. Output remains
`local-private-unpublished`. See [the specification](references/zapshot-spec.md)
for the contract and [runtime notes](RUNTIME.md) for environment setup.
