import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { priceAmountToStorageInteger } from "@/lib/inventory/price-storage";
import type {
  InventoryStatus,
  RetailerExtraction,
} from "@/modules/retail-intelligence/extraction";

const aiExtractionSchema = z
  .object({
    priceNgn: z.number().nullable(),
    available: z.boolean(),
    inventoryStatus: z.enum([
      "in_stock",
      "low_stock",
      "out_of_stock",
      "unknown",
    ]),
    productTitle: z.string().nullable(),
    productSize: z.string().nullable(),
  })
  .strict();

type AiExtractionOutput = z.infer<typeof aiExtractionSchema>;

export type AiExtractionResult = RetailerExtraction & {
  verificationMethod: string;
};

const MAX_HTML_CHARS = 50_000;

export function aiExtractionConfig(
  env: Record<string, string | undefined> = process.env,
): { modelId: string } | null {
  if (env.INVENTORY_AI_EXTRACTION !== "true") return null;
  const modelId = env.INVENTORY_AI_EXTRACTION_MODEL?.trim();
  if (!modelId) return null;
  return { modelId };
}

async function generateAiExtraction(input: {
  modelId: string;
  html: string;
  url: string;
  productSlug: string;
  productName: string;
  productSize: string;
}): Promise<AiExtractionOutput | undefined> {
  const truncatedHtml = input.html.slice(0, MAX_HTML_CHARS);
  const result = await generateText({
    model: input.modelId,
    output: Output.object({ schema: aiExtractionSchema }),
    system: [
      "You extract product price and stock information from retailer HTML.",
      "Return only the structured fields.",
      "Do not guess.",
      "If the price or stock cannot be determined, return null.",
    ].join(" "),
    prompt: [
      `<RETAILER_PAGE url="${input.url}">`,
      `<PRODUCT_NAME>${input.productName}</PRODUCT_NAME>`,
      `<PRODUCT_SIZE>${input.productSize}</PRODUCT_SIZE>`,
      `<PRODUCT_SLUG>${input.productSlug}</PRODUCT_SLUG>`,
      `<HTML>`,
      truncatedHtml,
      `</HTML>`,
      `</RETAILER_PAGE>`,
    ].join("\n"),
    maxOutputTokens: 300,
    maxRetries: 0,
    timeout: { totalMs: 10_000 },
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
        disallowPromptTraining: true,
        tags: ["inventory-refresh", "ai-extraction", "schema-v1"],
      },
    },
    experimental_telemetry: {
      isEnabled: true,
      recordInputs: false,
      recordOutputs: false,
      functionId: "inventory.ai-extraction.v1",
    },
  });
  return result.output;
}

function mapAiOutputToExtraction(
  output: AiExtractionOutput,
): AiExtractionResult | undefined {
  if (output.priceNgn == null) return undefined;

  let priceMinor: number | null;
  try {
    priceMinor = priceAmountToStorageInteger(output.priceNgn, "NGN");
  } catch {
    return undefined;
  }

  const inventoryStatus: InventoryStatus = output.inventoryStatus;

  return {
    inventoryStatus,
    priceMinor,
    currencyCode: "NGN",
    productTitle: output.productTitle ?? undefined,
    productSize: output.productSize ?? undefined,
    evidence: ["ai-gateway-extraction"],
    confidence: 50,
    verificationMethod: "ai_extraction",
  };
}

export async function extractRetailerPageWithAi(input: {
  html: string;
  url: string;
  productSlug: string;
  productName: string;
  productSize: string;
}): Promise<AiExtractionResult | undefined> {
  const config = aiExtractionConfig();
  if (!config) return undefined;

  try {
    const output = await generateAiExtraction({
      modelId: config.modelId,
      html: input.html,
      url: input.url,
      productSlug: input.productSlug,
      productName: input.productName,
      productSize: input.productSize,
    });
    if (!output) return undefined;
    return mapAiOutputToExtraction(output);
  } catch {
    return undefined;
  }
}
