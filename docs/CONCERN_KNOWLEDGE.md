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

## Prevention and stop-journey additions

Reviewed 2026-07-26. This batch deliberately separates one ordinary prevention need from three observations where shopping must stop.

| Public guide | Boundary | Primary guidance |
| --- | --- | --- |
| Daily sun protection | This is an ordinary Face concern, not a condition pattern. A product can appear only when its exact product-care record explicitly approves `daily-sun-protection`; catalogue names, SPF prose and retailer claims do not qualify it. The initial reviewed match is Eucerin Oil Control Sun Gel-Cream Dry Touch SPF 50+. | [AAD · How to apply sunscreen](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen) |
| Chemical splash or burn | An acid, alkali, bleach or other corrosive exposure with burning or skin injury routes to emergency first aid. Remove contaminated clothing if safe, brush off dry chemical, rinse under cool or lukewarm running water, and call emergency services. Creams and product browsing stop. | [NHS · Acid and chemical burns](https://www.nhs.uk/conditions/acid-and-chemical-burns/) |
| Yellow skin or eyes | Yellowing in the skin or whites of the eyes routes to urgent medical assessment without naming a cause. Copy notes that yellow skin may be harder to see on brown or black skin, making the whites of the eyes an important inclusive cue. | [NHS · Jaundice](https://www.nhs.uk/conditions/jaundice/) |
| Genital sore or unusual discharge | A genital sore, blister or unusual vaginal, penile or anal discharge routes to confidential sexual-health assessment and testing. Symptoms do not establish an infection; testing and clinical context do. | [WHO · Sexually transmitted infections](https://www.who.int/health-topics/sexually-transmitted-infections) and [NHS · Sexually transmitted infections](https://www.nhs.uk/conditions/sexually-transmitted-infections-stis/) |

The three warning guides are observational `condition-pattern` records with `productTerms: []`. Their directed Ask Jelo routes return deterministic care, `modelCalls: 0`, and no products. The sun-protection concern remains matchable, but only through the explicit product-care manifest.

## Fever-and-rash safety cluster

Reviewed 2026-07-26. These two guides close a high-consequence gap where a person might otherwise treat a fever-associated rash as a skincare question.

| Public guide | Boundary | Primary guidance |
| --- | --- | --- |
| Fever with a non-fading rash | A rash that does not fade when pressed is an emergency even without every other symptom. Fever with a stiff neck, confusion, a seizure, difficulty waking or a bulging soft spot in a baby also routes to emergency care; the path does not wait for a rash. | [NCDC · Cerebrospinal meningitis advisory](https://www.ncdc.gov.ng/news/535/3rd-march-2026-%7C-public-health-advisory-on-cerebrospinal-meningitis-%28csm%29), [WHO · Meningitis](https://www.who.int/news-room/fact-sheets/detail/meningitis) and [NHS · Meningitis](https://www.nhs.uk/conditions/meningitis/) |
| Fever with a spreading rash | Fever with cough, a runny nose or red watery eyes followed by a rash beginning on the face or neck and spreading down routes to same-day medical assessment. The person is told to call before arriving and avoid close contact. A seizure, severe breathing difficulty, confusion, inability to stay awake or drink, a stiff neck or a non-fading rash routes to emergency care. | [WHO · Measles](https://www.who.int/news-room/fact-sheets/detail/measles), [NHS · Measles](https://www.nhs.uk/conditions/measles/) and [NCDC · Measles situation report, August 2025](https://www.ncdc.gov.ng/themes/common/files/sitreps/e6d703892b7d429fffc731ea539d1fed.pdf) |

Both are observational `condition-pattern` guides with `productTerms: []`. Their Ask Jelo routes stop model and product output. Copy does not rely on redness: both guides note that a rash can be harder to see on brown or black skin. The measles route does not advise self-starting vitamin A or antibiotics.

This cluster is Nigeria-relevant rather than number-driven. NCDC’s March 2026 advisory describes ongoing cerebrospinal meningitis risk and says bacterial meningitis can become fatal within hours. NCDC’s August 2025 measles report recorded 10,891 confirmed cases and 76 deaths from January through August, with outbreaks in 184 local government areas across 25 states. Those figures set priority; they are not presented as a diagnosis or individual risk estimate.

## Common cosmetic look-alikes

Reviewed 2026-07-26. Three frequent-looking skincare questions now have explicit non-diagnostic boundaries:

| Public guide | Boundary | Primary guidance |
| --- | --- | --- |
| Small bumps around the mouth | Distinguished from comedonal acne, cold sores and impetigo; routes to an examination before acne treatment and never tells someone to stop a prescribed steroid without the prescriber. | [AAD · Perioral dermatitis](https://www.aad.org/public/diseases/a-z/perioral-dermatitis) |
| Raised itchy welts | Allows skin-coloured welts on brown or black skin; routes ordinary cases to pharmacist review, deeper swelling to same-day care, and airway or collapse signals to emergency care. | [NHS · Hives](https://www.nhs.uk/conditions/hives/) and [NHS · Angioedema](https://www.nhs.uk/conditions/angioedema/) |
| Tingling facial blisters | Distinguished from an inside-the-mouth ulcer, impetigo, a boil and shingles; adds contagious-contact guidance and same-day care for eye-area or newborn involvement. | [NHS · Cold sores](https://www.nhs.uk/conditions/cold-sores/), [AAD · Cold-sore treatment](https://www.aad.org/public/diseases/a-z/cold-sores-treatment) and [AAD · Herpes simplex signs](https://www.aad.org/public/diseases/a-z/herpes-simplex-symptoms) |

All three are `condition-pattern` guides with no product terms. Their directed referrals stop model and catalogue output.

## Foot, nail and changing-mark checks

Reviewed 2026-07-26. This small group closes common foot, nail and changing-mark gaps without turning JeloCare into a diagnostic service. Each is an observational `condition-pattern`, has `productTerms: []`, and stops model and catalogue output while a pharmacist or clinician checks the pattern.

| Public guide | Boundary | Primary guidance |
| --- | --- | --- |
| Itchy, peeling skin between the toes | Does not call a foot rash an infection. The route distinguishes toe-web itch, white or pale skin, peeling and cracking from a hot, painful or swollen foot, which stays on the same-day path. Diabetes or weakened immunity prompts clinician review. | [NHS · Athlete’s foot](https://www.nhs.uk/conditions/athletes-foot/) |
| Foot change with diabetes | Requires both diabetes context and an active foot wound or change. A cut, blister, ulcer, colour or temperature change, swelling, leaking wound or visible injury without pain goes to urgent in-person foot assessment; fever with a wound, gangrene-like tissue or a cold pale, blue or black foot goes to emergency hospital care. | [WHO · Diabetes](https://www.who.int/news-room/fact-sheets/detail/diabetes), [NICE · Diabetic foot problems](https://www.nice.org.uk/guidance/ng19/chapter/Recommendations), and [NHS England · Looking after a diabetic foot ulcer](https://www.england.nhs.uk/north/wp-content/uploads/sites/5/2018/12/Looking-after-your-Diabetic-Foot-Ulcer.pdf) |
| Thick or discoloured nail | Does not call every nail change fungal. It keeps dark or changing bands, around-nail pigment, splitting and a new bump on the prompt skin-examination path; pregnancy, breastfeeding, childhood, diabetes, immune suppression, pain or spread need clinician review. | [NHS · Fungal nail infection](https://www.nhs.uk/conditions/Fungal-nail-infection/) and [AAD · Nail fungus signs](https://www.aad.org/public/diseases/a-z/nail-fungus-symptoms) |
| Changing, bleeding or non-healing skin mark | Keeps suspicious marks out of pigment, scar, wart and lightening-product shopping. The guide names visible change rather than a condition and reminds people to check palms, soles, nails, scalp, mouth and less-visible areas on every skin tone. | [AAD · Finding skin cancer in darker skin tones](https://www.aad.org/public/diseases/skin-cancer/find/skin-of-color) and [AAD · How to find skin cancer](https://www.aad.org/public/diseases/skin-cancer/find/know-how) |

The changing-mark route is deliberately conservative. It asks for a prompt in-person skin examination without naming a diagnosis, and it never tells a person to use a cosmetic, wart-removal, lightening or scar product first.

The diabetes-foot route is deliberately narrower and more urgent. Diabetes alone does not select it, and ordinary toe-web peeling remains in the athlete’s-foot pathway. WHO notes that nerve damage and poor blood flow can lead to foot ulcers and amputation. Nigeria’s national non-communicable disease action plan also made preventive foot care, appropriate footwear and multidisciplinary clinics an explicit diabetes intervention. Sources: [WHO · Diabetes](https://www.who.int/news-room/fact-sheets/detail/diabetes), [WHO · Nigeria diabetes profile](https://www.who.int/publications/m/item/diabetes-nga-country-profile-nigeria-2016), and [Federal Ministry of Health · National Multi-Sectoral Action Plan](https://www.health.gov.ng/wp-content/uploads/2025/06/NCDs_Multisectoral_Action_Plan.pdf).

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
