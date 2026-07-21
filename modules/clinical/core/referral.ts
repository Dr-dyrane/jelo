import type { BarrierAssessment, ClinicalFinding, DifferentialAssessment, PatientProfile, ReferralAssessment } from './types';

const emergencyTerms = ['trouble breathing', 'difficulty breathing', 'swollen tongue', 'swollen throat', 'fainting', 'anaphylaxis'];
const urgentTerms = ['rapidly spreading', 'severe pain', 'eye swelling', 'face swelling', 'blistering', 'skin peeling', 'fever', 'pus', 'infected', 'painful rash'];
const specialistTerms = ['scarring', 'deep cyst', 'nodules', 'persistent redness', 'visible veins', 'recurrent rash', 'months', 'not improving'];

function hits(text: string, terms: string[]) {
  return terms.filter(term => text.includes(term));
}

export function assessReferral(input: {
  text: string;
  profile: PatientProfile;
  barrier: BarrierAssessment;
  findings: ClinicalFinding[];
  differential: DifferentialAssessment;
}): ReferralAssessment {
  const normalized = input.text.toLowerCase();
  const emergency = hits(normalized, emergencyTerms);
  if (emergency.length) return {
    level: 'emergency', urgency: 'immediate', reasons: emergency.map(term => `Reported ${term}.`),
    action: 'Seek emergency care now. Do not rely on skincare self-treatment.',
  };

  const urgent = hits(normalized, urgentTerms);
  if (urgent.length || input.findings.some(item => item.severity === 'urgent')) return {
    level: 'urgent', urgency: 'same-day', reasons: [...urgent.map(term => `Reported ${term}.`), ...input.findings.filter(item => item.severity === 'urgent').map(item => item.title)].slice(0, 5),
    action: 'Arrange same-day in-person medical assessment.',
  };

  if (input.barrier.state === 'compromised') return {
    level: 'primary-care', urgency: 'soon', reasons: ['Barrier assessment is compromised.', ...input.barrier.signals.slice(0, 3)],
    action: 'Pause treatment actives and arrange clinician or pharmacist review within a few days, sooner if worsening.',
  };

  const specialist = hits(normalized, specialistTerms);
  const primaryId = input.differential.primary?.id;
  if (specialist.length || ['rosacea', 'folliculitis'].includes(primaryId ?? '')) return {
    level: 'dermatology', urgency: 'soon', reasons: specialist.length ? specialist.map(term => `Reported ${term}.`) : [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Arrange a non-urgent dermatology or primary-care review for diagnostic confirmation and treatment planning.',
  };

  if (input.profile.pregnant || input.profile.breastfeeding || input.findings.some(item => item.action === 'avoid')) return {
    level: 'pharmacist', urgency: 'soon', reasons: [input.profile.pregnant ? 'Pregnancy changes ingredient suitability.' : '', input.profile.breastfeeding ? 'Breastfeeding changes ingredient suitability.' : '', ...input.findings.filter(item => item.action === 'avoid').map(item => item.title)].filter(Boolean),
    action: 'Review the routine with a pharmacist or clinician before starting new treatment actives.',
  };

  if (input.differential.confidence === 'low') return {
    level: 'pharmacist', urgency: 'routine', reasons: ['The description does not yet support a confident working pattern.', ...input.differential.questions.slice(0, 2)],
    action: 'Self-care can remain simple, but a pharmacist review would improve pattern recognition before adding treatment.',
  };

  return {
    level: 'self-care', urgency: 'routine', reasons: ['No urgent escalation trigger was detected.', `The working pattern is ${input.differential.primary?.label ?? 'not yet specific'}.`],
    action: 'A conservative self-care routine with planned follow-up is reasonable. Escalate sooner if pain, infection, swelling or rapid spread develops.',
  };
}
