import { generateText, Output } from 'ai';
import { z } from 'zod';
import { products } from '@/data/catalogue';
import { baselinePrices, type Market } from '@/data/prices';
import { assessRedFlags } from '@/modules/clinical/safety-gate';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import { createTimelineRecord } from '@/modules/clinical/core/timeline';
import { analyzeTimeline } from '@/modules/clinical/core/trends';
import type { ClinicalTimelineRecord, RoutineStep } from '@/modules/clinical/core/types';
import { clinicallyFilterProducts, type ClinicalProductDecision } from '@/modules/recommendations/clinical-product-filter';
import { rankProducts } from '@/modules/recommendations/product-ranker';

export const maxDuration = 30;

const patientProfileSchema = z.object({
  age: z.number().int().min(12).max(100).optional(),
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
  return hits.length ? hits : ['sensitivity', 'dryness', 'acne'];
}

function priceFor(slug: string, market: Market) {
  const entry = baselinePrices[slug];
  const price = entry?.[market] ?? entry?.NG ?? entry?.US;
  return price ? { amount: price.amount, currency: price.currency, retailer: price.retailer, market: price.market } : null;
}

function publicProduct(product: (typeof products)[number], market: Market, decision?: ClinicalProductDecision) {
  return {
    slug: product.slug, brand: product.brand, name: product.name, image: product.image, size: product.size, step: product.step, displayLine: product.displayLine, price: priceFor(product.slug, market),
    clinicalMatch: decision ? { reasons: decision.reasons, ingredientIds: decision.ingredientIds, score: decision.clinicalScore } : undefined,
    retailers: product.offers.filter(offer => offer.available && (offer.location.includes(market) || offer.location.includes('INTL'))).slice(0, 2).map(offer => ({ retailer: offer.retailer, href: `/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}` })),
  };
}

function publicRoutineStep(step: RoutineStep) {
  const time = step.time === 'morning' ? 'Morning' : step.time === 'evening' ? 'Evening' : 'Weekly';
  return { time, action: step.action, rationale: step.rationale, frequency: step.frequency };
}

function compactRoutine(clinical: ReturnType<typeof assessClinicalRoutine>) {
  const plan = clinical.routinePlan;
  if (!plan) return [];
  return [...plan.morning, ...plan.evening, ...plan.weekly].slice(0, 10).map(publicRoutineStep);
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Please describe the concern in a little more detail.' }, { status: 400 });

  const { query, market, profile, priorTimeline = [] } = parsed.data;
  const concerns = inferConcerns(query);
  const safety = assessRedFlags({ symptoms: [query] });
  const clinical = assessClinicalRoutine(query, { ...profile, concerns, market, sensitiveSkin: profile?.sensitiveSkin ?? concerns.includes('sensitivity') });
  const ranked = rankProducts(products, { concerns, sensitive: clinical.profile?.sensitiveSkin ?? false, location: market });
  const rankScore = new Map(ranked.map(item => [item.slug, item.score]));
  const allowProducts = !['urgent', 'emergency'].includes(clinical.referral.level);
  const eligible = allowProducts ? clinicallyFilterProducts(products, clinical, priorTimeline as ClinicalTimelineRecord[])
    .filter(item => rankScore.has(item.product.slug))
    .sort((a, b) => ((rankScore.get(b.product.slug) ?? 0) + b.decision.clinicalScore) - ((rankScore.get(a.product.slug) ?? 0) + a.decision.clinicalScore))
    .slice(0, 8) : [];
  const eligibleBySlug = new Map(eligible.map(item => [item.product.slug, item]));
  const candidates = eligible.map(({ product, decision }) => ({ slug: product.slug, brand: product.brand, name: product.name, step: product.step, bestFor: product.bestFor, concerns: product.concerns, usage: product.usage, sensitiveFriendly: product.sensitiveFriendly, clinicalReasons: decision.reasons, ingredientIds: decision.ingredientIds }));

  const deterministicCautions = [...clinical.findings.map(finding => `${finding.title}: ${finding.explanation}`), `${clinical.referral.level}: ${clinical.referral.action}`];
  const optimizedRoutine = compactRoutine(clinical);
  const publicClinical = { profile: clinical.profile, findings: clinical.findings, evidence: clinical.evidence, blockedIngredientIds: clinical.blockedIngredientIds, activeLoad: clinical.activeLoad, barrier: clinical.barrier, differential: clinical.differential, referral: clinical.referral, treatmentGoals: clinical.treatmentGoals, monitoring: clinical.monitoring, optimizedRoutine, routineSummary: clinical.routinePlan?.summary, eligibleProductCount: eligible.length };

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
      system: 'You are JeloCare, a pharmacist-led skincare guidance assistant. Give concise, cautious self-care guidance, not a diagnosis. The deterministic differential, referral pathway, treatment goals, monitoring plan, clinical findings, timeline trends, product eligibility and optimized routine are authoritative: never contradict, weaken or omit them. Use only supplied catalogue slugs. Never invent products, prices, retailers, images or links. If referral is urgent or emergency, recommend no products and prioritize the referral action. Return the exact requested structured object.',
      prompt: `USER CONCERN:\n${query}\n\nPATIENT PROFILE:\n${JSON.stringify(clinical.profile)}\n\nINFERRED CONCERNS:\n${concerns.join(', ')}\n\nDETERMINISTIC SAFETY SCREEN:\n${JSON.stringify(safety)}\n\nDETERMINISTIC DIFFERENTIAL:\n${JSON.stringify(clinical.differential)}\n\nDETERMINISTIC REFERRAL:\n${JSON.stringify(clinical.referral)}\n\nDETERMINISTIC GOALS AND MONITORING:\n${JSON.stringify({ treatmentGoals: clinical.treatmentGoals, monitoring: clinical.monitoring })}\n\nDETERMINISTIC CLINICAL ASSESSMENT:\n${JSON.stringify(clinical)}\n\nCLINICALLY ELIGIBLE PRODUCT CANDIDATES:\n${JSON.stringify(candidates)}\n\nChoose at most four productSlugs only from the eligible candidates. Product eligibility and referral are final. Include every deterministic clinical finding and referral action in cautions. Keep the explanation aligned with the optimized routine.`,
    });
    const selected = selectedProducts(result.output.productSlugs);
    const selectedSlugs = selected.map(item => item.product.slug);
    const cautions = Array.from(new Set([...deterministicCautions, ...result.output.cautions])).slice(0, 6);
    return Response.json({ report: { ...result.output, productSlugs: selectedSlugs, cautions }, products: selected.map(item => publicProduct(item.product, market, item.decision)), clinical: publicClinical, recommendationAudit: { candidateCount: candidates.length, selectedCount: selected.length, deterministic: true }, ...timelinePayload(selectedSlugs), meta: { modelCalls: 1, market, concerns, clinicalSchemaVersion: 3 } });
  } catch {
    const selected = eligible.slice(0, 3);
    const selectedSlugs = selected.map(item => item.product.slug);
    const urgent = ['urgent', 'emergency'].includes(clinical.referral.level);
    return Response.json({
      report: { title: urgent ? 'In-person care comes first' : 'A safer starting point', summary: urgent ? clinical.referral.action : clinical.routinePlan?.summary ?? 'Start with a simple, consistent routine and introduce one treatment at a time.', pattern: clinical.differential.primary ? `${clinical.differential.primary.label} is the leading working pattern at ${clinical.differential.primary.confidence}% confidence. This is not a diagnosis.` : 'The description is not yet specific enough for a confident working pattern.', routine: urgent ? [] : optimizedRoutine.slice(0, 8).map(step => ({ time: step.time, action: step.action })), cautions: deterministicCautions.slice(0, 6), productSlugs: selectedSlugs, followUp: clinical.referral.action },
      products: selected.map(item => publicProduct(item.product, market, item.decision)), clinical: publicClinical, recommendationAudit: { candidateCount: candidates.length, selectedCount: selected.length, deterministic: true }, ...timelinePayload(selectedSlugs), meta: { modelCalls: 1, market, concerns, clinicalSchemaVersion: 3, fallback: true },
    });
  }
}