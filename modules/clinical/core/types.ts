export type EvidenceLevel = 'high' | 'moderate' | 'limited' | 'insufficient';
export type SafetyStatus = 'safe' | 'caution' | 'avoid' | 'unknown';
export type Severity = 'info' | 'caution' | 'high' | 'urgent';
export type RoutineTime = 'morning' | 'evening' | 'weekly' | 'any';

export type PatientProfile = {
  age?: number;
  pregnant?: boolean;
  breastfeeding?: boolean;
  sensitiveSkin?: boolean;
  allergies?: string[];
  medications?: string[];
  currentIngredients?: string[];
  concerns?: string[];
  market?: 'NG' | 'US';
};

export type EvidenceRecord = {
  id: string;
  title: string;
  source: string;
  sourceType: 'guideline' | 'regulator' | 'systematic-review' | 'clinical-review' | 'consensus';
  level: EvidenceLevel;
  summary: string;
  reviewedAt: string;
  reviewStatus: 'reviewed' | 'needs-review';
};

export type IngredientKnowledge = {
  id: string;
  name: string;
  aliases: string[];
  family: 'retinoid' | 'exfoliant' | 'antimicrobial' | 'brightening' | 'barrier' | 'hydrating' | 'sunscreen' | 'other';
  evidence: EvidenceLevel;
  concerns: string[];
  allowedTimes: RoutineTime[];
  pregnancy: SafetyStatus;
  breastfeeding: SafetyStatus;
  photosensitivity: 'none' | 'low' | 'moderate' | 'high';
  irritationRisk: 'low' | 'moderate' | 'high';
};

export type ClinicalFinding = {
  ruleId: string;
  severity: Severity;
  title: string;
  explanation: string;
  ingredientIds?: string[];
  evidenceIds?: string[];
  evidence?: EvidenceRecord[];
  action: 'allow' | 'adjust' | 'avoid' | 'escalate';
};

export type BarrierAssessment = {
  score: number;
  state: 'stable' | 'watch' | 'stressed' | 'compromised';
  confidence: 'low' | 'moderate' | 'high';
  signals: string[];
  recoveryPriority: 'routine' | 'elevated' | 'high';
  recommendedRecoveryNights: number;
};

export type RoutineStep = {
  time: Exclude<RoutineTime, 'any'>;
  action: string;
  rationale: string;
  frequency: 'daily' | 'alternate-days' | '1-2x-weekly' | '2-3x-weekly' | '2x-weekly' | '3x-weekly';
};

export type RoutinePlan = {
  morning: RoutineStep[];
  evening: RoutineStep[];
  weekly: RoutineStep[];
  summary: string;
  findings: ClinicalFinding[];
};

export type ClinicalTimelineRecord = {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  assessmentType: 'consultation';
  concernSummary: string;
  concerns: string[];
  market: 'NG' | 'US';
  barrier: BarrierAssessment;
  activeLoad: ClinicalAssessment['activeLoad'];
  findingRuleIds: string[];
  blockedIngredientIds: string[];
  detectedIngredientIds: string[];
  routineSummary?: string;
  recommendedProductSlugs: string[];
  followUpAt: string;
};

export type ClinicalAssessment = {
  detectedIngredients: IngredientKnowledge[];
  findings: ClinicalFinding[];
  evidence: EvidenceRecord[];
  blockedIngredientIds: string[];
  activeLoad: {
    exfoliant: number;
    retinoid: number;
    antimicrobial: number;
    total: number;
  };
  barrier: BarrierAssessment;
  profile?: PatientProfile;
  routinePlan?: RoutinePlan;
};