import { detectIngredients } from './ingredients';
import { evaluateClinicalRules } from './rules';
import type { ClinicalAssessment, PatientProfile } from './types';

export function inferProfileFromText(text: string, partial: PatientProfile = {}): PatientProfile {
  const normalized = text.toLowerCase();
  return {
    ...partial,
    pregnant: partial.pregnant ?? /\b(pregnant|pregnancy|expecting)\b/.test(normalized),
    breastfeeding: partial.breastfeeding ?? /\b(breastfeeding|breast feeding|nursing)\b/.test(normalized),
    sensitiveSkin: partial.sensitiveSkin ?? /\b(sensitive|stinging|burning|irritated|reactive)\b/.test(normalized),
  };
}

export function assessClinicalRoutine(text: string, partialProfile: PatientProfile = {}): ClinicalAssessment {
  const profile = inferProfileFromText(text, partialProfile);
  const detectedIngredients = detectIngredients(text);
  const findings = evaluateClinicalRules(detectedIngredients, profile);

  const activeLoad = detectedIngredients.reduce(
    (load, ingredient) => {
      if (ingredient.family === 'exfoliant') load.exfoliant += 1;
      if (ingredient.family === 'retinoid') load.retinoid += 1;
      if (ingredient.family === 'antimicrobial') load.antimicrobial += 1;
      if (['exfoliant', 'retinoid', 'antimicrobial'].includes(ingredient.family)) load.total += 1;
      return load;
    },
    { exfoliant: 0, retinoid: 0, antimicrobial: 0, total: 0 },
  );

  const blockedIngredientIds = Array.from(new Set(findings.filter(finding => finding.action === 'avoid').flatMap(finding => finding.ingredientIds ?? [])));
  return { detectedIngredients, findings, blockedIngredientIds, activeLoad };
}
