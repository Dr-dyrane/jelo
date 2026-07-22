import type { ClinicalAssessment, ClinicalFinding, RoutinePlan, RoutineStep } from './types';

function step(time: RoutineStep['time'], action: string, rationale: string, frequency: RoutineStep['frequency'] = 'daily'): RoutineStep {
  return { time, action, rationale, frequency };
}

export function optimizeRoutine(assessment: ClinicalAssessment): RoutinePlan {
  const ids = new Set(assessment.detectedIngredients.map(item => item.id));
  const findings: ClinicalFinding[] = [...assessment.findings];
  const barrierFirst = assessment.barrier.state === 'stressed' || assessment.barrier.state === 'compromised';
  const morning: RoutineStep[] = [
    step('morning', 'Use a gentle cleanser or rinse with lukewarm water.', 'Avoid unnecessary stripping at the start of the day.'),
  ];
  const evening: RoutineStep[] = [
    step('evening', 'Cleanse gently and remove sunscreen or makeup fully.', 'A clean base reduces residue without requiring aggressive cleansing.'),
  ];
  const weekly: RoutineStep[] = [];

  if (!barrierFirst && ids.has('niacinamide')) morning.push(step('morning', 'Apply niacinamide after cleansing.', 'Supports oil balance, barrier function and uneven tone.'));
  if (!barrierFirst && ids.has('tranexamic-acid')) morning.push(step('morning', 'Apply tranexamic acid before moisturizer.', 'Targets uneven tone without adding exfoliation load.'));
  if (!barrierFirst && ids.has('azelaic-acid')) evening.push(step('evening', 'Use azelaic acid on alternate nights at first.', 'Useful for acne and pigmentation with a moderate irritation profile.', 'alternate-days'));

  const hasRetinoid = assessment.detectedIngredients.some(item => item.family === 'retinoid');
  const hasExfoliant = assessment.detectedIngredients.some(item => item.family === 'exfoliant');
  const hasBenzoylPeroxide = ids.has('benzoyl-peroxide');

  if (!barrierFirst && hasRetinoid && !assessment.blockedIngredientIds.some(id => ids.has(id))) {
    evening.push(step('evening', 'Use the retinoid on two nights per week, then increase only if tolerated.', 'Retinoids work best with gradual introduction.', '2-3x-weekly'));
  }

  if (!barrierFirst && hasExfoliant) {
    weekly.push(step('weekly', 'Use one exfoliating product on a non-retinoid night.', 'Separating exfoliation from retinoids lowers barrier stress.', '1-2x-weekly'));
  }

  if (!barrierFirst && hasBenzoylPeroxide) {
    const time = hasRetinoid ? 'morning' : 'evening';
    const rationale = hasRetinoid ? 'Separating it from a retinoid simplifies the routine and reduces irritation.' : 'Use a thin layer only on acne-prone areas.';
    (time === 'morning' ? morning : evening).push(step(time, 'Use benzoyl peroxide as a thin treatment layer.', rationale, 'alternate-days'));
  }

  morning.push(step('morning', 'Apply moisturizer, then broad-spectrum SPF 30 or higher.', 'Photoprotection is essential for pigmentation control and active tolerance.'));
  evening.push(step('evening', barrierFirst ? 'Apply a bland barrier moisturizer and stop treatment actives temporarily.' : 'Finish with a barrier-supporting moisturizer.', barrierFirst ? 'Recovery takes priority while irritation signals are present.' : 'Reduces dryness and improves tolerance of treatment products.'));

  if (assessment.barrier.recommendedRecoveryNights > 0) {
    const frequency = assessment.barrier.recommendedRecoveryNights >= 3 ? '3x-weekly' : assessment.barrier.recommendedRecoveryNights === 2 ? '2x-weekly' : '1-2x-weekly';
    weekly.push(step('weekly', `Keep at least ${assessment.barrier.recommendedRecoveryNights} recovery night${assessment.barrier.recommendedRecoveryNights > 1 ? 's' : ''} with cleanser and moisturizer only.`, 'The barrier score indicates that deliberate recovery time should outrank additional actives.', frequency));
  } else if (assessment.activeLoad.total >= 3) {
    weekly.push(step('weekly', 'Keep at least two recovery nights with cleanser and moisturizer only.', 'Your detected active load is high enough to justify deliberate recovery time.', '2x-weekly'));
  }

  const summary = assessment.blockedIngredientIds.length
    ? 'Safety restrictions were applied before the routine was assembled.'
    : barrierFirst
      ? 'Barrier recovery takes priority; treatment actives were paused in the optimized routine.'
      : assessment.activeLoad.total >= 3
        ? 'The routine has been simplified to reduce active overload.'
        : 'The routine prioritizes consistency, gradual introduction and barrier support.';

  return { morning, evening, weekly, summary, findings };
}
