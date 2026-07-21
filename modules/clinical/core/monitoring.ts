import type { BarrierAssessment, DifferentialAssessment, MonitoringPlan, ReferralAssessment, TreatmentGoal } from './types';

function includesPattern(differential: DifferentialAssessment, ids: string[]) {
  return Boolean(differential.primary && ids.includes(differential.primary.id));
}

export function buildTreatmentGoals(input: {
  barrier: BarrierAssessment;
  differential: DifferentialAssessment;
  referral: ReferralAssessment;
}): TreatmentGoal[] {
  const { barrier, differential, referral } = input;
  const urgent = ['urgent', 'emergency'].includes(referral.level);
  if (urgent) return [{ horizon: 'now', title: 'Get assessed safely', objective: referral.action, successMarkers: ['A clinician has assessed the urgent symptoms', 'Immediate danger has been excluded or treated'] }];

  const goals: TreatmentGoal[] = [];
  if (barrier.state === 'stressed' || barrier.state === 'compromised') {
    goals.push({ horizon: 'now', title: 'Settle the barrier', objective: 'Pause irritating treatment steps and restore comfortable cleansing, moisturising and daily photoprotection.', successMarkers: ['Less burning or stinging', 'Less tightness and scaling', 'Moisturiser no longer feels painful'] });
  } else {
    goals.push({ horizon: 'now', title: 'Establish tolerance', objective: 'Use the smallest effective routine consistently without adding multiple new actives.', successMarkers: ['Routine completed most days', 'No persistent burning, swelling or worsening redness'] });
  }

  if (includesPattern(differential, ['acne-vulgaris', 'comedonal-acne', 'folliculitis'])) {
    goals.push({ horizon: '2-weeks', title: 'Reduce new inflammation', objective: 'Aim for fewer new inflamed lesions while protecting the barrier.', successMarkers: ['Fewer painful new spots', 'No spreading inflammation', 'No new scarring'] });
    goals.push({ horizon: '6-weeks', title: 'Confirm treatment response', objective: 'Look for a meaningful reduction in lesion frequency and congestion.', successMarkers: ['Clear downward trend in new lesions', 'Existing lesions settle faster', 'Routine remains tolerable'] });
  } else if (includesPattern(differential, ['post-inflammatory-hyperpigmentation', 'melasma'])) {
    goals.push({ horizon: '2-weeks', title: 'Stop new pigment triggers', objective: 'Prevent additional darkening through daily sunscreen and irritation control.', successMarkers: ['No rapidly darkening areas', 'No new marks caused by irritation'] });
    goals.push({ horizon: '12-weeks', title: 'Assess tone improvement', objective: 'Compare the same areas under similar lighting for gradual fading.', successMarkers: ['Edges appear softer', 'Overall contrast is lower', 'No significant irritation'] });
  } else {
    goals.push({ horizon: '2-weeks', title: 'Confirm comfort', objective: 'Look for less dryness, scaling, itching or redness without increasing treatment complexity.', successMarkers: ['Symptoms are less frequent', 'Skin feels more comfortable after cleansing', 'No worsening spread'] });
    goals.push({ horizon: '6-weeks', title: 'Review the working pattern', objective: 'Reassess whether the leading pattern and routine still fit the response.', successMarkers: ['Clear improvement trend', 'No new warning features', 'Referral is arranged if progress is absent'] });
  }

  return goals;
}

export function buildMonitoringPlan(input: {
  barrier: BarrierAssessment;
  differential: DifferentialAssessment;
  referral: ReferralAssessment;
}): MonitoringPlan {
  const { barrier, differential, referral } = input;
  const expected = barrier.state === 'stressed' || barrier.state === 'compromised'
    ? ['Comfort should begin improving before treatment actives are restarted.', 'Scaling, tightness and stinging should trend downward over days rather than worsen.']
    : ['Improvement is usually gradual; consistency matters more than adding products.', 'Take comparison photos in similar lighting no more than weekly.'];

  if (includesPattern(differential, ['acne-vulgaris', 'comedonal-acne'])) expected.push('Acne improvement is judged by fewer new lesions over several weeks, not overnight clearance.');
  if (includesPattern(differential, ['post-inflammatory-hyperpigmentation', 'melasma'])) expected.push('Pigment change is slow and should be judged over eight to twelve weeks with reliable sunscreen use.');

  const escalationTriggers = [
    'Rapid spread, severe pain, fever, pus, crusting or warmth',
    'Swelling of the face, lips or eyes, breathing difficulty, or widespread blistering',
    'New scarring, deep cysts, eye symptoms or major impact on daily life',
  ];
  if (referral.level !== 'self-care') escalationTriggers.unshift(referral.action);

  return {
    expected,
    acceptableEffects: ['Brief mild tingling that settles quickly after a newly introduced product', 'Temporary mild dryness that improves with reduced frequency and moisturiser'],
    stopCriteria: ['Persistent burning or pain', 'Swelling, hives or blistering', 'Marked redness that lasts into the next day', 'A clearly worsening rash after starting a product'],
    escalationTriggers,
    checkpoints: [
      { label: 'Tolerance check', afterDays: barrier.state === 'compromised' ? 3 : 7, review: 'Check comfort, burning, scaling and whether the routine is being tolerated.' },
      { label: 'Early response', afterDays: 14, review: 'Compare symptom direction and avoid increasing frequency when the barrier is not stable.' },
      { label: 'Clinical review', afterDays: includesPattern(differential, ['post-inflammatory-hyperpigmentation', 'melasma']) ? 84 : 42, review: 'Decide whether to continue, simplify, change the working pattern or seek professional review.' },
    ],
  };
}