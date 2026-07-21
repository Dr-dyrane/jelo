import { generateText, Output } from 'ai';
import { z } from 'zod';
import { products } from '@/data/catalogue';
import { baselinePrices, type Market } from '@/data/prices';
import { assessRedFlags } from '@/modules/clinical/safety-gate';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import type { RoutineStep } from '@/modules/clinical/core/types';
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

const requestSchema = z.object({
  query: z.string().trim().min(5).max(1800),
  market: z.enum(['NG', 'US']).default('NG'),
  profile: patientProfileSchema,
});

const reportSchema = z.object({
  title: z.string().max(80),
  summary: z.string().max(420),
  pattern: z.string().max(260),
  routine: z.array(z.object({ time: z.enum(['Morning', 'Evening', 'Weekly', 'Any time']), action: z.string().max(180) })).max(8),
  cautions: z.array(z.string().max(180)).max(6),
  productSlugs: z.array(z.string()).max(4),
  followUp: z.string().max(220),
});

const concernLexicon: Record<string, string[]> = {
  acne: ['acne', 'pimple', 'breakout', 'bumps', 'whitehead', 'blackhead'],
  blackheads: ['blackhead', 'clogged', 'congestion'],
  oiliness: ['oily', 'oiliness', 'greasy', 'shine'],
  hyperpigmentation: ['dark mark', 'dark spot', 'pigmentation', 'uneven tone', 'melasma'],
  sensitivity: ['sensitive', 'burning', 'stinging', 'irritated', 'redness'],
  dryness: ['dry', 'flaky', 'scaly', 'tight'],
  barrier: ['barrier', 'over-exfoliated', 'damaged skin'],
  dandruff: ['dandruff', 'flaky scalp', 'itchy scalp'],
  'dry hair': ['dry hair', 'brittle hair', 'frizz'],
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

function publicProduct(product: (typeof products)[number], market: Market) {
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    image: product.image,
    size: product.size,
    step: product.step,
    displayLine: product.displayLine,
    price: priceFor(product.slug, market),
    retailers: product.offers.filter(offer => offer.available && (offer.location.includes(market) || offer.location.includes('INTL'))).slice(0, 2).map(offer => ({
      retailer: offer.retailer,
      href: `/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}`,
    })),
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

  const { query, market, profile } = parsed.data;
  const concerns = inferConcerns(query);
  const safety = assessRedFlags({ symptoms: [query] });
  const clinical = assessClinicalRoutine(query, { ...profile, concerns, market, sensitiveSkin: profile?.sensitiveSkin ?? concerns.includes('sensitivity') });
  const ranked = rankProducts(products, { concerns, sensitive: clinical.profile?.sensitiveSkin ?? false, location: market }).slice(0, 6);
  const candidates = ranked.map(result => {
    const product = products.find(item => item.slug === result.slug)!;
    return { slug: product.slug, brand: product.brand, name: product.name, step: product.step, bestFor: product.bestFor, concerns: product.concerns, usage: product.usage, sensitiveFriendly: product.sensitiveFriendly };
  });

  const deterministicCautions = clinical.findings.map(finding => `${finding.title}: ${finding.explanation}`);
  const optimizedRoutine = compactRoutine(clinical);

  try {
    const result = await generateText({
      model: process.env.JELOCARE_AI_MODEL ?? 'openai/gpt-5-mini',
      output: Output.object({ schema: reportSchema }),
      maxOutputTokens: 800,
      temperature: 0.2,
      system: 'You are JeloCare, a pharmacist-led skincare guidance assistant. Give concise, cautious self-care guidance, not a diagnosis. Structured clinical findings and the optimized routine are authoritative: never contradict, weaken or omit them. Use only supplied catalogue slugs. Never invent products, prices, retailers, images or links. Clearly advise prompt in-person care for urgent, painful, infected or rapidly worsening symptoms. Return the exact requested structured object.',
      prompt: `USER CONCERN:\n${query}\n\nPATIENT PROFILE:\n${JSON.stringify(clinical.profile)}\n\nINFERRED CONCERNS:\n${concerns.join(', ')}\n\nDETERMINISTIC SAFETY SCREEN:\n${JSON.stringify(safety)}\n\nDETERMINISTIC CLINICAL ASSESSMENT:\n${JSON.stringify(clinical)}\n\nALLOWED PRODUCT CANDIDATES:\n${JSON.stringify(candidates)}\n\nChoose at most four productSlugs only from the candidates. Include every deterministic clinical finding in cautions. Never recommend an ingredient listed in blockedIngredientIds. Keep the explanation aligned with the optimized routine.`,
    });
    const selected = result.output.productSlugs.map(slug => products.find(product => product.slug === slug)).filter((product): product is (typeof products)[number] => Boolean(product)).slice(0, 4);
    const cautions = Array.from(new Set([...deterministicCautions, ...result.output.cautions])).slice(0, 6);
    return Response.json({
      report: { ...result.output, cautions },
      products: selected.map(product => publicProduct(product, market)),
      clinical: { profile: clinical.profile, findings: clinical.findings, blockedIngredientIds: clinical.blockedIngredientIds, activeLoad: clinical.activeLoad, optimizedRoutine, routineSummary: clinical.routinePlan?.summary },
      meta: { modelCalls: 1, market, concerns },
    });
  } catch {
    const selected = ranked.slice(0, 3).map(item => products.find(product => product.slug === item.slug)).filter((product): product is (typeof products)[number] => Boolean(product));
    return Response.json({
      report: {
        title: 'A safer starting point',
        summary: clinical.routinePlan?.summary ?? 'Start with a simple, consistent routine and introduce one treatment at a time.',
        pattern: `The strongest catalogue matches are around ${concerns.join(', ')}. This is guidance, not a diagnosis.`,
        routine: optimizedRoutine.slice(0, 8).map(step => ({ time: step.time, action: step.action })),
        cautions: deterministicCautions.length ? deterministicCautions : ['Stop any product that causes persistent burning, swelling or a rapidly worsening rash.'],
        productSlugs: selected.map(product => product.slug),
        followUp: 'Reassess after two to four weeks, or seek in-person care sooner if the area becomes painful, infected or rapidly spreads.',
      },
      products: selected.map(product => publicProduct(product, market)),
      clinical: { profile: clinical.profile, findings: clinical.findings, blockedIngredientIds: clinical.blockedIngredientIds, activeLoad: clinical.activeLoad, optimizedRoutine, routineSummary: clinical.routinePlan?.summary },
      meta: { modelCalls: 1, market, concerns, fallback: true },
    });
  }
}
