import assert from "node:assert/strict";
import test from "node:test";
import { aiExtractionConfig } from "@/lib/inventory/ai-extraction";

test("AI extraction is exact-opt-in and requires an explicit model", () => {
  assert.equal(aiExtractionConfig({}), null);
  assert.equal(
    aiExtractionConfig({
      INVENTORY_AI_EXTRACTION: "false",
      INVENTORY_AI_EXTRACTION_MODEL: "google/gemini-2.5-flash-lite",
    }),
    null,
  );
  assert.equal(aiExtractionConfig({ INVENTORY_AI_EXTRACTION: "true" }), null);
  assert.deepEqual(
    aiExtractionConfig({
      INVENTORY_AI_EXTRACTION: "true",
      INVENTORY_AI_EXTRACTION_MODEL: "google/gemini-2.5-flash-lite",
    }),
    { modelId: "google/gemini-2.5-flash-lite" },
  );
});
