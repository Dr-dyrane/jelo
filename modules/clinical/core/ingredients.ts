import type { IngredientKnowledge } from './types';

export const ingredientKnowledge: IngredientKnowledge[] = [
  {
    id: 'salicylic-acid', name: 'Salicylic acid', aliases: ['salicylic acid', 'bha'], family: 'exfoliant', evidence: 'high',
    concerns: ['acne', 'blackheads', 'oiliness', 'congestion'], allowedTimes: ['morning', 'evening'], pregnancy: 'caution', breastfeeding: 'safe',
    photosensitivity: 'low', irritationRisk: 'moderate',
  },
  {
    id: 'glycolic-acid', name: 'Glycolic acid', aliases: ['glycolic acid', 'aha'], family: 'exfoliant', evidence: 'high',
    concerns: ['texture', 'hyperpigmentation'], allowedTimes: ['evening', 'weekly'], pregnancy: 'caution', breastfeeding: 'safe',
    photosensitivity: 'moderate', irritationRisk: 'high',
  },
  {
    id: 'retinol', name: 'Retinol', aliases: ['retinol', 'retinoid', 'retinal'], family: 'retinoid', evidence: 'high',
    concerns: ['acne', 'texture', 'fine lines', 'hyperpigmentation'], allowedTimes: ['evening'], pregnancy: 'avoid', breastfeeding: 'caution',
    photosensitivity: 'moderate', irritationRisk: 'high',
  },
  {
    id: 'tretinoin', name: 'Tretinoin', aliases: ['tretinoin', 'retin-a'], family: 'retinoid', evidence: 'high',
    concerns: ['acne', 'photoaging', 'hyperpigmentation'], allowedTimes: ['evening'], pregnancy: 'avoid', breastfeeding: 'caution',
    photosensitivity: 'moderate', irritationRisk: 'high',
  },
  {
    id: 'benzoyl-peroxide', name: 'Benzoyl peroxide', aliases: ['benzoyl peroxide', 'bpo'], family: 'antimicrobial', evidence: 'high',
    concerns: ['acne', 'inflamed spots'], allowedTimes: ['morning', 'evening'], pregnancy: 'safe', breastfeeding: 'caution',
    photosensitivity: 'low', irritationRisk: 'high',
  },
  {
    id: 'azelaic-acid', name: 'Azelaic acid', aliases: ['azelaic acid'], family: 'brightening', evidence: 'high',
    concerns: ['acne', 'hyperpigmentation', 'redness'], allowedTimes: ['morning', 'evening'], pregnancy: 'safe', breastfeeding: 'safe',
    photosensitivity: 'none', irritationRisk: 'low',
  },
  {
    id: 'niacinamide', name: 'Niacinamide', aliases: ['niacinamide', 'nicotinamide', 'vitamin b3'], family: 'barrier', evidence: 'high',
    concerns: ['oiliness', 'barrier', 'hyperpigmentation'], allowedTimes: ['morning', 'evening'], pregnancy: 'safe', breastfeeding: 'safe',
    photosensitivity: 'none', irritationRisk: 'low',
  },
  {
    id: 'tranexamic-acid', name: 'Tranexamic acid', aliases: ['tranexamic acid', 'txa'], family: 'brightening', evidence: 'moderate',
    concerns: ['hyperpigmentation', 'dark spots'], allowedTimes: ['morning', 'evening'], pregnancy: 'unknown', breastfeeding: 'unknown',
    photosensitivity: 'none', irritationRisk: 'low',
  },
  {
    id: 'ceramides', name: 'Ceramides', aliases: ['ceramide', 'ceramides'], family: 'barrier', evidence: 'high',
    concerns: ['barrier', 'dryness', 'sensitivity'], allowedTimes: ['morning', 'evening', 'any'], pregnancy: 'safe', breastfeeding: 'safe',
    photosensitivity: 'none', irritationRisk: 'low',
  },
  {
    id: 'sunscreen', name: 'Broad-spectrum sunscreen', aliases: ['sunscreen', 'spf', 'uv protection'], family: 'sunscreen', evidence: 'high',
    concerns: ['hyperpigmentation', 'photoaging', 'sun protection'], allowedTimes: ['morning'], pregnancy: 'safe', breastfeeding: 'safe',
    photosensitivity: 'none', irritationRisk: 'low',
  },
];

export const ingredientById = new Map(ingredientKnowledge.map(ingredient => [ingredient.id, ingredient]));

const medicineUseContext = (
  /\b(?:tablet|tablets|capsule|capsules|pill|pills|oral(?:ly)?|medicine|medicines|medication|medications|prescription|prescribed|taking|i take|i took|dose|dosage|dosing)\b|\b(?:for|during)\s+(?:heavy\s+)?periods?\b|\bmenstrual bleeding\b/i
);

export function hasMedicineUseContext(text: string) {
  return medicineUseContext.test(text);
}

export function detectIngredients(text: string) {
  const normalized = text.toLowerCase();
  return ingredientKnowledge.filter(ingredient => ingredient.aliases.some(alias => normalized.includes(alias)));
}
