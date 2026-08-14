import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { priceAmountToStorageInteger } from "@/lib/inventory/price-storage";
import type { InventoryStatus } from "@/modules/retail-intelligence/extraction";
import { extractRetailerPage } from "@/modules/retail-intelligence/extraction";
import {
  aiExtractionConfig,
  extractRetailerPageWithAi,
} from "@/lib/inventory/ai-extraction";
import {
  fetchRetailerPageWithBrowser,
  isBrowserFetchAvailable,
} from "@/lib/inventory/browser-fetch";

// Woo Store API retailers — same map as refresh-worker but also includes
// cart API support for full cost breakdown.
const WOO_API_HOSTS = new Map<string, string>([
  ["buybetter.ng", "https://buybetter.ng"],
  ["peronabeauty.com", "https://peronabeauty.com"],
  ["deoset.com", "https://deoset.com"],
  ["teeka4.com", "https://teeka4.com"],
  ["rhemabeautyshop.com", "https://rhemabeautyshop.com"],
  ["tosnigeria.com", "https://tosnigeria.com"],
  ["thebeautyprismng.com", "https://thebeautyprismng.com"],
  ["sonavinebeauty.com", "https://sonavinebeauty.com"],
  ["kadimezessentials.com", "https://kadimezessentials.com"],
  ["luxbeautyng.com", "https://www.luxbeautyng.com"],
  ["dunescenter.com", "https://dunescenter.com"],
  ["sliquebeautylimited.com", "https://sliquebeautylimited.com"],
  ["beautybydaz.com", "https://beautybydaz.com"],
]);

const BLOCKED_HOSTS = new Set(["jumia.com.ng"]);

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_HTML_CHARS = 50_000;

export type OrderLineVerificationResult = {
  verifiedUnitPriceNgn: number | null;
  verifiedInventoryStatus: InventoryStatus | null;
  verifiedProductSubtotalNgn: number | null;
  verifiedDeliveryNgn: number | null;
  verifiedTaxNgn: number | null;
  verifiedRetailerFeeNgn: number | null;
  verifiedTotalNgn: number | null;
  verificationMethod: string;
  verificationConfidence: number;
  verificationEvidence: string[];
  verificationDeliveryNote: string | null;
  verificationError: string | null;
};

type WooStoreProduct = {
  id: number;
  name: string;
  prices: {
    price: string;
    currency_code?: string;
    currency_minor_unit?: number;
  };
  is_in_stock?: boolean;
  stock_status?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
};

type WooCartTotals = {
  totals: {
    total_items: string;
    total_items_tax: string;
    total_fees: string;
    total_fees_tax: string;
    total_shipping: string;
    total_shipping_tax: string;
    total_tax: string;
    total_price: string;
    currency_code: string;
    currency_minor_unit: number;
  };
};

type WooCartShippingRate = {
  rate_id: string;
  name: string;
  description: string;
  price: string;
  currency_code: string;
  currency_minor_unit: number;
};

function wooHostFromUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return WOO_API_HOSTS.get(hostname);
  } catch {
    return undefined;
  }
}

function isBlockedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function productSlugFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1]?.replace(/\/+$/, "") ?? "";
  } catch {
    return "";
  }
}

function wooPriceToNgn(
  rawPrice: string,
  minorUnit: number,
  currencyCode: string,
): number | null {
  const price = Number(rawPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const code = currencyCode.toUpperCase();
  if (code === "NGN") return Math.round(price / 10 ** minorUnit);
  return Math.round(price / 10 ** Math.max(minorUnit - 2, 0));
}

function wooStockStatus(product: WooStoreProduct): InventoryStatus {
  if (product.is_in_stock === false || product.stock_status === "outofstock")
    return "out_of_stock";
  if (
    product.stock_status === "onbackorder" ||
    (product.manage_stock && (product.stock_quantity ?? 0) <= 0)
  )
    return "out_of_stock";
  if (product.manage_stock && (product.stock_quantity ?? 0) <= 5)
    return "low_stock";
  if (product.is_in_stock === true || product.stock_status === "instock")
    return "in_stock";
  return "unknown";
}

// --- AI cart extraction schema ---

const aiCartExtractionSchema = z
  .object({
    productSubtotalNgn: z.number().nullable(),
    deliveryNgn: z.number().nullable(),
    taxNgn: z.number().nullable(),
    retailerFeeNgn: z.number().nullable(),
    totalNgn: z.number().nullable(),
    deliveryNote: z.string().nullable(),
    inStock: z.boolean().nullable(),
    unitPriceNgn: z.number().nullable(),
  })
  .strict();

type AiCartExtractionOutput = z.infer<typeof aiCartExtractionSchema>;

async function extractCartBreakdownWithAi(input: {
  html: string;
  url: string;
  productName: string;
  productSize: string;
  quantity: number;
  deliveryCity: string;
  deliveryState: string;
}): Promise<AiCartExtractionOutput | undefined> {
  const config = aiExtractionConfig();
  if (!config) return undefined;

  const truncatedHtml = input.html.slice(0, MAX_HTML_CHARS);
  try {
    const result = await generateText({
      model: config.modelId,
      output: Output.object({ schema: aiCartExtractionSchema }),
      system: [
        "You extract product cost breakdown from Nigerian retailer cart or checkout pages.",
        "The customer wants delivery to a Nigerian address.",
        "Return only the structured fields in NGN (whole Naira, not kobo).",
        "Do not guess. If a value cannot be determined, return null.",
        "Delivery fee is the shipping cost to the customer location.",
        "Retailer fee is any service charge, handling fee, or platform fee beyond the product price.",
        "Tax is any VAT or tax shown separately.",
        "Total is the final amount the customer would pay before payment.",
      ].join(" "),
      prompt: [
        `<RETAILER_PAGE url="${input.url}">`,
        `<PRODUCT_NAME>${input.productName}</PRODUCT_NAME>`,
        `<PRODUCT_SIZE>${input.productSize}</PRODUCT_SIZE>`,
        `<QUANTITY>${input.quantity}</QUANTITY>`,
        `<DELIVERY_CITY>${input.deliveryCity}</DELIVERY_CITY>`,
        `<DELIVERY_STATE>${input.deliveryState}</DELIVERY_STATE>`,
        `<HTML>`,
        truncatedHtml,
        `</HTML>`,
        `</RETAILER_PAGE>`,
      ].join("\n"),
      maxOutputTokens: 400,
      maxRetries: 0,
      timeout: { totalMs: 12_000 },
      providerOptions: {
        gateway: {
          zeroDataRetention: true,
          disallowPromptTraining: true,
          tags: ["order-verification", "ai-cart-extraction", "schema-v1"],
        },
      },
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        functionId: "commerce.order-verification.ai-cart.v1",
      },
    });
    return result.output;
  } catch {
    return undefined;
  }
}

// --- Fetch helpers ---

async function fetchPageHtml(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "JeloCareOrderVerifier/1.0 (+https://jelocare.com)",
      },
    });
    if (!response.ok) return undefined;
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES) return undefined;
    return html;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Woo Store API: product price/stock ---

async function verifyWithWooStoreApi(url: string): Promise<
  | {
      unitPriceNgn: number;
      inventoryStatus: InventoryStatus;
      productTitle: string | undefined;
    }
  | undefined
> {
  const origin = wooHostFromUrl(url);
  if (!origin) return undefined;
  const slug = productSlugFromUrl(url);
  if (!slug) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const apiUrl = `${origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(apiUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "JeloCareOrderVerifier/1.0 (+https://jelocare.com)",
      },
    });
    if (!response.ok) return undefined;
    const products = (await response.json()) as WooStoreProduct[];
    if (!Array.isArray(products) || products.length === 0) return undefined;
    const product = products[0];
    if (!product.prices?.price) return undefined;
    const minorUnit = product.prices.currency_minor_unit ?? 2;
    const unitPriceNgn = wooPriceToNgn(
      product.prices.price,
      minorUnit,
      product.prices.currency_code ?? "NGN",
    );
    if (unitPriceNgn == null) return undefined;
    return {
      unitPriceNgn,
      inventoryStatus: wooStockStatus(product),
      productTitle: product.name,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Woo Cart API: full cost breakdown ---
// The Woo Store API supports cart operations. We add the product to a fresh
// cart, then read the cart totals to get the full breakdown (subtotal,
// shipping, tax, fees, total). This simulates a purchase up to the payment
// step without actually paying.

async function verifyWithWooCartApi(input: {
  productUrl: string;
  quantity: number;
  deliveryCity: string;
  deliveryState: string;
}): Promise<
  | {
      unitPriceNgn: number;
      inventoryStatus: InventoryStatus;
      productSubtotalNgn: number;
      deliveryNgn: number | null;
      taxNgn: number | null;
      retailerFeeNgn: number | null;
      totalNgn: number | null;
      deliveryNote: string | null;
      evidence: string[];
    }
  | undefined
> {
  const origin = wooHostFromUrl(input.productUrl);
  if (!origin) return undefined;
  const slug = productSlugFromUrl(input.productUrl);
  if (!slug) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Step 1: Get the product to find its numeric ID and stock status.
    const productApiUrl = `${origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;
    const productResponse = await fetch(productApiUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "JeloCareOrderVerifier/1.0 (+https://jelocare.com)",
      },
    });
    if (!productResponse.ok) return undefined;
    const products = (await productResponse.json()) as WooStoreProduct[];
    if (!Array.isArray(products) || products.length === 0) return undefined;
    const product = products[0];
    if (!product.prices?.price) return undefined;

    const minorUnit = product.prices.currency_minor_unit ?? 2;
    const currencyCode = product.prices.currency_code ?? "NGN";
    const unitPriceNgn = wooPriceToNgn(
      product.prices.price,
      minorUnit,
      currencyCode,
    );
    if (unitPriceNgn == null) return undefined;
    const inventoryStatus = wooStockStatus(product);

    const evidence = [
      "Woo Store API product",
      `Woo Store API price: ${unitPriceNgn} NGN`,
      `Woo Store API stock: ${inventoryStatus}`,
    ];

    // Step 2: Add the product to a fresh cart.
    // The Woo Store API cart uses a cart-key cookie for session isolation.
    // Without a cart-key, the server creates a new cart.
    const addCartUrl = `${origin}/wp-json/wc/store/v1/cart/add-item`;
    const addResponse = await fetch(addCartUrl, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "JeloCareOrderVerifier/1.0 (+https://jelocare.com)",
      },
      body: JSON.stringify({
        id: String(product.id),
        quantity: input.quantity,
      }),
    });

    // If cart add fails, we still have price/stock from the product API.
    if (!addResponse.ok) {
      evidence.push("Woo Cart API: add-item failed, using product API only");
      return {
        unitPriceNgn,
        inventoryStatus,
        productSubtotalNgn: unitPriceNgn * input.quantity,
        deliveryNgn: null,
        taxNgn: null,
        retailerFeeNgn: null,
        totalNgn: null,
        deliveryNote: null,
        evidence,
      };
    }

    // Extract cart token from response headers for subsequent requests.
    const cartCookie = addResponse.headers.get("set-cookie");
    const cartHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "JeloCareOrderVerifier/1.0 (+https://jelocare.com)",
    };
    if (cartCookie) {
      // Parse the cart-key from the set-cookie header.
      const cartKeyMatch = cartCookie.match(/wp-wc-store-api-cart-key=([^;]+)/);
      if (cartKeyMatch) {
        cartHeaders["Cart-Key"] = cartKeyMatch[1];
      }
    }

    evidence.push("Woo Cart API: item added to cart");

    // Step 3: Read cart totals.
    const cartUrl = `${origin}/wp-json/wc/store/v1/cart`;
    const cartResponse = await fetch(cartUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: cartHeaders,
    });

    if (!cartResponse.ok) {
      evidence.push("Woo Cart API: cart read failed");
      return {
        unitPriceNgn,
        inventoryStatus,
        productSubtotalNgn: unitPriceNgn * input.quantity,
        deliveryNgn: null,
        taxNgn: null,
        retailerFeeNgn: null,
        totalNgn: null,
        deliveryNote: null,
        evidence,
      };
    }

    const cartData = (await cartResponse.json()) as {
      totals?: WooCartTotals["totals"];
    };
    const totals = cartData.totals;
    if (!totals) {
      evidence.push("Woo Cart API: no totals in cart response");
      return {
        unitPriceNgn,
        inventoryStatus,
        productSubtotalNgn: unitPriceNgn * input.quantity,
        deliveryNgn: null,
        taxNgn: null,
        retailerFeeNgn: null,
        totalNgn: null,
        deliveryNote: null,
        evidence,
      };
    }

    const cartMinorUnit = totals.currency_minor_unit ?? 2;
    const productSubtotalNgn = wooPriceToNgn(
      totals.total_items || "0",
      cartMinorUnit,
      totals.currency_code,
    );
    const deliveryNgn = wooPriceToNgn(
      totals.total_shipping || "0",
      cartMinorUnit,
      totals.currency_code,
    );
    const taxNgn = wooPriceToNgn(
      totals.total_tax || "0",
      cartMinorUnit,
      totals.currency_code,
    );
    const retailerFeeNgn = wooPriceToNgn(
      totals.total_fees || "0",
      cartMinorUnit,
      totals.currency_code,
    );
    const totalNgn = wooPriceToNgn(
      totals.total_price || "0",
      cartMinorUnit,
      totals.currency_code,
    );

    evidence.push(
      `Woo Cart API subtotal: ${productSubtotalNgn} NGN`,
      `Woo Cart API shipping: ${deliveryNgn} NGN`,
      `Woo Cart API tax: ${taxNgn} NGN`,
      `Woo Cart API fees: ${retailerFeeNgn} NGN`,
      `Woo Cart API total: ${totalNgn} NGN`,
    );

    // Step 4: Try to get shipping rates for the delivery location.
    try {
      const shippingUrl = `${origin}/wp-json/wc/store/v1/cart/shipping-rates`;
      const shippingResponse = await fetch(shippingUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: cartHeaders,
      });
      if (shippingResponse.ok) {
        const shippingRates =
          (await shippingResponse.json()) as WooCartShippingRate[];
        if (Array.isArray(shippingRates) && shippingRates.length > 0) {
          const firstRate = shippingRates[0];
          evidence.push(
            `Woo Cart API shipping rate: ${firstRate.name} — ${firstRate.description}`,
          );
        }
      }
    } catch {
      // Shipping rates are best-effort.
    }

    return {
      unitPriceNgn,
      inventoryStatus,
      productSubtotalNgn: productSubtotalNgn ?? unitPriceNgn * input.quantity,
      deliveryNgn,
      taxNgn,
      retailerFeeNgn,
      totalNgn,
      deliveryNote: null,
      evidence,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

// --- HTTP + AI extraction (for non-Woo stores) ---

async function verifyWithHttpAndAi(input: {
  url: string;
  productName: string;
  productSize: string;
  quantity: number;
  deliveryCity: string;
  deliveryState: string;
}): Promise<OrderLineVerificationResult | undefined> {
  const html = await fetchPageHtml(input.url);
  if (!html) return undefined;

  // Try structured extraction first.
  let unitPriceNgn: number | null = null;
  let inventoryStatus: InventoryStatus | null = null;
  let evidence: string[] = [];
  let method = "retailer_page";
  let confidence = 0;

  try {
    const result = extractRetailerPage({
      url: new URL(input.url),
      html,
    });
    if (result.extraction.priceMinor != null) {
      unitPriceNgn = result.extraction.priceMinor;
      inventoryStatus = result.extraction.inventoryStatus;
      evidence = result.extraction.evidence;
      confidence = result.extraction.confidence;
    }
  } catch {
    // Structured extraction failed — try AI.
  }

  // If structured extraction didn't find a price, try AI extraction.
  if (unitPriceNgn == null) {
    const aiResult = await extractRetailerPageWithAi({
      html,
      url: input.url,
      productSlug: "",
      productName: input.productName,
      productSize: input.productSize,
    });
    if (aiResult) {
      unitPriceNgn = aiResult.priceMinor;
      inventoryStatus = aiResult.inventoryStatus;
      evidence = aiResult.evidence;
      method = "ai_extraction";
      confidence = aiResult.confidence;
    }
  }

  if (unitPriceNgn == null) return undefined;

  // Now try AI cart/delivery extraction for the full breakdown.
  const aiCartResult = await extractCartBreakdownWithAi({
    html,
    url: input.url,
    productName: input.productName,
    productSize: input.productSize,
    quantity: input.quantity,
    deliveryCity: input.deliveryCity,
    deliveryState: input.deliveryState,
  });

  return {
    verifiedUnitPriceNgn: unitPriceNgn,
    verifiedInventoryStatus: inventoryStatus,
    verifiedProductSubtotalNgn:
      aiCartResult?.productSubtotalNgn ?? unitPriceNgn * input.quantity,
    verifiedDeliveryNgn: aiCartResult?.deliveryNgn ?? null,
    verifiedTaxNgn: aiCartResult?.taxNgn ?? null,
    verifiedRetailerFeeNgn: aiCartResult?.retailerFeeNgn ?? null,
    verifiedTotalNgn: aiCartResult?.totalNgn ?? null,
    verificationMethod: aiCartResult ? `${method}+ai_cart` : method,
    verificationConfidence: aiCartResult
      ? Math.min(confidence + 15, 100)
      : confidence,
    verificationEvidence: aiCartResult
      ? [...evidence, "AI cart breakdown extraction"]
      : evidence,
    verificationDeliveryNote: aiCartResult?.deliveryNote ?? null,
    verificationError: null,
  };
}

// --- Playwright browser cart simulation (for blocked sites like Jumia) ---

async function verifyWithBrowserCart(input: {
  url: string;
  productName: string;
  productSize: string;
  quantity: number;
  deliveryCity: string;
  deliveryState: string;
}): Promise<OrderLineVerificationResult | undefined> {
  if (!isBrowserFetchAvailable()) return undefined;

  // Step 1: Fetch the product page with the browser.
  const browserResult = await fetchRetailerPageWithBrowser(input.url);
  if (!browserResult) return undefined;

  // Step 2: Try structured extraction from the browser HTML.
  let unitPriceNgn: number | null = null;
  let inventoryStatus: InventoryStatus | null = null;
  let evidence: string[] = ["browser_fetch"];
  let confidence = 0;
  let method = "browser_cart";

  try {
    const result = extractRetailerPage({
      url: new URL(browserResult.responseUrl),
      html: browserResult.html,
    });
    if (result.extraction.priceMinor != null) {
      unitPriceNgn = result.extraction.priceMinor;
      inventoryStatus = result.extraction.inventoryStatus;
      evidence = [...evidence, ...result.extraction.evidence];
      confidence = result.extraction.confidence;
    }
  } catch {
    // Continue to AI extraction.
  }

  // Step 3: If no price from structured extraction, try AI.
  if (unitPriceNgn == null) {
    const aiResult = await extractRetailerPageWithAi({
      html: browserResult.html,
      url: browserResult.responseUrl,
      productSlug: "",
      productName: input.productName,
      productSize: input.productSize,
    });
    if (aiResult) {
      unitPriceNgn = aiResult.priceMinor;
      inventoryStatus = aiResult.inventoryStatus;
      evidence = [...evidence, ...aiResult.evidence];
      method = "ai_extraction";
      confidence = aiResult.confidence;
    }
  }

  if (unitPriceNgn == null) return undefined;

  // Step 4: Try AI cart/delivery extraction from the browser HTML.
  const aiCartResult = await extractCartBreakdownWithAi({
    html: browserResult.html,
    url: browserResult.responseUrl,
    productName: input.productName,
    productSize: input.productSize,
    quantity: input.quantity,
    deliveryCity: input.deliveryCity,
    deliveryState: input.deliveryState,
  });

  return {
    verifiedUnitPriceNgn: unitPriceNgn,
    verifiedInventoryStatus: inventoryStatus,
    verifiedProductSubtotalNgn:
      aiCartResult?.productSubtotalNgn ?? unitPriceNgn * input.quantity,
    verifiedDeliveryNgn: aiCartResult?.deliveryNgn ?? null,
    verifiedTaxNgn: aiCartResult?.taxNgn ?? null,
    verifiedRetailerFeeNgn: aiCartResult?.retailerFeeNgn ?? null,
    verifiedTotalNgn: aiCartResult?.totalNgn ?? null,
    verificationMethod: aiCartResult ? `${method}+ai_cart` : method,
    verificationConfidence: aiCartResult
      ? Math.min(confidence + 15, 100)
      : confidence,
    verificationEvidence: aiCartResult
      ? [...evidence, "AI cart breakdown extraction (browser)"]
      : evidence,
    verificationDeliveryNote: aiCartResult?.deliveryNote ?? null,
    verificationError: null,
  };
}

// --- Main entry point ---

export async function verifyOrderLine(input: {
  listingUrl: string;
  productName: string;
  productSize: string;
  quantity: number;
  deliveryCity: string;
  deliveryState: string;
}): Promise<OrderLineVerificationResult> {
  const { listingUrl, quantity, deliveryCity, deliveryState } = input;

  // 1. Try Woo Cart API first (gives full breakdown for Woo stores).
  if (wooHostFromUrl(listingUrl)) {
    const wooCartResult = await verifyWithWooCartApi({
      productUrl: listingUrl,
      quantity,
      deliveryCity,
      deliveryState,
    });
    if (wooCartResult) {
      return {
        verifiedUnitPriceNgn: wooCartResult.unitPriceNgn,
        verifiedInventoryStatus: wooCartResult.inventoryStatus,
        verifiedProductSubtotalNgn: wooCartResult.productSubtotalNgn,
        verifiedDeliveryNgn: wooCartResult.deliveryNgn,
        verifiedTaxNgn: wooCartResult.taxNgn,
        verifiedRetailerFeeNgn: wooCartResult.retailerFeeNgn,
        verifiedTotalNgn: wooCartResult.totalNgn,
        verificationMethod: "woo-cart-api",
        verificationConfidence: 80,
        verificationEvidence: wooCartResult.evidence,
        verificationDeliveryNote: wooCartResult.deliveryNote,
        verificationError: null,
      };
    }

    // Woo product API fallback (price/stock only, no cart breakdown).
    const wooProductResult = await verifyWithWooStoreApi(listingUrl);
    if (wooProductResult) {
      return {
        verifiedUnitPriceNgn: wooProductResult.unitPriceNgn,
        verifiedInventoryStatus: wooProductResult.inventoryStatus,
        verifiedProductSubtotalNgn: wooProductResult.unitPriceNgn * quantity,
        verifiedDeliveryNgn: null,
        verifiedTaxNgn: null,
        verifiedRetailerFeeNgn: null,
        verifiedTotalNgn: null,
        verificationMethod: "woo-store-api",
        verificationConfidence: 70,
        verificationEvidence: [
          "Woo Store API product",
          `Woo Store API price: ${wooProductResult.unitPriceNgn} NGN`,
          `Woo Store API stock: ${wooProductResult.inventoryStatus}`,
        ],
        verificationDeliveryNote: null,
        verificationError: null,
      };
    }
  }

  // 2. Try HTTP + AI extraction (for non-Woo stores).
  const httpResult = await verifyWithHttpAndAi({
    url: listingUrl,
    productName: input.productName,
    productSize: input.productSize,
    quantity,
    deliveryCity,
    deliveryState,
  });
  if (httpResult) return httpResult;

  // 3. Try Playwright browser cart simulation (for blocked sites).
  if (isBlockedHost(listingUrl) || !wooHostFromUrl(listingUrl)) {
    const browserResult = await verifyWithBrowserCart({
      url: listingUrl,
      productName: input.productName,
      productSize: input.productSize,
      quantity,
      deliveryCity,
      deliveryState,
    });
    if (browserResult) return browserResult;
  }

  // 4. All extraction methods failed.
  return {
    verifiedUnitPriceNgn: null,
    verifiedInventoryStatus: null,
    verifiedProductSubtotalNgn: null,
    verifiedDeliveryNgn: null,
    verifiedTaxNgn: null,
    verifiedRetailerFeeNgn: null,
    verifiedTotalNgn: null,
    verificationMethod: "manual",
    verificationConfidence: 0,
    verificationEvidence: [],
    verificationDeliveryNote: null,
    verificationError:
      "All automated extraction methods failed. Manual verification required.",
  };
}
