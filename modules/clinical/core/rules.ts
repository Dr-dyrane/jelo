import type { ClinicalFinding, IngredientKnowledge, PatientProfile } from './types';

function hasFamily(ingredients: IngredientKnowledge[], family: IngredientKnowledge['family']) {
  return ingredients.some(ingredient => ingredient.family === family);
}

export function evaluateClinicalRules(ingredients: IngredientKnowledge[], profile: PatientProfile): ClinicalFinding[] {
  const findings: ClinicalFinding[] = [];
  const ids = new Set(ingredients.map(ingredient => ingredient.id));

  if (profile.pregnant) {
    const blocked = ingredients.filter(ingredient => ingredient.pregnancy === 'avoid');
    for (const ingredient of blocked) {
      findings.push({
        ruleId: `pregnancy-${ingredient.id}`,
        severity: 'high',
        title: `${ingredient.name} should be avoided during pregnancy`,
        explanation: 'This is a deterministic safety block. Choose a pregnancy-compatible alternative and confirm uncertain cases with a clinician or pharmacist.',
        ingredientIds: [ingredient.id],
        action: 'avoid',
      });
    }
  }

  if (profile.breastfeeding) {
    const caution = ingredients.filter(ingredient => ingredient.breastfeeding === 'caution' || ingredient.breastfeeding === 'avoid');
    for (const ingredient of caution) {
      findings.push({
        ruleId: `breastfeeding-${ingredient.id}`,
        severity: ingredient.breastfeeding === 'avoid' ? 'high' : 'caution',
        title: `Review ${ingredient.name} while breastfeeding`,
        explanation: 'Avoid application on or near the breast and obtain individualized professional guidance before continued use.',
        ingredientIds: [ingredient.id],
        action: ingredient.breastfeeding === 'avoid' ? 'avoid' : 'adjust',
      });
    }
  }

  if (hasFamily(ingredients, 'retinoid') && hasFamily(ingredients, 'exfoliant')) {
    findings.push({
      ruleId: 'retinoid-exfoliant-same-routine',
      severity: 'high',
      title: 'Do not stack a retinoid and exfoliating acid in the same routine',
      explanation: 'Alternate nights and insert recovery nights to reduce burning, peeling and barrier disruption.',
      ingredientIds: ingredients.filter(item => item.family === 'retinoid' || item.family === 'exfoliant').map(item => item.id),
      action: 'adjust',
    });
  }

  if (ids.has('tretinoin') && ids.has('benzoyl-peroxide')) {
    findings.push({
      ruleId: 'tretinoin-benzoyl-peroxide-separation',
      severity: 'caution',
      title: 'Separate tretinoin and benzoyl peroxide',
      explanation: 'Use them at different times of day unless a prescriber has provided a specific compatible regimen.',
      ingredientIds: ['tretinoin', 'benzoyl-peroxide'],
      action: 'adjust',
    });
  }

  const highIrritation = ingredients.filter(ingredient => ingredient.irritationRisk === 'high');
  if (highIrritation.length >= 2 || (profile.sensitiveSkin && highIrritation.length >= 1)) {
    findings.push({
      ruleId: 'high-irritation-load',
      severity: 'high',
      title: 'Active load is likely too irritating',
      explanation: 'Introduce only one high-irritation active at a time and prioritize moisturizer, gentle cleansing and sunscreen.',
      ingredientIds: highIrritation.map(ingredient => ingredient.id),
      action: 'adjust',
    });
  }

  if (ingredients.some(ingredient => ingredient.photosensitivity === 'moderate' || ingredient.photosensitivity === 'high') && !ids.has('sunscreen')) {
    findings.push({
      ruleId: 'photosensitive-active-without-sunscreen',
      severity: 'caution',
      title: 'Daily sunscreen is important with this routine',
      explanation: 'Photosensitizing or irritation-prone actives can worsen sun sensitivity and post-inflammatory dark marks without consistent protection.',
      ingredientIds: ingredients.filter(ingredient => ingredient.photosensitivity === 'moderate' || ingredient.photosensitivity === 'high').map(ingredient => ingredient.id),
      action: 'adjust',
    });
  }

  return findings;
}
