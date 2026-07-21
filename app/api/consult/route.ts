import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import { products } from '@/data/products';
import { assessRedFlags } from '@/modules/clinical/safety-gate';
import { rankProducts } from '@/modules/recommendations/product-ranker';
import { SYSTEM_PROMPT } from '@/modules/consultation/system-prompt';

export const maxDuration = 30;

const requestSchema = z.object({ messages: z.array(z.custom<UIMessage>()).min(1).max(40) });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Invalid consultation request.' }, { status: 400 });

  const result = streamText({
    model: process.env.JELOCARE_AI_MODEL ?? 'anthropic/claude-sonnet-4.6',
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(parsed.data.messages),
    stopWhen: stepCountIs(5),
    tools: {
      screenSafety: tool({
        description: 'Screen the reported symptoms for warning signs before giving self-care guidance.',
        inputSchema: z.object({ symptoms: z.array(z.string()).min(1), durationDays: z.number().nonnegative().optional() }),
        execute: async input => assessRedFlags(input),
      }),
      findProducts: tool({
        description: 'Find catalogue products that fit the structured concern. Never invent products.',
        inputSchema: z.object({
          concerns: z.array(z.string()).min(1),
          skinType: z.string().optional(),
          sensitive: z.boolean().default(false),
          location: z.string().optional(),
        }),
        execute: async input => rankProducts(products, input).slice(0, 4).map(result => ({
          slug: result.slug,
          brand: result.brand,
          name: result.name,
          image: result.image,
          score: result.score,
          reason: result.reason,
          url: `/products/${result.slug}`,
        })),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
