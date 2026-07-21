import type { BarrierAssessment, IngredientKnowledge, PatientProfile } from './types';

const signalWeights: Array<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /\b(burning|burns|stinging|stings)\b/i, label: 'Burning or stinging', weight: 24 },
  { pattern: /\b(peeling|peels|flaking|flaky|scaly)\b/i, label: 'Peeling or scaling', weight: 18 },
  { pattern: /\b(tight|tightness)\b/i, label: 'Persistent tightness', weight: 12 },
  { pattern: /\b(raw|cracked|fissure|weeping)\b/i, label: 'Raw or cracked skin', weight: 30 },
  { pattern: /\b(red|redness|inflamed|irritated|irritation)\b/i, label: 'Redness or irritation', weight: 16 },
  { pattern: /\b(over.?exfoliat|damaged barrier|barrier damage)\b/i, label: 'Reported barrier damage', weight: 28 },
  { pattern: /\b(dry|dryness|dehydrated)\b/i, label: 'Dryness or dehydration', weight: 10 },
];

export function assessBarrier(text: string, ingredients: IngredientKnowledge[], profile: PatientProfile): BarrierAssessment {
  let deductions = 0;
  const signals: string[] = [];

  for (const signal of signalWeights) {
    if (signal.pattern.test(text)) {
      deductions += signal.weight;
      signals.push(signal.label);
    }
  }

  const highIrritation = ingredients.filter(item => item.irritationRisk === 'high').length;
  const moderateIrritation = ingredients.filter(item => item.irritationRisk === 'moderate').length;
  if (highIrritation) {
    deductions += Math.min(24, highIrritation * 12);
    signals.push(`${highIrritation} high-irritation active${highIrritation > 1 ? 's' : ''}`);
  }
  if (moderateIrritation >= 2) {
    deductions += 8;
    signals.push('Multiple moderate-irritation actives');
  }
  if (profile.sensitiveSkin) {
    deductions += 10;
    signals.push('Sensitive-skin profile');
  }

  const hasBarrierSupport = ingredients.some(item => item.family === 'barrier' || item.family === 'hydrating');
  if (hasBarrierSupport) deductions = Math.max(0, deductions - 8);

  const score = Math.max(0, Math.min(100, 100 - deductions));
  const state: BarrierAssessment['state'] = score >= 80 ? 'stable' : score >= 60 ? 'watch' : score >= 35 ? 'stressed' : 'compromised';
  const confidence: BarrierAssessment['confidence'] = signals.length >= 3 ? 'high' : signals.length >= 1 ? 'moderate' : 'low';
  const recoveryPriority: BarrierAssessment['recoveryPriority'] = state === 'compromised' || state === 'stressed' ? 'high' : state === 'watch' ? 'elevated' : 'routine';
  const recommendedRecoveryNights = state === 'compromised' ? 3 : state === 'stressed' ? 2 : state === 'watch' ? 1 : 0;

  return { score, state, confidence, signals: Array.from(new Set(signals)), recoveryPriority, recommendedRecoveryNights };
}