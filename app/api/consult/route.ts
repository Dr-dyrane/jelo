import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import { products } from '@/data/products';
import { assessRedFlags } from '@/modules/clinical/safety-gate';
import { rankProducts } from '@/modules/recommendations/product-ranker';
import { SYSTEM_PROMPT } from '@/modules/consultation/system-prompt';

export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: process.env.JELLOCARE_AI_MODEL ?? 'anthropic/claude-sonnet-4.5',
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      screenSafety: tool({
        description: 'Screen symptoms for warning signs before product guidance.',
        inputSchema: z.object({ symptoms: z.array(z.string()), durationDays: z.number().optional() }),
        execute: async input => assessRedFlags(input),
      }),
      findProducts: tool({
        description: 'Return catalogue products ranked for the structured concern.',
        inputSchema: z.object({
          concerns: z.array(z.string()),
          skinType: z.string().optional(),
          sensitive: z.boolean().default(false),
          location: z.string().optional(),
        }),
        execute: async input => rankProducts(products, input).slice(0, 4),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
