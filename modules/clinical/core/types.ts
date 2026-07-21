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
  action: 'allow' | 'adjust' | 'avoid' | 'escalate';
};

export type ClinicalAssessment = {
  detectedIngredients: IngredientKnowledge[];
  findings: ClinicalFinding[];
  blockedIngredientIds: string[];
  activeLoad: {
    exfoliant: number;
    retinoid: number;
    antimicrobial: number;
    total: number;
  };
};
