import type { ClinicalTimelineRecord, TimelineInsight } from './types';

function sameCareArea(a: ClinicalTimelineRecord, b: ClinicalTimelineRecord) {
  return a.concerns.some(concern => b.concerns.includes(concern));
}

export function analyzeTimeline(previous: ClinicalTimelineRecord[], current: ClinicalTimelineRecord): TimelineInsight {
  const comparable = [...previous]
    .filter(record => record.id !== current.id && sameCareArea(record, current))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const prior = comparable[0];

  if (!prior) {
    return {
      direction: 'first-assessment',
      barrierDelta: null,
      activeLoadDelta: null,
      summary: 'This is the first comparable assessment in this care area. It establishes a baseline for future change.',
      actions: ['Follow the simplified routine consistently.', 'Reassess on or before the planned follow-up date.'],
      confidence: 'low',
    };
  }

  const barrierDelta = current.barrier.score - prior.barrier.score;
  const activeLoadDelta = current.activeLoad.total - prior.activeLoad.total;
  const daysApart = Math.max(0, Math.round((Date.parse(current.createdAt) - Date.parse(prior.createdAt)) / 86400000));
  let direction: TimelineInsight['direction'] = 'stable';

  if (barrierDelta >= 8 && activeLoadDelta <= 0) direction = 'improving';
  else if (barrierDelta <= -8 || current.barrier.state === 'compromised') direction = 'worsening';
  else if ((barrierDelta > 3 && activeLoadDelta > 0) || (barrierDelta < -3 && activeLoadDelta < 0)) direction = 'mixed';

  const actions: string[] = [];
  if (direction === 'improving') actions.push('Keep the current routine unchanged long enough to confirm tolerance.');
  if (direction === 'worsening') actions.push('Pause treatment escalation and prioritize recovery steps.');
  if (direction === 'mixed') actions.push('Avoid adding another active until the next reassessment clarifies the direction.');
  if (direction === 'stable') actions.push('Consistency is the priority; change only one variable at a time.');
  if (activeLoadDelta > 0) actions.push('The active load increased; watch closely for delayed irritation.');
  if (current.blockedIngredientIds.length > prior.blockedIngredientIds.length) actions.push('New safety restrictions were triggered and should override the previous routine.');

  const summaryByDirection: Record<Exclude<TimelineInsight['direction'], 'first-assessment'>, string> = {
    improving: `Reported barrier signals improved across ${daysApart} day${daysApart === 1 ? '' : 's'} without a higher active load.`,
    worsening: 'Reported barrier signals worsened and the current guide needs a more conservative recovery plan.',
    mixed: `Some measures improved while treatment load or tolerance moved in the opposite direction.`,
    stable: 'The reported barrier signals remain broadly stable.',
  };

  return {
    direction,
    barrierDelta,
    activeLoadDelta,
    previousAssessmentAt: prior.createdAt,
    summary: summaryByDirection[direction],
    actions: actions.slice(0, 3),
    confidence: comparable.length >= 2 ? 'high' : 'moderate',
  };
}
