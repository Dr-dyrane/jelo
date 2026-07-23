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
