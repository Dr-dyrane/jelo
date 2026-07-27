import { generateText, Output } from 'ai';
import { z } from 'zod';
import { products } from '@/data/catalogue';
import { concernBySlug } from '@/data/knowledge';
import type { Market } from '@/data/prices';
import type { Product } from '@/data/products';
import { assessConsultSafety } from '@/modules/clinical/safety-gate';
import {
  assessOrdinaryCareIntent,
  type OrdinaryCareIntent,
} from '@/modules/clinical/core/care-intent';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import { createTimelineRecord } from '@/modules/clinical/core/timeline';
import { analyzeTimeline } from '@/modules/clinical/core/trends';
import type { ClinicalFinding, ClinicalTimelineRecord, EvidenceRecord, RoutineStep } from '@/modules/clinical/core/types';
import { marketProductPrice, marketRetailerLinks } from '@/modules/commerce/market-product';
import { clinicallyFilterProducts, type ClinicalProductDecision } from '@/modules/recommendations/clinical-product-filter';
import { rankProducts } from '@/modules/recommendations/product-ranker';

export const maxDuration = 30;

const patientProfileSchema = z.object({
  age: z.number().int().min(0).max(100).optional(),
  pregnant: z.boolean().optional(),
  breastfeeding: z.boolean().optional(),
  sensitiveSkin: z.boolean().optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  medications: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  currentIngredients: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
}).optional();

const timelineRecordSchema = z.object({
  id: z.string().max(80), schemaVersion: z.literal(1), createdAt: z.string().datetime(), assessmentType: z.literal('consultation'), concernSummary: z.string().max(240), concerns: z.array(z.string().max(80)).max(12), market: z.enum(['NG', 'US']),
  barrier: z.object({ score: z.number().min(0).max(100), state: z.enum(['stable', 'watch', 'stressed', 'compromised']), confidence: z.enum(['low', 'moderate', 'high']), signals: z.array(z.string().max(80)).max(20), recoveryPriority: z.enum(['routine', 'elevated', 'high']), recommendedRecoveryNights: z.number().int().min(0).max(7) }),
  activeLoad: z.object({ exfoliant: z.number().int().min(0).max(20), retinoid: z.number().int().min(0).max(20), antimicrobial: z.number().int().min(0).max(20), total: z.number().int().min(0).max(40) }),
  findingRuleIds: z.array(z.string().max(120)).max(30), blockedIngredientIds: z.array(z.string().max(120)).max(30), detectedIngredientIds: z.array(z.string().max(120)).max(40), routineSummary: z.string().max(300).optional(), recommendedProductSlugs: z.array(z.string().max(120)).max(10), followUpAt: z.string().datetime(),
});

const requestSchema = z.object({ query: z.string().trim().min(5).max(1800), market: z.enum(['NG', 'US']).default('NG'), profile: patientProfileSchema, priorTimeline: z.array(timelineRecordSchema).max(8).optional() });
const reportSchema = z.object({ title: z.string().max(80), summary: z.string().max(420), pattern: z.string().max(260), routine: z.array(z.object({ time: z.enum(['Morning', 'Evening', 'Weekly', 'Any time']), action: z.string().max(180) })).max(8), cautions: z.array(z.string().max(180)).max(6), productSlugs: z.array(z.string()).max(4), followUp: z.string().max(220) });

const concernLexicon: Record<string, string[]> = {
  acne: ['acne', 'pimple', 'breakout', 'bumps', 'whitehead', 'blackhead'], blackheads: ['blackhead', 'clogged', 'congestion'], oiliness: ['oily', 'oiliness', 'greasy', 'shine'], hyperpigmentation: ['dark mark', 'dark spot', 'pigmentation', 'uneven tone', 'melasma'], sensitivity: ['sensitive', 'burning', 'stinging', 'irritated', 'redness'], dryness: ['dry', 'flaky', 'scaly', 'tight'], barrier: ['barrier', 'over-exfoliated', 'damaged skin'], dandruff: ['dandruff', 'flaky scalp', 'itchy scalp'], 'dry hair': ['dry hair', 'brittle hair', 'frizz'],
};

function inferConcerns(query: string) {
  const normalized = query.toLowerCase();
  const hits = Object.entries(concernLexicon).filter(([, terms]) => terms.some(term => normalized.includes(term))).map(([concern]) => concern);
  return hits;
}

function publicProduct(product: Product, market: Market, decision?: ClinicalProductDecision) {
  return {
    slug: product.slug, brand: product.brand, name: product.name, image: product.image, size: product.size, category: product.category, price: marketProductPrice(product, market),
    clinicalMatch: decision ? { reasons: decision.reasons, ingredientIds: decision.ingredientIds, score: decision.clinicalScore } : undefined,
    retailers: marketRetailerLinks(product, market),
  };
}

export function buildConsultProductCandidate(product: Product, decision: ClinicalProductDecision) {
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    approvedUseIds: decision.approvedUseIds,
    clinicalReasons: decision.reasons,
    ingredientIds: decision.ingredientIds,
  };
}

function publicRoutineStep(step: RoutineStep) {
  const time: 'Morning' | 'Evening' | 'Weekly' = step.time === 'morning' ? 'Morning' : step.time === 'evening' ? 'Evening' : 'Weekly';
  return { time, action: step.action, rationale: step.rationale, frequency: step.frequency };
}

function publicGuidanceNote(note: EvidenceRecord) {
  return { id: note.id, title: note.title, source: note.source, sourceType: note.sourceType, summary: note.summary };
}

function publicFinding(finding: ClinicalFinding) {
  return { ...finding, evidence: finding.evidence?.map(publicGuidanceNote) };
}

function compactRoutine(clinical: ReturnType<typeof assessClinicalRoutine>) {
  const plan = clinical.routinePlan;
  if (!plan) return [];
  return [...plan.morning, ...plan.evening, ...plan.weekly].slice(0, 10).map(publicRoutineStep);
}

export function buildDeterministicConsultReport(
  clinical: ReturnType<typeof assessClinicalRoutine>,
  selectedSlugs: string[],
  _modelDraft?: z.infer<typeof reportSchema>,
): z.infer<typeof reportSchema> {
  void _modelDraft;
  const routine = compactRoutine(clinical).slice(0, 8).map(step => ({ time: step.time, action: step.action }));
  const cautions = [
    ...clinical.findings.map(finding => `${finding.title}: ${finding.explanation}`),
    `${clinical.referral.level}: ${clinical.referral.action}`,
  ].slice(0, 6);
  const pattern = clinical.differential.primary
    ? `${clinical.differential.primary.label} is the leading working pattern. This is not a diagnosis.`
    : 'The description is not yet specific enough for a working pattern.';

  return {
    title: clinical.referral.level === 'self-care' ? 'A careful starting point.' : 'Check before you continue.',
    summary: clinical.referral.level === 'self-care'
      ? clinical.routinePlan?.summary ?? 'Keep the routine simple and introduce one change at a time.'
      : clinical.referral.action,
    pattern,
    routine: clinical.referral.level === 'self-care' ? routine : [],
    cautions,
    productSlugs: selectedSlugs,
    followUp: clinical.referral.action,
  };
}

export function buildDeterministicCareIntentReport(
  careIntent: OrdinaryCareIntent,
  selectedSlugs: string[],
): z.infer<typeof reportSchema> {
  const canonicalConcerns = careIntent.concernSlugs
    .map(concernBySlug)
    .filter((concern): concern is NonNullable<typeof concern> => Boolean(concern));
  const requestedCare = careIntent.labels.map(label => label.toLowerCase()).join(' and ');

  return {
    title: 'A simple place to start.',
    summary: selectedSlugs.length
      ? `These options were checked for ${requestedCare}.`
      : `JeloCare does not have a suitable direct match for ${requestedCare} yet.`,
    pattern: `You asked about ${requestedCare}. JeloCare treated this as everyday care, not a diagnosis.`,
    routine: careIntent.routine,
    cautions: canonicalConcerns.map(concern => concern.escalation).slice(0, 3),
    productSlugs: selectedSlugs,
    followUp: canonicalConcerns[0]?.escalation
      ?? 'Get in-person care if the concern becomes painful, spreads quickly or does not improve.',
  };
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Please describe the concern in a little more detail.' }, { status: 400 });

  const { query, market, profile, priorTimeline = [] } = parsed.data;
  const concerns = inferConcerns(query);
  const clinical = assessClinicalRoutine(query, { ...profile, concerns, market, sensitiveSkin: profile?.sensitiveSkin ?? concerns.includes('sensitivity') });
  const safety = assessConsultSafety({ text: query, profile: clinical.profile ?? {}, referral: clinical.referral });
  const optimizedRoutine = compactRoutine(clinical);
  const publicClinical = { profile: clinical.profile, findings: clinical.findings.map(publicFinding), evidence: clinical.evidence.map(publicGuidanceNote), blockedIngredientIds: clinical.blockedIngredientIds, activeLoad: clinical.activeLoad, barrier: clinical.barrier, differential: clinical.differential, referral: clinical.referral, treatmentGoals: clinical.treatmentGoals, monitoring: clinical.monitoring, optimizedRoutine, routineSummary: clinical.routinePlan?.summary, eligibleProductCount: 0 };

  if (safety.stopJourney) {
    const title = safety.level === 'emergency' ? 'Get help now.' : safety.level === 'urgent' ? 'Please get care today.' : 'Check first.';
    return Response.json({
      report: {
        title,
        summary: safety.action,
        pattern: 'JeloCare stopped before product guidance.',
        routine: [],
        cautions: safety.reasons.slice(0, 6),
        productSlugs: [],
        followUp: safety.action,
      },
      products: [],
      clinical: publicClinical,
      recommendationAudit: { candidateCount: 0, selectedCount: 0, deterministic: true },
      meta: { modelCalls: 0, market, concerns, clinicalSchemaVersion: 4, safetyInterrupt: true, safetyLevel: safety.level },
    });
  }

  const careIntent = assessOrdinaryCareIntent(query, clinical.differential);
  if (careIntent) {
    const ranked = rankProducts(products, {
      concerns: [],
      concernSlugs: careIntent.concernSlugs,
      sensitive: clinical.profile?.sensitiveSkin ?? false,
      location: market,
    });
    const rankScore = new Map(ranked.map(item => [item.slug, item.score]));
    const eligible = clinicallyFilterProducts(
      products,
      clinical,
      priorTimeline as ClinicalTimelineRecord[],
      { concerns: [], concernSlugs: careIntent.concernSlugs },
    )
      .filter(item => rankScore.has(item.product.slug))
      .sort((a, b) => {
        const scoreDifference = (
          (rankScore.get(b.product.slug) ?? 0) + b.decision.clinicalScore
        ) - (
          (rankScore.get(a.product.slug) ?? 0) + a.decision.clinicalScore
        );
        return scoreDifference || a.product.slug.localeCompare(b.product.slug);
      })
      .slice(0, 8);
    const selected = eligible.slice(0, 4);
    const selectedSlugs = selected.map(item => item.product.slug);

    return Response.json({
      report: buildDeterministicCareIntentReport(careIntent, selectedSlugs),
      products: selected.map(item => publicProduct(item.product, market, item.decision)),
      careIntent: {
        concernSlugs: careIntent.concernSlugs,
        labels: careIntent.labels,
      },
      recommendationAudit: {
        candidateCount: eligible.length,
        selectedCount: selected.length,
        deterministic: true,
      },
      meta: {
        modelCalls: 0,
        market,
        concerns,
        concernSlugs: careIntent.concernSlugs,
        clinicalSchemaVersion: 4,
        ordinaryCare: true,
      },
    });
  }

  const needsClarification = !clinical.differential.primary || clinical.differential.confidence === 'low';
  if (needsClarification) {
    const questions = clinical.differential.questions.length
      ? clinical.differential.questions
      : ['Where is it?', 'What does it look or feel like?', 'When did it start?'];
    return Response.json({
      report: {
        title: 'A little more, please.',
        summary: 'Add the location, what you notice, and when it began.',
        pattern: 'There is not enough detail for a useful working pattern yet.',
        routine: [],
        cautions: ['Pain, swelling, fever, eye symptoms, blistering, or rapid spread need in-person care.'],
        productSlugs: [],
        followUp: questions.slice(0, 3).join(' '),
      },
      products: [],
      clinical: publicClinical,
      recommendationAudit: { candidateCount: 0, selectedCount: 0, deterministic: true },
      meta: { modelCalls: 0, market, concerns, clinicalSchemaVersion: 4, needsClarification: true },
    });
  }

  const ranked = rankProducts(products, { concerns, sensitive: clinical.profile?.sensitiveSkin ?? false, location: market });
  const rankScore = new Map(ranked.map(item => [item.slug, item.score]));
  const eligible = safety.allowProducts ? clinicallyFilterProducts(products, clinical, priorTimeline as ClinicalTimelineRecord[])
    .filter(item => rankScore.has(item.product.slug))
    .sort((a, b) => ((rankScore.get(b.product.slug) ?? 0) + b.decision.clinicalScore) - ((rankScore.get(a.product.slug) ?? 0) + a.decision.clinicalScore))
    .slice(0, 8) : [];
  const eligibleBySlug = new Map(eligible.map(item => [item.product.slug, item]));
  const candidates = eligible.map(({ product, decision }) => buildConsultProductCandidate(product, decision));

  publicClinical.eligibleProductCount = eligible.length;

  function timelinePayload(selectedSlugs: string[]) {
    const timeline = createTimelineRecord({ query, concerns, market, clinical, recommendedProductSlugs: selectedSlugs });
    return { timeline, timelineInsight: analyzeTimeline(priorTimeline as ClinicalTimelineRecord[], timeline) };
  }

  function selectedProducts(slugs: string[]) {
    return Array.from(new Set(slugs)).map(slug => eligibleBySlug.get(slug)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 4);
  }

  try {
    const result = await generateText({
      model: process.env.JELOCARE_AI_MODEL ?? 'openai/gpt-5-mini', output: Output.object({ schema: reportSchema }), maxOutputTokens: 800, temperature: 0.2,
      system: 'You are JeloCare, a skin-education and product-navigation assistant. Give concise, cautious guidance, never a diagnosis. Use only supplied catalogue slugs. Never invent products, prices, retailers, images or links. The server renders all care, safety, pattern and referral copy deterministically. Return the exact requested structured object.',
      prompt: `USER CONCERN:\n${query}\n\nPATIENT PROFILE:\n${JSON.stringify(clinical.profile)}\n\nINFERRED CONCERNS:\n${concerns.join(', ')}\n\nDETERMINISTIC SAFETY SCREEN:\n${JSON.stringify(safety)}\n\nDETERMINISTIC DIFFERENTIAL:\n${JSON.stringify(clinical.differential)}\n\nDETERMINISTIC REFERRAL:\n${JSON.stringify(clinical.referral)}\n\nDETERMINISTIC GOALS AND MONITORING:\n${JSON.stringify({ treatmentGoals: clinical.treatmentGoals, monitoring: clinical.monitoring })}\n\nDETERMINISTIC CLINICAL ASSESSMENT:\n${JSON.stringify(clinical)}\n\nFILTERED CATALOGUE CANDIDATES:\n${JSON.stringify(candidates)}\n\nChoose at most four productSlugs only from the supplied candidates. Care and referral copy in this object is advisory and will not be shown.`,
    });
    const selected = selectedProducts(result.output.productSlugs);
    const selectedSlugs = selected.map(item => item.product.slug);
    const report = buildDeterministicConsultReport(clinical, selectedSlugs, result.output);
    return Response.json({ report, products: selected.map(item => publicProduct(item.product, market, item.decision)), clinical: publicClinical, recommendationAudit: { candidateCount: candidates.length, selectedCount: selected.length, deterministic: true }, ...timelinePayload(selectedSlugs), meta: { modelCalls: 1, market, concerns, clinicalSchemaVersion: 4 } });
  } catch {
    const selected = eligible.slice(0, 3);
    const selectedSlugs = selected.map(item => item.product.slug);
    const report = buildDeterministicConsultReport(clinical, selectedSlugs);
    return Response.json({
      report,
      products: selected.map(item => publicProduct(item.product, market, item.decision)), clinical: publicClinical, recommendationAudit: { candidateCount: candidates.length, selectedCount: selected.length, deterministic: true }, ...timelinePayload(selectedSlugs), meta: { modelCalls: 1, market, concerns, clinicalSchemaVersion: 4, fallback: true },
    });
  }
}
