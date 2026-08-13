import { z } from 'zod';
import { after } from 'next/server';
import { products } from '@/data/catalogue';
import { concerns as knowledgeConcerns } from '@/data/knowledge';
import type { Market } from '@/data/prices';
import type { Product } from '@/data/products';
import { sameSiteRequest } from '@/lib/community-intake/request-security';
import { readBoundedConsultJson } from '@/lib/consult/request-body';
import { checkConsultRateLimit } from '@/lib/consult/security';
import {
  consultIntakeShadowConfig,
  runConsultIntakeShadow,
} from '@/lib/consult/ai-intake-shadow';
import type { ConsultAiOutcome } from '@/lib/consult/ai-generation-repository';
import { marketProductPrice, marketRetailerLinks } from '@/modules/commerce/market-product';
import {
  buildDeterministicCareIntentReport,
  buildDeterministicConditionGuideReport,
  concernGuideForClinicalAssessment,
} from '@/modules/clinical/consult-report';
import {
  createConsultTimelineRecord,
  type ConsultTimelineRecord,
} from '@/modules/clinical/consult-timeline';
import { assessOrdinaryCareIntent } from '@/modules/clinical/core/care-intent';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import { assessConsultSafety } from '@/modules/clinical/safety-gate';
import { clinicallyFilterProducts } from '@/modules/recommendations/clinical-product-filter';
import { rankProducts } from '@/modules/recommendations/product-ranker';

const patientProfileSchema = z.object({
  age: z.number().int().min(0).max(100).optional(),
  pregnant: z.boolean().optional(),
  breastfeeding: z.boolean().optional(),
  sensitiveSkin: z.boolean().optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  medications: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  currentIngredients: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
}).optional();

const timelineRecordBaseSchema = z.object({
  id: z.string().max(80),
  createdAt: z.string().datetime(),
  assessmentType: z.literal('consultation'),
  market: z.enum(['NG', 'US']),
  recommendedProductSlugs: z.array(z.string().max(120)).max(10),
  followUpAt: z.string().datetime(),
});

const timelineRecordV2InputSchema = timelineRecordBaseSchema.extend({
  schemaVersion: z.literal(2),
  concernSlugs: z.array(z.string().max(120)).max(12),
});

const legacyTimelineRecordV1InputSchema = timelineRecordBaseSchema.extend({
  schemaVersion: z.literal(1),
  concerns: z.array(z.string().max(80)).max(12),
});

const timelineRecordInputSchema = z.discriminatedUnion('schemaVersion', [
  legacyTimelineRecordV1InputSchema,
  timelineRecordV2InputSchema,
]);

const requestSchema = z.object({
  query: z.string().trim().min(5).max(1800),
  market: z.enum(['NG', 'US']).default('NG'),
  profile: patientProfileSchema,
  clientSchemaVersion: z.literal(2).optional(),
  priorTimeline: z.array(timelineRecordInputSchema).max(8).optional(),
  memberContext: z.object({
    concernSlugs: z.array(z.string().trim().min(1).max(120)).max(12),
    productSlugs: z.array(z.string().trim().min(1).max(180)).max(30),
  }).optional(),
});

const reviewedConcernSlugs = new Set(
  knowledgeConcerns
    .filter(concern => concern.kind === 'concern')
    .map(concern => concern.slug),
);
const catalogueBySlug = new Map(products.map(product => [product.slug, product]));

type TimelineRecordInput = z.infer<typeof timelineRecordInputSchema>;

function normalizeTimelineRecord(record: TimelineRecordInput): ConsultTimelineRecord {
  return {
    id: record.id,
    schemaVersion: 2,
    createdAt: record.createdAt,
    assessmentType: 'consultation',
    concernSlugs: [...new Set(
      record.schemaVersion === 2 ? record.concernSlugs : record.concerns,
    )],
    market: record.market,
    recommendedProductSlugs: [...new Set(record.recommendedProductSlugs)],
    followUpAt: record.followUpAt,
  };
}

function responseMeta<T extends Record<string, unknown>>(meta: T, legacyClient: boolean) {
  return legacyClient
    ? { ...meta, concerns: [] as string[] }
    : meta;
}

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
  return Object.entries(concernLexicon)
    .filter(([, terms]) => terms.some(term => normalized.includes(term)))
    .map(([concern]) => concern);
}

function publicProduct(product: Product, market: Market) {
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    image: product.image,
    size: product.size,
    category: product.category,
    price: marketProductPrice(product, market),
    retailers: marketRetailerLinks(product, market),
  };
}

function timelinePayload(input: {
  concernSlugs: string[];
  market: Market;
  selectedSlugs: string[];
}) {
  const timeline = createConsultTimelineRecord({
    concernSlugs: input.concernSlugs,
    market: input.market,
    recommendedProductSlugs: input.selectedSlugs,
  });

  return { timeline };
}

function clarificationReport(questions: string[]) {
  return {
    title: 'A little more, please.',
    summary: 'Add the location, what you notice, and when it began.',
    pattern: 'There is not enough detail for a useful working pattern yet.',
    routine: [],
    cautions: [
      'Pain, swelling, fever, eye symptoms, blistering, or rapid spread need in-person care.',
    ],
    productSlugs: [],
    followUp: questions.slice(0, 3).join(' '),
  };
}

function consultResponseWithIntakeShadow(
  payload: Record<string, unknown>,
  input: { query: string; deterministicOutcome: ConsultAiOutcome },
) {
  if (consultIntakeShadowConfig()) {
    after(async () => {
      await runConsultIntakeShadow(input);
    });
  }
  return Response.json(payload);
}

export async function POST(request: Request) {
  if (!sameSiteRequest(request)) {
    return Response.json({ error: 'This request is not allowed.' }, { status: 403 });
  }

  const rateLimit = await checkConsultRateLimit(request);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Please wait a little before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await readBoundedConsultJson(request);
  } catch (cause) {
    const tooLarge = cause instanceof Error && cause.message === 'payload_too_large';
    return Response.json(
      { error: tooLarge ? 'That description is too long.' : 'Please send a valid request.' },
      { status: tooLarge ? 413 : 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Please describe the concern in a little more detail.' },
      { status: 400 },
    );
  }

  const {
    query,
    market,
    profile,
    memberContext,
    clientSchemaVersion,
    priorTimeline: priorTimelineInput = [],
  } = parsed.data;
  const legacyClient = clientSchemaVersion !== 2;
  const priorTimeline = priorTimelineInput.map(normalizeTimelineRecord);
  const sharedConcernSlugs = (memberContext?.concernSlugs ?? [])
    .filter(slug => reviewedConcernSlugs.has(slug));
  const sharedIngredientIds = (memberContext?.productSlugs ?? [])
    .flatMap(slug => catalogueBySlug.get(slug)?.verifiedIngredientIds ?? []);
  const concerns = [...new Set([...inferConcerns(query), ...sharedConcernSlugs])];
  const currentIngredients = [...new Set([
    ...(profile?.currentIngredients ?? []),
    ...sharedIngredientIds,
  ])];
  const clinical = assessClinicalRoutine(query, {
    ...profile,
    currentIngredients: currentIngredients.length ? currentIngredients : undefined,
    concerns,
    market,
    sensitiveSkin: profile?.sensitiveSkin ?? concerns.includes('sensitivity'),
  });
  const safety = assessConsultSafety({
    text: query,
    profile: clinical.profile ?? {},
    referral: clinical.referral,
  });
  const concernGuide = concernGuideForClinicalAssessment(clinical);

  if (safety.stopJourney) {
    const title = safety.level === 'emergency'
      ? 'Get help now.'
      : safety.level === 'urgent'
        ? 'Please get care today.'
        : 'Check first.';

    return Response.json({
      report: {
        title,
        summary: safety.action,
        pattern: 'JeloCare stopped before product guidance.',
        routine: [],
        cautions: [],
        productSlugs: [],
        followUp: safety.action,
      },
      products: [],
      guide: concernGuide,
      meta: {
        market,
        safetyInterrupt: true,
        safetyLevel: safety.level,
      },
    });
  }

  const careIntent = assessOrdinaryCareIntent(query, clinical.differential);
  if (careIntent) {
    const ranked = rankProducts(products, {
      concernSlugs: careIntent.concernSlugs,
      productSteps: careIntent.productSteps,
      sensitive: clinical.profile?.sensitiveSkin ?? false,
      location: market,
    });
    const rankScore = new Map(ranked.map(item => [item.slug, item.score]));
    const eligible = clinicallyFilterProducts(
      products,
      clinical,
      priorTimeline,
      {
        concernSlugs: careIntent.concernSlugs,
        productSteps: careIntent.productSteps,
      },
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

    return consultResponseWithIntakeShadow({
      report: buildDeterministicCareIntentReport(careIntent, selectedSlugs),
      products: selected.map(item => publicProduct(item.product, market)),
      careIntent: {
        concernSlugs: careIntent.concernSlugs,
        labels: careIntent.labels,
      },
      ...timelinePayload({
        concernSlugs: careIntent.concernSlugs,
        market,
        selectedSlugs,
      }),
      meta: responseMeta({
        market,
        ordinaryCare: true,
      }, legacyClient),
    }, {
      query,
      deterministicOutcome: 'ordinary_care',
    });
  }

  const needsClarification = (
    !clinical.differential.primary
    || clinical.differential.confidence === 'low'
  );
  if (needsClarification) {
    const questions = clinical.differential.questions.length
      ? clinical.differential.questions
      : ['Where is it?', 'What does it look or feel like?', 'When did it start?'];

    return consultResponseWithIntakeShadow({
      report: clarificationReport(questions),
      products: [],
      meta: {
        market,
        needsClarification: true,
      },
    }, {
      query,
      deterministicOutcome: 'clarification',
    });
  }

  if (!concernGuide) {
    const questions = clinical.differential.questions.length
      ? clinical.differential.questions
      : ['Where is it?', 'What does it look or feel like?', 'When did it start?'];

    return consultResponseWithIntakeShadow({
      report: clarificationReport(questions),
      products: [],
      meta: {
        market,
        needsClarification: true,
      },
    }, {
      query,
      deterministicOutcome: 'clarification',
    });
  }

  return consultResponseWithIntakeShadow({
    report: buildDeterministicConditionGuideReport(clinical, concernGuide),
    products: [],
    guide: concernGuide,
    ...timelinePayload({
      concernSlugs: [concernGuide.slug],
      market,
      selectedSlugs: [],
    }),
    meta: responseMeta({
      market,
      guideOnly: true,
    }, legacyClient),
  }, {
    query,
    deterministicOutcome: 'condition_guide',
  });
}
