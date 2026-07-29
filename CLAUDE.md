# JeloCare agent instructions

Start with [the JeloCare handbook](./docs/README.md). For routine product work,
use [the catalogue fast lane](./docs/catalogue/FAST_LANE.md) and the enforcing
manifests and verifiers instead of reconstructing the workflow from git
history.

## Product-image routing

Image generation is one asset route, not the product lane itself.

1. Finish exact identity, care, Nigerian offer research, and source-asset
   evidence independently of the final-art route.
2. Prefer an exact, full-resolution official brand asset when its permission,
   package fidelity, transparency, and presentation quality can pass the
   publication gate. Never substitute a similar size, variant, package, or
   retailer thumbnail.
3. If the exact source is suitable but a faithful owned render is required,
   follow [the exact-SKU packshot generation
   handoff](./docs/catalogue/PACKSHOT_GENERATION_HANDOFF.md). Create a verified
   private generation specification containing the immutable source binding,
   exact prompt, required visible details, prohibited changes, and review
   checklist.
4. If an image-generation tool is available, give it the bound source as
   `Image 1` and use the checked-in prompt unchanged. If no such tool is
   available, stop only the image sublane: verify and report the ready-to-run
   handoff so an image-capable operator can return the output. Continue any
   independent product research that remains useful.
5. Never claim output hashes, generation provenance, art review, rights, or
   publication before the output exists. Never promote a raw automated cutout,
   generated draft, visually similar product, or unreviewed official image.
6. After the image returns, record its actual provenance, perform the
   full-resolution and multi-surface review, retire the open generation brief,
   and resume the normal release lane.

The final public asset must remain the exact package, complete and unclipped,
with true transparency, durable provenance, a content-addressed location, and
an independently reviewed presentation result.

## Standing authority for routine product releases

The repository owner authorizes an agent to finish and ship a routine,
exact-SKU catalogue addition without requesting conversational approval for
each product. When the existing publication contract passes, the agent may:

- complete the candidate, retained evidence, dossier, release, and derived
  search or research projections;
- upload a reviewed final asset to a new content-addressed JeloCare-controlled
  location with overwrite disabled;
- remove that exact released identity from its private research queue or retire
  its completed generation brief as required by the deterministic workflow;
- create one atomic product commit directly on `main`; and
- push `main`, allowing the normal production deployment to run.

This standing authority applies only when the change follows the existing
schema, publication gate, security boundary, runtime contract, and fast-lane
verification set. Seller or brand authorization is product evidence; it is not
a request for permission from the repository owner.

Do not pause a viable pipeline because one candidate is blocked. Record the
candidate-specific blocker and next action, then take the next ready product.
Request direction only when every useful candidate is blocked or the required
change falls outside the routine release contract.

Stop before shipping when the work would weaken or change a shared gate,
schema, migration, security boundary, runtime behavior, or public UI; when
identity, care, rights, source provenance, or final-image integrity remains
uncertain; when an existing public asset would be overwritten or deleted; or
when credentials, branch protection, or the execution environment actually
prevents the documented command. In the last case, finish the safe local work,
leave an atomic verified commit when permitted, and report the exact failing
command and error instead of asking a vague authorization question.
