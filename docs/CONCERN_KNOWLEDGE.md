# Concern knowledge

JeloCare concern guides describe observable patterns. They do not identify a condition or replace an examination.

## Publication rules

- Write signs a person can observe without relying on redness alone; colour changes can be harder to see on brown and black skin.
- Use a plain-language name and keep the clinical label in the slug or source, not as a diagnosis.
- Every condition pattern must have `productTerms: []`. Product matching also rejects every `condition-pattern`, regardless of catalogue copy.
- Put time-sensitive care and emergency warning signs in `escalation`; do not bury them among skincare options.
- Prefer current public guidance from official health systems, professional societies and public-health agencies. Record the review date with the guide.

## Infection-warning cluster

Reviewed 2026-07-22. This cluster fills the gap between existing fungal/infestation guides and presentations where browsing products should stop.

| Guide | Why it is separate | Primary source |
| --- | --- | --- |
| Hot, painful swelling | Pain, heat and swelling need urgent assessment because untreated cellulitis can become serious. | [NHS · Cellulitis](https://www.nhs.uk/conditions/cellulitis/) |
| Crusted spreading sores | Contagious sores need confirmation and contact-aware care; babies and immunocompromised people need a clinician. | [NHS · Impetigo](https://www.nhs.uk/conditions/impetigo/) |
| One-sided painful blisters | Prompt assessment matters because antiviral treatment may be time-sensitive, especially around the eye or in higher-risk people. | [NHS · Shingles](https://www.nhs.uk/conditions/shingles/) |

All three are condition patterns, have no product search terms and cannot surface catalogue recommendations.

## Sensory-loss pattern

Reviewed 2026-07-22. “Numb skin patches” covers a lighter or otherwise changed-colour patch with reduced feeling or numbness. New weakness that may involve a nerve also prompts examination; it is not described as necessarily close to the patch or gradual. The public name stays observational; the clinical label remains in the source and route slug. Sudden one-sided face, arm, or leg weakness or speech trouble follows the NHS emergency stroke boundary. Reduced sensation still prompts examination because early treatment can prevent permanent disability.

This guide never recommends products or home testing with heat, needles or other sharp objects. It is a `condition-pattern`, has `productTerms: []`, and routes people to an in-person examination without presenting JeloCare as a diagnostic service. Primary source: [World Health Organization · Leprosy](https://www.who.int/en/news-room/fact-sheets/detail/leprosy).
