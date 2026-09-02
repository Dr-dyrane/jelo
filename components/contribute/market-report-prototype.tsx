"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  LockKeyhole,
  MapPin,
  MapPinOff,
  PackageCheck,
  PackageX,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { SmartBackLink } from "@/components/navigation/smart-back-link";
import { SafeProductImage } from "@/components/products/safe-product-image";
import {
  MARKET_REPORT_OUTCOMES,
  type MarketReportContext,
  type MarketReportOutcomeId,
} from "@/lib/markets/feedback";
import {
  contributionDraftSchema,
  type ContributionDraft,
} from "@/lib/community-intake/schema";
import styles from "./market-report-prototype.module.css";

const OUTCOME_ICONS = {
  found_bought: ShoppingBag,
  shop_exists_no_stock: PackageX,
  location_wrong: MapPinOff,
  shop_closed: Store,
} satisfies Record<MarketReportOutcomeId, typeof ShoppingBag>;

type ProductContext = {
  brand: string;
  name: string;
  size: string;
  image?: string;
  identityNote: string;
};

type MarketContext = {
  name: string;
  location: string;
};

type ShopContext = {
  name: string;
  locationLabel: string;
  stateLabel: string;
};

export function MarketReportPrototype({
  product,
  market,
  shop,
  returnHref,
  submissionContext,
}: {
  product: ProductContext;
  market: MarketContext;
  shop: ShopContext;
  returnHref: string;
  submissionContext?: MarketReportContext;
}) {
  const [outcome, setOutcome] = useState<MarketReportOutcomeId | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [submitState, setSubmitState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");
  const [outcomeLocked, setOutcomeLocked] = useState(false);
  const submitKeyRef = useRef(crypto.randomUUID());
  const remoteDraftRef = useRef<{
    id: string;
    revision: number;
    draft: ContributionDraft;
    savedOutcome: MarketReportOutcomeId | null;
  } | null>(null);
  const selectedOutcome = MARKET_REPORT_OUTCOMES.find(
    (option) => option.id === outcome,
  );

  function chooseOutcome(nextOutcome: MarketReportOutcomeId) {
    if (submitState === "pending" || outcomeLocked) return;
    setOutcome(nextOutcome);
    setReviewed(false);
    setSubmitState("idle");
    setSubmitError("");
  }

  async function previewOrSubmitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!outcome) return;
    if (!submissionContext) {
      setReviewed(true);
      return;
    }

    setReviewed(false);
    setSubmitState("pending");
    setSubmitError("");

    try {
      let remote = remoteDraftRef.current;
      if (!remote) {
        const createResponse = await fetch("/api/contribute/drafts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "market_report",
            context: submissionContext,
            website: "",
          }),
        });
        if (!createResponse.ok) {
          const failure = (await createResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            failure?.error ?? "This market report is not available.",
          );
        }
        const created = (await createResponse.json()) as {
          draftId?: unknown;
          revision?: unknown;
          draft?: unknown;
        };
        const parsedDraft = contributionDraftSchema.safeParse(created.draft);
        if (
          typeof created.draftId !== "string" ||
          !Number.isInteger(created.revision) ||
          !parsedDraft.success ||
          parsedDraft.data.kind !== "market_report"
        ) {
          throw new Error("The report context could not be locked.");
        }
        remote = {
          id: created.draftId,
          revision: created.revision as number,
          draft: parsedDraft.data,
          savedOutcome: null,
        };
        remoteDraftRef.current = remote;
        setOutcomeLocked(true);
      }

      if (remote.savedOutcome !== outcome) {
        if (!remote.draft.marketReport)
          throw new Error("The report context could not be locked.");
        const nextDraft = {
          ...remote.draft,
          marketReport: { ...remote.draft.marketReport, outcome },
        } satisfies ContributionDraft;
        const draftId = remote.id;
        const requestSave = (revision: number) =>
          fetch(`/api/contribute/drafts/${draftId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              revision,
              draft: nextDraft,
              events: [],
              website: "",
            }),
          });
        let saveResponse = await requestSave(remote.revision);
        if (saveResponse.status === 409) {
          const conflict = (await saveResponse.json().catch(() => null)) as {
            error?: string;
            revision?: unknown;
          } | null;
          if (!Number.isInteger(conflict?.revision))
            throw new Error(
              conflict?.error ?? "The report context could not be saved.",
            );
          remote = { ...remote, revision: conflict!.revision as number };
          remoteDraftRef.current = remote;
          saveResponse = await requestSave(remote.revision);
        }
        if (!saveResponse.ok) {
          const failure = (await saveResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(failure?.error ?? "The report could not be saved.");
        }
        const saved = (await saveResponse.json()) as { revision?: unknown };
        if (!Number.isInteger(saved.revision))
          throw new Error("The report save could not be confirmed.");
        remote = {
          ...remote,
          revision: saved.revision as number,
          draft: nextDraft,
          savedOutcome: outcome,
        };
        remoteDraftRef.current = remote;
      }

      const submitResponse = await fetch(
        `/api/contribute/drafts/${remote.id}/submit`,
        {
          method: "POST",
          headers: { "idempotency-key": submitKeyRef.current },
        },
      );
      if (!submitResponse.ok) {
        const failure = (await submitResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(failure?.error ?? "The report could not be sent yet.");
      }
      setSubmitState("success");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The report could not be sent yet.",
      );
      setSubmitState("error");
    }
  }

  return (
    <main className={styles.page} data-market-report-prototype="true">
      <div className={styles.shell}>
        <div className={styles.previewNotice} role="note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <strong>
              {submissionContext ? "Private report." : "Development preview."}
            </strong>{" "}
            {submissionContext
              ? "Reviewed before it changes guidance."
              : "Nothing is saved or sent."}
          </span>
        </div>

        <SmartBackLink className={styles.backLink} fallbackHref={returnHref}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back
        </SmartBackLink>

        <header className={styles.header}>
          <p>Market update</p>
          <h1>What happened?</h1>
          <span>One shop. One exact pack. One factual outcome.</span>
        </header>

        <div className={styles.layout}>
          <aside
            className={styles.context}
            aria-labelledby="market-report-context"
          >
            <div className={styles.contextHeading}>
              <div>
                <p>Exact visit</p>
                <h2 id="market-report-context">Locked context</h2>
              </div>
              <LockKeyhole size={20} aria-hidden="true" />
            </div>

            <div className={styles.productContext}>
              <span className={styles.packshotStage}>
                {product.image ? (
                  <SafeProductImage
                    src={product.image}
                    alt={`${product.brand} ${product.name}, ${product.size}`}
                    className={styles.packshot}
                    priority
                  />
                ) : (
                  <PackageCheck
                    size={30}
                    aria-label="Product packshot unavailable"
                  />
                )}
              </span>
              <span className={styles.productCopy}>
                <small>{product.brand}</small>
                <strong>{product.name}</strong>
                <span>{product.size}</span>
              </span>
            </div>

            <dl className={styles.placeContext}>
              <div>
                <dt>
                  <MapPin size={16} aria-hidden="true" /> Market
                </dt>
                <dd>
                  {market.name}
                  <span>{market.location}</span>
                </dd>
              </div>
              <div>
                <dt>
                  <Store size={16} aria-hidden="true" /> Shop record
                </dt>
                <dd>
                  {shop.name}
                  <span>{shop.locationLabel}</span>
                </dd>
              </div>
            </dl>

            <p className={styles.currentState}>{shop.stateLabel}</p>
          </aside>

          <form
            className={styles.report}
            id="contribution-form"
            onSubmit={previewOrSubmitReport}
            aria-busy={submitState === "pending"}
          >
            <div className={styles.reportHeading}>
              <p>One choice</p>
              <h2>What did you find?</h2>
            </div>

            <div
              className={styles.outcomes}
              role="radiogroup"
              aria-label="Market visit outcome"
            >
              {MARKET_REPORT_OUTCOMES.map((option) => {
                const selected = outcome === option.id;
                const OutcomeIcon = OUTCOME_ICONS[option.id];
                return (
                  <label
                    className={styles.outcome}
                    data-selected={selected ? "true" : "false"}
                    key={option.id}
                  >
                    <input
                      className={styles.outcomeInput}
                      type="radio"
                      name="market-report-outcome"
                      value={option.id}
                      checked={selected}
                      onChange={() => chooseOutcome(option.id)}
                      disabled={submitState === "pending" || outcomeLocked}
                      required
                    />
                    <span className={styles.outcomeMark} aria-hidden="true">
                      {selected ? (
                        <Check size={16} />
                      ) : (
                        <OutcomeIcon size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{option.label}</strong>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              className={styles.previewButton}
              type="submit"
              disabled={
                !outcome ||
                submitState === "pending" ||
                submitState === "success"
              }
            >
              {submissionContext
                ? submitState === "pending"
                  ? "Sending report…"
                  : submitState === "error"
                    ? "Try sending again"
                    : submitState === "success"
                      ? "Report received"
                      : "Send report"
                : "Preview report"}
            </button>

            <div
              className={styles.acknowledgement}
              role="status"
              aria-live="polite"
            >
              {submitState === "success" && selectedOutcome ? (
                <>
                  <CircleCheck size={21} aria-hidden="true" />
                  <span>
                    <strong>Report received: {selectedOutcome.label}.</strong>
                    Private and pending review.
                  </span>
                </>
              ) : submitState === "error" ? (
                <span>
                  <strong>Not sent.</strong> {submitError} You can retry safely.
                </span>
              ) : submitState === "pending" ? (
                <span>Locking the exact product and shop before sending…</span>
              ) : reviewed && selectedOutcome ? (
                <>
                  <CircleCheck size={21} aria-hidden="true" />
                  <span>
                    <strong>Preview ready: {selectedOutcome.label}.</strong>
                    Nothing was saved or sent.
                  </span>
                </>
              ) : (
                <span>
                  {submissionContext
                    ? "Choose one outcome."
                    : "Choose one outcome to preview."}
                </span>
              )}
            </div>

            <div className={styles.moderationChips} aria-label="Report limits">
              <span>
                <LockKeyhole size={14} aria-hidden="true" /> Private
              </span>
              <span>
                <ShieldCheck size={14} aria-hidden="true" /> Evidence reviewed
              </span>
            </div>
          </form>
        </div>

        <Link className={styles.standardContribute} href="/contribute">
          Share a normal product, routine or store contribution instead
        </Link>
      </div>
    </main>
  );
}
