"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { ProductCard } from "@/components/products/product-card";
import { SafeProductImage } from "@/components/products/safe-product-image";
import {
  chooseRetailerBasketOption,
  findRetailerBasketOptions,
} from "@/lib/commerce/retailer-basket";
import { useBasket } from "./basket-provider";
import {
  CHECKOUT_REQUEST_STORAGE_KEY,
  CHECKOUT_RETAILER_STORAGE_KEY,
} from "@/lib/commerce/basket";
import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  checkoutDraftSignature,
  parseCheckoutDraft,
  serializeCheckoutDraft,
} from "@/lib/commerce/checkout-draft";
import styles from "./procurement.module.css";
import { SmartLocationFields } from "@/components/location/smart-location-fields";
import type {
  SavedCustomerLocation,
  SmartLocationValue,
} from "@/lib/location/model";

export type ProcurementProduct = Pick<
  Product,
  "slug" | "brand" | "name" | "size" | "image" | "offers"
>;
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function ProcurementBasket({
  products,
}: {
  products: ProcurementProduct[];
}) {
  const basket = useBasket();
  const router = useRouter();
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const selectedProducts = useMemo(
    () =>
      basket.items
        .map((item) => productBySlug.get(item.slug))
        .filter((product): product is ProcurementProduct => Boolean(product)),
    [basket.items, productBySlug],
  );
  const quantities = useMemo(
    () => new Map(basket.items.map((item) => [item.slug, item.quantity])),
    [basket.items],
  );
  const options = useMemo(
    () => findRetailerBasketOptions(selectedProducts, quantities),
    [quantities, selectedProducts],
  );
  const [selectedRetailer, setSelectedRetailer] = useState("");

  if (!basket.ready)
    return <div className={styles.loading}>Opening your basket…</div>;
  if (selectedProducts.length === 0) {
    return (
      <section className={styles.empty}>
        <p className="eyebrow">Guest basket</p>
        <h1>Your basket is ready when you are.</h1>
        <p>Add an exact product. You do not need an account.</p>
        <Link href="/products">
          Browse products <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const storedRetailer = localStorage.getItem(CHECKOUT_RETAILER_STORAGE_KEY);
  const preferredRetailer = selectedRetailer || storedRetailer;
  const chosen = chooseRetailerBasketOption(options, preferredRetailer);
  const retailer = chosen?.retailer ?? "";

  return (
    <div className={styles.basketLayout}>
      <section
        className={styles.basketProducts}
        aria-labelledby="basket-products-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Exact products</p>
            <h2 id="basket-products-title">Your basket.</h2>
          </div>
          <span>
            {basket.totalQuantity}{" "}
            {basket.totalQuantity === 1 ? "item" : "items"}
          </span>
        </div>
        <div className={`product-grid ${styles.productGrid}`}>
          {selectedProducts.map((product) => {
            const quantity = quantities.get(product.slug) ?? 1;
            return (
              <ProductCard
                key={product.slug}
                product={product}
                density="compact"
                footer={
                  <div
                    className={styles.quantity}
                    aria-label={`Quantity for ${product.name}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        basket.setQuantity(product.slug, quantity - 1)
                      }
                      aria-label={`Remove one ${product.name}`}
                    >
                      {quantity === 1 ? (
                        <Trash2 size={16} aria-hidden="true" />
                      ) : (
                        <Minus size={16} aria-hidden="true" />
                      )}
                    </button>
                    <span>{quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        basket.setQuantity(product.slug, quantity + 1)
                      }
                      aria-label={`Add one ${product.name}`}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      </section>

      <aside
        className={styles.retailerChoice}
        aria-labelledby="retailer-choice-title"
      >
        <p className="eyebrow">One retailer</p>
        <h2 id="retailer-choice-title">Choose where JeloCare checks.</h2>
        <p className={styles.muted}>
          Observed totals — delivery and fees are verified after your address.
        </p>
        {options.length ? (
          <>
            {preferredRetailer && !chosen ? (
              <div className={styles.retailerChange} role="status">
                <strong>Choose a new retailer.</strong>
                <p>{preferredRetailer} no longer has every item in stock.</p>
              </div>
            ) : null}
            <fieldset className={styles.retailerOptions}>
              <legend className="sr-only">Choose one retailer</legend>
              {options.map((option, index) => (
                <label
                  key={option.retailer}
                  data-selected={
                    retailer === option.retailer ? "true" : "false"
                  }
                >
                  <input
                    type="radio"
                    name="retailer"
                    value={option.retailer}
                    checked={retailer === option.retailer}
                    disabled={!option.allInStock}
                    onChange={() => {
                      setSelectedRetailer(option.retailer);
                      localStorage.setItem(
                        CHECKOUT_RETAILER_STORAGE_KEY,
                        option.retailer,
                      );
                    }}
                  />
                  <span>
                    <strong>{option.retailer}</strong>
                    <small>
                      {option.allInStock
                        ? "All exact items listed in stock"
                        : "An item needs rechecking"}
                    </small>
                  </span>
                  <b>{naira.format(option.combinedTotal)}</b>
                  {index === 0 ? <em>Lowest observed</em> : null}
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <div className={styles.noMatch}>
            <strong>No one-retailer match.</strong>
            <p>
              Remove a product or choose another. We won&apos;t split an order.
            </p>
          </div>
        )}
        <div className={styles.assurance}>
          <ShieldCheck size={19} aria-hidden="true" />
          <p>
            <strong>No payment now.</strong> Approve one verified quote before
            anything proceeds.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!chosen || !chosen.allInStock}
          onClick={() => {
            if (!chosen) return;
            localStorage.setItem(
              CHECKOUT_RETAILER_STORAGE_KEY,
              chosen.retailer,
            );
            router.push("/checkout");
          }}
        >
          Continue to checkout <ArrowRight size={17} aria-hidden="true" />
        </button>
      </aside>
    </div>
  );
}

type CheckoutStep = "contact" | "delivery" | "review";
const checkoutFlow: CheckoutStep[] = ["contact", "delivery", "review"];

export function CheckoutExperience({
  products,
  savedLocations = [],
}: {
  products: ProcurementProduct[];
  savedLocations?: readonly SavedCustomerLocation[];
}) {
  const basket = useBasket();
  if (!basket.ready)
    return <div className={styles.loading}>Preparing checkout…</div>;
  return (
    <ReadyCheckoutExperience
      key={JSON.stringify(basket.items)}
      products={products}
      savedLocations={savedLocations}
    />
  );
}

function ReadyCheckoutExperience({
  products,
  savedLocations,
}: {
  products: ProcurementProduct[];
  savedLocations: readonly SavedCustomerLocation[];
}) {
  const basket = useBasket();
  const router = useRouter();
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const selectedProducts = useMemo(
    () =>
      basket.items
        .map((item) => productBySlug.get(item.slug))
        .filter((product): product is ProcurementProduct => Boolean(product)),
    [basket.items, productBySlug],
  );
  const quantities = useMemo(
    () => new Map(basket.items.map((item) => [item.slug, item.quantity])),
    [basket.items],
  );
  const productImage = useMemo(
    () =>
      new Map(selectedProducts.map((product) => [product.slug, product.image])),
    [selectedProducts],
  );
  const options = useMemo(
    () => findRetailerBasketOptions(selectedProducts, quantities),
    [quantities, selectedProducts],
  );
  const storedRetailer = localStorage.getItem(CHECKOUT_RETAILER_STORAGE_KEY);
  const chosen = chooseRetailerBasketOption(options, storedRetailer);
  const retailer = chosen?.retailer ?? "";
  const draftSignature =
    chosen && selectedProducts.length
      ? checkoutDraftSignature(retailer, basket.items)
      : null;
  const [initialDraft] = useState(() => {
    if (!draftSignature) return null;
    try {
      return parseCheckoutDraft(
        sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY),
        draftSignature,
      );
    } catch {
      return null;
    }
  });
  const [stepIndex, setStepIndex] = useState(() =>
    initialDraft ? checkoutFlow.indexOf(initialDraft.step) : 0,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(
    () => ({ ...initialDraft?.fields }) as Record<string, string>,
  );
  const [emailNotificationsConsent, setEmailNotificationsConsent] = useState(
    initialDraft?.emailNotificationsConsent ?? false,
  );
  const [whatsappConsent, setWhatsappConsent] = useState(
    initialDraft?.whatsappConsent ?? false,
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const draftRestored = Boolean(initialDraft);
  const currentStep =
    checkoutFlow[Math.min(stepIndex, checkoutFlow.length - 1)];

  useEffect(() => {
    if (!draftSignature) return;
    try {
      sessionStorage.setItem(
        CHECKOUT_DRAFT_STORAGE_KEY,
        serializeCheckoutDraft({
          signature: draftSignature,
          step: currentStep,
          fields,
          emailNotificationsConsent,
          whatsappConsent,
        }),
      );
    } catch {
      // Manual checkout remains complete when session storage is unavailable.
    }
  }, [
    currentStep,
    draftSignature,
    emailNotificationsConsent,
    fields,
    whatsappConsent,
  ]);

  if (!chosen || !selectedProducts.length) {
    return (
      <section className={styles.empty}>
        <p className="eyebrow">Checkout</p>
        <h1>Your basket needs another look.</h1>
        <p>Your retailer must still list every item in stock.</p>
        <Link href="/basket">
          Return to basket <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const progress = Math.round((stepIndex / (checkoutFlow.length - 1)) * 100);

  function canContinue(): boolean {
    if (currentStep === "contact") {
      return Boolean(
        (fields.contactName?.trim().length ?? 0) >= 2 &&
        fields.contactEmail?.trim() &&
        fields.contactPhone?.trim(),
      );
    }
    if (currentStep === "delivery") {
      return Boolean(
        (fields.deliveryAddress?.trim().length ?? 0) >= 5 &&
        fields.deliveryCity?.trim() &&
        fields.deliveryState?.trim(),
      );
    }
    if (currentStep === "review") {
      return termsAccepted;
    }
    return true;
  }

  function nextStep() {
    setError("");
    setStepIndex((index) => Math.min(index + 1, checkoutFlow.length - 1));
  }

  function previousStep() {
    setError("");
    setStepIndex((index) => Math.max(0, index - 1));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue()) {
      setError("A few answers are still missing.");
      return;
    }
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const basketSignature = JSON.stringify({ retailer, lines: basket.items });
    let requestRecord: { signature: string; requestId: string } | null = null;
    try {
      requestRecord = JSON.parse(
        sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY) ?? "null",
      );
    } catch {
      // Replace malformed browser state with a new request capability.
    }
    if (!requestRecord || requestRecord.signature !== basketSignature) {
      requestRecord = {
        signature: basketSignature,
        requestId: crypto.randomUUID(),
      };
      sessionStorage.setItem(
        CHECKOUT_REQUEST_STORAGE_KEY,
        JSON.stringify(requestRecord),
      );
    }
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestRecord.requestId,
          retailer,
          lines: basket.items,
          contactName: fields.contactName,
          contactEmail: fields.contactEmail,
          contactPhone: fields.contactPhone,
          deliveryAddress: fields.deliveryAddress,
          deliveryCity: fields.deliveryCity,
          deliveryState: fields.deliveryState,
          deliveryInstructions: fields.deliveryInstructions ?? "",
          whatsappConsent,
          emailNotificationsConsent,
          termsAccepted,
          websiteField: data.get("websiteField"),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        emailDelivery?: "sent" | "unavailable" | "failed";
      };
      if (!response.ok) {
        setError(payload.error ?? "Checkout request could not be saved.");
        setSubmitting(false);
        return;
      }
      // Store email delivery status so the order page can show it.
      if (payload.emailDelivery) {
        sessionStorage.setItem(
          "jelocare-order-email-status",
          payload.emailDelivery,
        );
      }
    } catch {
      setError(
        "The connection was interrupted. Retry to reopen the same request safely.",
      );
      setSubmitting(false);
      return;
    }
    sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(CHECKOUT_REQUEST_STORAGE_KEY);
    localStorage.removeItem(CHECKOUT_RETAILER_STORAGE_KEY);
    basket.clear();
    router.push("/order?new=1");
  }

  const updateField = (name: string, value: string) =>
    setFields((prev) => ({ ...prev, [name]: value }));

  const deliveryLocation: SmartLocationValue = {
    address: fields.deliveryAddress ?? "",
    city: fields.deliveryCity ?? "",
    state: fields.deliveryState ?? "",
    postalCode: fields.deliveryPostalCode ?? "",
  };

  function updateDeliveryLocation(location: SmartLocationValue) {
    setFields((previous) => ({
      ...previous,
      deliveryAddress: location.address,
      deliveryCity: location.city,
      deliveryState: location.state,
      deliveryPostalCode: location.postalCode,
    }));
  }

  return (
    <div className={styles.checkoutLayout}>
      <form className={styles.checkoutForm} onSubmit={submit}>
        <div className={styles.progressRow}>
          <div className={styles.progress} aria-label={`${progress}% complete`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        {draftRestored ? (
          <p className={styles.draftStatus} role="status">
            Saved checkout restored on this tab.
          </p>
        ) : null}

        <input
          className={styles.honeypot}
          name="websiteField"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className={styles.stepContent} key={currentStep}>
          {currentStep === "contact" ? (
            <div className={styles.stepPanel}>
              <p className="eyebrow">Step 1 of 3</p>
              <h1>How can JeloCare reach you?</h1>
              <p>No account required.</p>
              <div className={styles.fieldGrid}>
                <label>
                  <span>Name</span>
                  <input
                    name="contactName"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={fields.contactName ?? ""}
                    onChange={(e) => updateField("contactName", e.target.value)}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    name="contactEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={fields.contactEmail ?? ""}
                    onChange={(e) =>
                      updateField("contactEmail", e.target.value)
                    }
                  />
                </label>
                <label className={styles.fullField}>
                  <span>Phone</span>
                  <input
                    name="contactPhone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={fields.contactPhone ?? ""}
                    onChange={(e) =>
                      updateField("contactPhone", e.target.value)
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === "delivery" ? (
            <div className={styles.stepPanel}>
              <p className="eyebrow">Step 2 of 3</p>
              <h1>Where should we quote delivery?</h1>
              {savedLocations.length ? (
                <fieldset className={styles.savedLocations}>
                  <legend>Use a saved location</legend>
                  {savedLocations.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      data-selected={
                        deliveryLocation.address === location.address &&
                        deliveryLocation.city === location.city
                          ? "true"
                          : "false"
                      }
                      onClick={() => updateDeliveryLocation(location)}
                    >
                      <MapPin size={17} aria-hidden="true" />
                      <span>
                        <strong>{location.label}</strong>
                        <small>
                          {location.city}, {location.state}
                          {location.isDefault ? " · Default" : ""}
                        </small>
                      </span>
                    </button>
                  ))}
                </fieldset>
              ) : null}
              <SmartLocationFields
                idPrefix="checkout-delivery"
                value={deliveryLocation}
                onChange={updateDeliveryLocation}
                disabled={submitting}
              />
              <div className={styles.fieldGrid}>
                <label className={styles.fullField}>
                  <span>
                    Delivery notes <small>optional</small>
                  </span>
                  <textarea
                    name="deliveryInstructions"
                    maxLength={500}
                    value={fields.deliveryInstructions ?? ""}
                    onChange={(e) =>
                      updateField("deliveryInstructions", e.target.value)
                    }
                  />
                </label>
              </div>
              {savedLocations.length ? (
                <Link className={styles.manageLocations} href="/me/locations">
                  Manage saved locations
                </Link>
              ) : null}
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  name="emailNotificationsConsent"
                  checked={emailNotificationsConsent}
                  onChange={(event) =>
                    setEmailNotificationsConsent(event.target.checked)
                  }
                />
                <span>Email me quote and status updates.</span>
              </label>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  name="whatsappConsent"
                  checked={whatsappConsent}
                  onChange={(event) => setWhatsappConsent(event.target.checked)}
                />
                <span>JeloCare may WhatsApp me about this order.</span>
              </label>
            </div>
          ) : null}

          {currentStep === "review" ? (
            <div className={styles.stepPanel}>
              <p className="eyebrow">Step 3 of 3</p>
              <h1>Ready to request your quote?</h1>
              <p className={styles.finePrint}>
                No payment now. You approve the final quote.
              </p>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  name="termsAccepted"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>I understand this is a quote request, not payment.</span>
              </label>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.stepActions}>
          {stepIndex > 0 ? (
            <button
              type="button"
              className={styles.backButton}
              onClick={previousStep}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          {currentStep === "review" ? (
            <button
              className={styles.primaryAction}
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Saving request…" : "Request verified quote"}
              {!submitting ? <ArrowRight size={17} aria-hidden="true" /> : null}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={nextStep}
              disabled={!canContinue()}
            >
              Continue <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </form>

      <aside className={styles.checkoutSummary}>
        <p className="eyebrow">Your retailer</p>
        <h2>{chosen.retailer}</h2>
        <dl>
          {chosen.offers.map((offer) => (
            <div key={offer.productSlug} className={styles.summaryLine}>
              <div className={styles.summaryImage}>
                <SafeProductImage
                  src={productImage.get(offer.productSlug) ?? ""}
                  alt=""
                />
              </div>
              <dt>
                {offer.productBrand} · {offer.productName}{" "}
                <small>× {quantities.get(offer.productSlug) ?? 1}</small>
              </dt>
              <dd>
                {naira.format(
                  offer.priceNgn * (quantities.get(offer.productSlug) ?? 1),
                )}
              </dd>
            </div>
          ))}
          <div className={styles.observedTotal}>
            <dt>Observed product total</dt>
            <dd>{naira.format(chosen.combinedTotal)}</dd>
          </div>
        </dl>
        <div className={styles.quoteSteps}>
          <span>
            <Check size={16} aria-hidden="true" /> Submit basket
          </span>
          <span>
            <Check size={16} aria-hidden="true" /> We verify costs
          </span>
          <span>
            <Check size={16} aria-hidden="true" /> You approve quote
          </span>
        </div>
      </aside>
    </div>
  );
}
