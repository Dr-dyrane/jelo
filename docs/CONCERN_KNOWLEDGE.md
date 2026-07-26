# Concern knowledge

JeloCare concern guides describe observable patterns. They do not identify a condition or replace an examination.

## Publication rules

- Write signs a person can observe without relying on redness alone; colour changes can be harder to see on brown and black skin.
- Use a plain-language name and keep the clinical label in the slug or source, not as a diagnosis.
- Every condition pattern must have `productTerms: []`. Product matching also rejects every `condition-pattern`, regardless of catalogue copy.
- Put time-sensitive care and emergency warning signs in `escalation`; do not bury them among skincare options.
- Prefer current public guidance from official health systems, professional societies and public-health agencies. Record the review date with the guide.

## Guide and Ask Jelo parity

Every published `condition-pattern` declares one or more `clinicalPatternIds`. Each ID must exist in Ask Jelo's deterministic pattern registry. This relationship prevents the static guide and interactive care path from silently diverging.

Parity does not turn a guide into a diagnosis. Public pattern labels remain observational, the engine asks distinguishing questions, and a directed referral stops model and product guidance. A condition pattern keeps `productTerms: []` even when Ask Jelo can recognize the reported signals.

Tests must cover the representative pattern, a close alternative, the referral level and timing, and the API boundary (`modelCalls: 0` and no products) for any path that needs human review.

## Common cosmetic look-alikes

Reviewed 2026-07-26. Three frequent-looking skincare questions now have explicit non-diagnostic boundaries:

| Public guide | Boundary | Primary guidance |
| --- | --- | --- |
| Small bumps around the mouth | Distinguished from comedonal acne, cold sores and impetigo; routes to an examination before acne treatment and never tells someone to stop a prescribed steroid without the prescriber. | [AAD · Perioral dermatitis](https://www.aad.org/public/diseases/a-z/perioral-dermatitis) |
| Raised itchy welts | Allows skin-coloured welts on brown or black skin; routes ordinary cases to pharmacist review, deeper swelling to same-day care, and airway or collapse signals to emergency care. | [NHS · Hives](https://www.nhs.uk/conditions/hives/) and [NHS · Angioedema](https://www.nhs.uk/conditions/angioedema/) |
| Tingling facial blisters | Distinguished from an inside-the-mouth ulcer, impetigo, a boil and shingles; adds contagious-contact guidance and same-day care for eye-area or newborn involvement. | [NHS · Cold sores](https://www.nhs.uk/conditions/cold-sores/), [AAD · Cold-sore treatment](https://www.aad.org/public/diseases/a-z/cold-sores-treatment) and [AAD · Herpes simplex signs](https://www.aad.org/public/diseases/a-z/herpes-simplex-symptoms) |

All three are `condition-pattern` guides with no product terms. Their directed referrals stop model and catalogue output.

## Infection-warning cluster

Reviewed 2026-07-22. This cluster fills the gap between existing fungal/infestation guides and presentations where browsing products should stop.

| Guide | Why it is separate | Primary source |
| --- | --- | --- |
| Hot, painful swelling | Pain, heat and swelling need urgent assessment because untreated cellulitis can become serious. | [NHS · Cellulitis](https://www.nhs.uk/conditions/cellulitis/) |
| Crusted spreading sores | Contagious sores need confirmation and contact-aware care; babies and immunocompromised people need a clinician. | [NHS · Impetigo](https://www.nhs.uk/conditions/impetigo/) |
| One-sided painful blisters | Prompt assessment matters because antiviral treatment may be time-sensitive, especially around the eye or in higher-risk people. | [NHS · Shingles](https://www.nhs.uk/conditions/shingles/) |

All three are condition patterns, have no product search terms and cannot surface catalogue recommendations.

Their Ask Jelo parity was checked on 2026-07-22. Painful hot swelling routes to same-day assessment. Spreading crusted sores route to a pharmacist or clinician, with clinician review for higher-risk contexts. One-sided painful blisters route to prompt advice, ideally within three days, with urgent review for eye or nose involvement, vision changes, pregnancy, age under 18 or weakened immunity.

## Sensory-loss pattern

Reviewed 2026-07-22. “Numb skin patches” covers a lighter or otherwise changed-colour patch with reduced feeling or numbness. New weakness that may involve a nerve also prompts examination; it is not described as necessarily close to the patch or gradual. The public name stays observational; the clinical label remains in the source and route slug. Sudden one-sided face, arm, or leg weakness or speech trouble follows the NHS emergency stroke boundary. Reduced sensation still prompts examination because early treatment can prevent permanent disability.

This guide never recommends products or home testing with heat, needles or other sharp objects. It is a `condition-pattern`, has `productTerms: []`, and routes people to an in-person examination without presenting JeloCare as a diagnostic service. Primary source: [World Health Organization · Leprosy](https://www.who.int/en/news-room/fact-sheets/detail/leprosy).

Ask Jelo uses the observational label “Numb changed-colour patch pattern.” Reduced feeling or numbness routes to prompt in-person assessment. Sudden one-sided weakness or speech trouble routes to emergency care. The interactive path does not expose a product shortlist or suggest a home sensation test.

## Dark velvety thickening

Reviewed 2026-07-22. Dark, thickened skin with a velvet-like feel that does not scrub away needs assessment for its cause rather than pigmentation shopping. Ask Jelo uses the observational label “Dark velvety-thickening pattern,” routes to medical review, and keeps products suppressed. Sources: [American Academy of Dermatology · Overview](https://www.aad.org/public/diseases/a-z/acanthosis-nigricans-overview) and [American Academy of Dermatology · Diagnosis and treatment](https://www.aad.org/public/diseases/a-z/acanthosis-nigricans-treatment).

## Persistent limb swelling

Reviewed 2026-07-22. Long-lasting arm or leg swelling with skin that feels hard, tight or thick needs an in-person assessment rather than a product shortlist. Ask Jelo uses the observational label “Persistent swelling with thickened skin,” keeps products suppressed and routes the person to primary care. A suddenly painful, warm or one-sided swollen limb routes to same-day care. Swelling with chest pain, breathlessness, coughing blood or collapse routes to emergency care. Sources: [World Health Organization · Lymphatic filariasis](https://www.who.int/news-room/fact-sheets/detail/lymphatic-filariasis), [NHS · Lymphoedema](https://www.nhs.uk/conditions/lymphoedema/) and [NHS · Deep vein thrombosis](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/).

## Wart-like growth becoming an ulcer

Reviewed 2026-07-22. A wart-like growth that ulcerates, or several raised yellow lesions, needs prompt examination and should not enter a product shortlist. The public guide remains morphology-led because WHO notes that many ulcers mistaken clinically for yaws have another cause. Ask Jelo routes the observational pattern or a named yaws concern to primary care, stops model and product output, and keeps fever, severe pain, warmth, pus or rapid worsening on the same-day pathway. Sources: [World Health Organization · Yaws](https://www.who.int/en/news-room/fact-sheets/detail/yaws) and [World Health Organization · Integrated skin NTD guidance](https://www.who.int/publications/i/item/9789292800024).

## Slow swelling with draining openings

Reviewed 2026-07-22. A slowly growing, usually painless swelling—often on a foot—with several openings that drain fluid or visible grains needs prompt examination rather than skincare treatment. Ask Jelo uses the observational label “Slow swelling-with-drainage warning pattern,” routes the person to primary care, stops model and product output, and keeps fever, severe pain, warmth or rapid worsening on the same-day pathway. The public guide does not identify the cause or recommend an antibiotic or antifungal because testing is needed to distinguish the organisms and treatment paths. Sources: [World Health Organization · Mycetoma](https://www.who.int/news-room/fact-sheets/detail/mycetoma) and [World Health Organization · Mycetoma diagnostic target](https://www.who.int/publications/i/item/9789240047075).
