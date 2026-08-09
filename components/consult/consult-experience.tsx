"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Check,
  Clock3,
  Eraser,
  LoaderCircle,
  MessageCircleMore,
  Moon,
  PencilLine,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { inferMarket } from "@/data/prices";
import { useModalDialog } from "@/components/ui/use-modal-dialog";

const prompts = [
  {
    label: "New bumps",
    text: "I have tiny bumps on my forehead that started two weeks ago",
  },
  {
    label: "Marks after spots",
    text: "Dark marks stay behind after my acne spots heal",
  },
  {
    label: "Sensitive skin",
    text: "My face feels tight and stings after I use products",
  },
  {
    label: "Oil and texture",
    text: "My face gets oily by midday and the texture feels uneven",
  },
];

type ReportRoutineStep = {
  time: "Morning" | "Evening" | "Weekly" | "Any time";
  action: string;
};
type Report = {
  title: string;
  summary: string;
  pattern: string;
  routine: ReportRoutineStep[];
  cautions: string[];
  productSlugs: string[];
  followUp: string;
};
type ConsultProduct = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  size: string;
  category: "Face" | "Hair" | "Body";
  price: {
    amount: number;
    currency: "NGN" | "USD";
    retailer: string;
    market: "NG" | "US";
  } | null;
  retailers: { retailer: string; href: string }[];
};
type Profile = {
  age?: number;
  pregnant?: boolean;
  breastfeeding?: boolean;
  sensitiveSkin?: boolean;
  allergies?: string[];
  medications?: string[];
  currentIngredients?: string[];
};
type GuideSource = { title: string; url: string };
type Guide = {
  slug: string;
  name: string;
  area: string;
  summary: string;
  escalation: string;
  sources: GuideSource[];
};
type TimelineRecord = {
  id: string;
  schemaVersion: 2;
  createdAt: string;
  assessmentType: "consultation";
  concernSlugs: string[];
  market: "NG" | "US";
  recommendedProductSlugs: string[];
  followUpAt: string;
};
type CareIntent = { concernSlugs: string[]; labels: string[] };
type Consultation = {
  report: Report;
  products: ConsultProduct[];
  guide?: Guide;
  careIntent?: CareIntent;
  timeline?: TimelineRecord;
  meta: {
    market: "NG" | "US";
    ordinaryCare?: boolean;
    guideOnly?: boolean;
    safetyInterrupt?: boolean;
    safetyLevel?: string;
    needsClarification?: boolean;
  };
};
type ProfileForm = {
  age: string;
  pregnant: boolean;
  breastfeeding: boolean;
  sensitiveSkin: boolean;
  allergies: string;
  medications: string;
  currentIngredients: string;
};

const emptyProfile: ProfileForm = {
  age: "",
  pregnant: false,
  breastfeeding: false,
  sensitiveSkin: false,
  allergies: "",
  medications: "",
  currentIngredients: "",
};

function list(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function profilePayload(profile: ProfileForm): Profile {
  return {
    age: profile.age ? Number(profile.age) : undefined,
    pregnant: profile.pregnant || undefined,
    breastfeeding: profile.breastfeeding || undefined,
    sensitiveSkin: profile.sensitiveSkin || undefined,
    allergies: list(profile.allergies).length
      ? list(profile.allergies)
      : undefined,
    medications: list(profile.medications).length
      ? list(profile.medications)
      : undefined,
    currentIngredients: list(profile.currentIngredients).length
      ? list(profile.currentIngredients)
      : undefined,
  };
}
function formatPrice(product: ConsultProduct) {
  if (!product.price) return null;
  return new Intl.NumberFormat(
    product.price.currency === "NGN" ? "en-NG" : "en-US",
    {
      style: "currency",
      currency: product.price.currency,
      maximumFractionDigits: product.price.currency === "NGN" ? 0 : 2,
    },
  ).format(product.price.amount);
}
function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}
function RoutineIcon({ time }: { time: ReportRoutineStep["time"] }) {
  if (time === "Morning") return <Sun size={18} />;
  if (time === "Evening") return <Moon size={18} />;
  return <Clock3 size={18} />;
}
function mergeTimeline(current: TimelineRecord[], record?: TimelineRecord) {
  if (!record) return current;
  return [record, ...current.filter((item) => item.id !== record.id)].slice(
    0,
    24,
  );
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
function isTimelineRecord(value: unknown): value is TimelineRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    value.schemaVersion === 2 &&
    typeof value.createdAt === "string" &&
    value.assessmentType === "consultation" &&
    isStringArray(value.concernSlugs) &&
    (value.market === "NG" || value.market === "US") &&
    isStringArray(value.recommendedProductSlugs) &&
    typeof value.followUpAt === "string"
  );
}
function isRoutineStep(value: unknown): value is ReportRoutineStep {
  if (!isObject(value)) return false;
  return (
    ["Morning", "Evening", "Weekly", "Any time"].includes(String(value.time)) &&
    typeof value.action === "string"
  );
}
function isConsultProduct(value: unknown): value is ConsultProduct {
  if (!isObject(value)) return false;
  const price = value.price;
  const retailers = value.retailers;
  const validPrice =
    price === null ||
    (isObject(price) &&
      typeof price.amount === "number" &&
      (price.currency === "NGN" || price.currency === "USD") &&
      typeof price.retailer === "string" &&
      (price.market === "NG" || price.market === "US"));
  return (
    typeof value.slug === "string" &&
    typeof value.brand === "string" &&
    typeof value.name === "string" &&
    typeof value.image === "string" &&
    typeof value.size === "string" &&
    ["Face", "Hair", "Body"].includes(String(value.category)) &&
    validPrice &&
    Array.isArray(retailers) &&
    retailers.every(
      (retailer) =>
        isObject(retailer) &&
        typeof retailer.retailer === "string" &&
        typeof retailer.href === "string",
    )
  );
}
function isGuide(value: unknown): value is Guide {
  if (!isObject(value) || !Array.isArray(value.sources)) return false;
  return (
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.area === "string" &&
    typeof value.summary === "string" &&
    typeof value.escalation === "string" &&
    value.sources.every(
      (source) =>
        isObject(source) &&
        typeof source.title === "string" &&
        typeof source.url === "string",
    )
  );
}
function isCareIntent(value: unknown): value is CareIntent {
  return (
    isObject(value) &&
    isStringArray(value.concernSlugs) &&
    isStringArray(value.labels)
  );
}
function isConsultationPayload(value: unknown): value is Consultation {
  if (!isObject(value) || !isObject(value.report) || !isObject(value.meta))
    return false;
  const report = value.report;
  const products = value.products;
  return (
    typeof report.title === "string" &&
    typeof report.summary === "string" &&
    typeof report.pattern === "string" &&
    Array.isArray(report.routine) &&
    report.routine.every(isRoutineStep) &&
    isStringArray(report.cautions) &&
    isStringArray(report.productSlugs) &&
    typeof report.followUp === "string" &&
    Array.isArray(products) &&
    products.every(isConsultProduct) &&
    (value.meta.market === "NG" || value.meta.market === "US") &&
    (value.timeline === undefined || isTimelineRecord(value.timeline)) &&
    (value.guide === undefined || isGuide(value.guide)) &&
    (value.careIntent === undefined || isCareIntent(value.careIntent))
  );
}
function normalizedCopy(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}
function repeatsCopy(value: string, candidates: string[]) {
  const normalized = normalizedCopy(value);
  return (
    Boolean(normalized) &&
    candidates.some((candidate) => normalizedCopy(candidate) === normalized)
  );
}

export function ConsultExperience({
  initialQuery = "",
}: { initialQuery?: string } = {}) {
  const [input, setInput] = useState(initialQuery);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [result, setResult] = useState<Consultation | null>(null);
  const [timeline, setTimeline] = useState<TimelineRecord[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const reduce = useReducedMotion();
  const resultRegionRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const {
    dialogRef: profileDialog,
    triggerRef: profileTrigger,
    open: openProfile,
    close: closeProfile,
  } = useModalDialog();
  const market = useMemo(() => inferMarket(), []);
  const profileContextCount = useMemo(
    () =>
      [
        profile.age.trim(),
        profile.pregnant,
        profile.breastfeeding,
        profile.sensitiveSkin,
        profile.allergies.trim(),
        profile.medications.trim(),
        profile.currentIngredients.trim(),
      ].filter(Boolean).length,
    [profile],
  );

  function focusComposer() {
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
    });
  }

  function choosePrompt(prompt: string) {
    setInput(prompt);
    setError("");
    setStatus(
      "Example added. Add or change any detail before creating your guide.",
    );
    focusComposer();
  }

  useEffect(() => {
    if (!result) return;
    const frame = window.requestAnimationFrame(() => {
      const region = resultRegionRef.current;
      region?.focus({ preventScroll: true });
      region?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  async function submit(text: string) {
    const query = text.trim();
    if (!query || busy) return;
    setBusy(true);
    setError("");
    setStatus("Reading your description and safety context.");
    setSubmittedQuery(query);
    const patient = profilePayload(profile);
    const priorTimeline = timeline.slice(0, 8);
    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          market,
          profile: patient,
          clientSchemaVersion: 2,
          priorTimeline,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          isObject(payload) && typeof payload.error === "string"
            ? payload.error
            : "Consultation failed";
        throw new Error(message);
      }
      if (!isConsultationPayload(payload)) {
        throw new Error(
          "JeloCare returned an incomplete guide. Please try again.",
        );
      }
      setResult(payload);
      setTimeline((current) => mergeTimeline(current, payload.timeline));
      setInput("");
      setStatus("Your JeloCare guide is ready.");
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The consultation could not continue.";
      setError(message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setTimeline([]);
    setSubmittedQuery("");
    setError("");
    setStatus("Ready for a new description.");
    focusComposer();
  }
  function askFollowUp() {
    setResult(null);
    setSubmittedQuery("");
    setInput("");
    setError("");
    setStatus("Add what changed or what you would like to check next.");
    focusComposer();
  }
  function editDescription() {
    setInput(submittedQuery);
    setResult(null);
    setError("");
    setStatus("Your previous description is ready to edit.");
    focusComposer();
  }

  if (result) {
    if (result.meta.safetyInterrupt || result.meta.needsClarification) {
      const interrupted = Boolean(result.meta.safetyInterrupt);
      const showNext = !repeatsCopy(result.report.followUp, [
        result.report.summary,
        ...result.report.cautions,
      ]);
      return (
        <motion.section
          ref={resultRegionRef}
          tabIndex={-1}
          className={`consult-interrupt ${interrupted ? "consult-interrupt-care" : ""}`}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <p className="sr-only" role="status">
            {interrupted
              ? "JeloCare recommends human care before products."
              : "JeloCare needs more detail."}
          </p>
          <div className="interrupt-icon">
            <ShieldAlert size={24} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {interrupted ? "Care first" : "One more step"}
          </p>
          <h2>{result.report.title}</h2>
          <p className="interrupt-summary">{result.report.summary}</p>
          {showNext ? (
            <div className="interrupt-next">
              <span>Next</span>
              <p>{result.report.followUp}</p>
            </div>
          ) : null}
          <div className="interrupt-actions">
            {result.meta.needsClarification ? (
              <button type="button" onClick={editDescription}>
                Add details
              </button>
            ) : (
              <button type="button" onClick={reset}>
                Start over
              </button>
            )}
          </div>
          <small>No products selected.</small>
        </motion.section>
      );
    }
    const displayedConcerns = result.careIntent
      ? result.careIntent.labels.flatMap((label, index) => {
          const slug = result.careIntent?.concernSlugs[index];
          return slug ? [{ label, slug }] : [];
        })
      : result.guide
        ? [{ label: result.guide.name, slug: result.guide.slug }]
        : [];
    const distinctFollowUp = !repeatsCopy(result.report.followUp, [
      result.report.summary,
      ...result.report.cautions,
    ]);
    return (
      <motion.section
        ref={resultRegionRef}
        tabIndex={-1}
        className="consult-report"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <p className="sr-only" role="status">
          Your JeloCare guide is ready.
        </p>
        <header className="report-hero">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} /> JeloCare guide
            </p>
            <h2>{result.report.title}</h2>
            <p className="report-summary">{result.report.summary}</p>
          </div>
          <button className="report-reset" type="button" onClick={reset}>
            <RefreshCw size={17} aria-hidden="true" /> Start over
          </button>
        </header>
        <div className="report-query">
          <div>
            <span>You described</span>
            <p>{submittedQuery}</p>
          </div>
          <button type="button" onClick={editDescription}>
            <PencilLine size={15} aria-hidden="true" /> Edit
          </button>
        </div>
        <div className="report-grid">
          <article className="report-panel report-pattern">
            <p className="eyebrow">
              {result.careIntent ? "Everyday care" : "What it may fit"}
            </p>
            <h3>
              {result.careIntent
                ? "What you asked for."
                : "A possible pattern."}
            </h3>
            <p>{result.report.pattern}</p>
            {displayedConcerns.length ? (
              <div className="concern-chips">
                {displayedConcerns.map((concern) => (
                  <Link key={concern.slug} href={`/concerns/${concern.slug}`}>
                    {concern.label}
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
          <article className="report-panel">
            <p className="eyebrow">
              {result.meta.guideOnly ? "Care" : "Routine"}
            </p>
            <h3>
              {result.meta.guideOnly ? "What may help." : "Keep it simple."}
            </h3>
            <div className="routine-list">
              {result.report.routine.map((item, index) => (
                <div className="routine-step" key={`${item.time}-${index}`}>
                  <span className="routine-icon">
                    <RoutineIcon time={item.time} />
                  </span>
                  <div>
                    <strong>{item.time}</strong>
                    <p>{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
        {result.timeline ? (
          <section className="timeline-card">
            <div>
              <p className="eyebrow">
                <CalendarClock size={14} /> This visit
              </p>
              <h3>Ready for a check-in.</h3>
              <p>
                This guide can support another comparison while this page stays
                open.
              </p>
            </div>
            <div className="timeline-meta">
              <span>Follow-up</span>
              <strong>
                {new Date(result.timeline.followUpAt).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </strong>
              <small>
                {timeline.length} guide{timeline.length === 1 ? "" : "s"} in
                this visit
              </small>
            </div>
          </section>
        ) : null}
        {result.products.length ? (
          <section className="report-products">
            <div className="report-section-heading">
              <div>
                <p className="eyebrow">Products</p>
                <h3>Start simple.</h3>
              </div>
              <span>Check the product and retailer details before buying.</span>
            </div>
            <div className="consult-product-grid">
              {result.products.map((product) => {
                const price = formatPrice(product);
                return (
                  <article className="consult-product" key={product.slug}>
                    <Link
                      className="consult-product-image"
                      href={`/products/${product.slug}`}
                      aria-label={`View ${product.brand} ${product.name}`}
                    >
                      <SafeProductImage
                        src={product.image}
                        alt={`${product.brand} ${product.name}`}
                      />
                      {price ? (
                        <span
                          className="consult-product-price"
                          aria-label={`${price} at ${product.price?.retailer}`}
                        >
                          <strong>{price}</strong>
                          <small>at {product.price?.retailer}</small>
                        </span>
                      ) : null}
                      <span className="consult-product-arrow">
                        <ArrowUpRight size={19} />
                      </span>
                    </Link>
                    <div className="consult-product-copy">
                      <p className="eyebrow">{product.brand}</p>
                      <h4>
                        <Link href={`/products/${product.slug}`}>
                          {product.name}
                        </Link>
                      </h4>
                      <p>
                        {product.category} · {product.size}
                      </p>
                      <div className="consult-retailers">
                        {product.retailers.map((offer) => (
                          <a key={offer.retailer} href={offer.href}>
                            {offer.retailer}
                            <ArrowUpRight size={14} />
                          </a>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        {result.report.cautions.length || distinctFollowUp ? (
          <div className="report-bottom-grid">
            {result.report.cautions.length ? (
              <article className="report-panel caution-panel">
                <p className="eyebrow">
                  <ShieldAlert size={14} />{" "}
                  {result.meta.guideOnly
                    ? "When to get help"
                    : "Routine checks"}
                </p>
                <ul>
                  {result.report.cautions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}
            {distinctFollowUp ? (
              <article className="report-panel follow-panel">
                <p className="eyebrow">Follow-up</p>
                <p>{result.report.followUp}</p>
              </article>
            ) : null}
          </div>
        ) : null}
        {result.guide?.sources.length ? (
          <section className="evidence-panel">
            <div className="evidence-heading">
              <div>
                <p className="eyebrow">
                  <BookOpen size={14} /> Sources
                </p>
                <h3>Read the guidance.</h3>
                <p>These published sources support the care guide above.</p>
              </div>
              <span>
                {result.guide.sources.length} source
                {result.guide.sources.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="evidence-grid">
              {result.guide.sources.map((item) => (
                <article key={item.url}>
                  <div>
                    <span>Published guidance</span>
                  </div>
                  <h4>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </h4>
                  <footer>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open {sourceHost(item.url)}{" "}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <div className="report-next-step">
          <div>
            <MessageCircleMore size={20} aria-hidden="true" />
            <span>
              <strong>Something changed?</strong>
              <small>Ask a follow-up while this visit stays in context.</small>
            </span>
          </div>
          <button type="button" onClick={askFollowUp}>
            Ask a follow-up <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="report-disclaimer">
          Guidance, not diagnosis. Urgent or worsening symptoms need in-person
          care.
        </p>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="consult-card"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="consult-empty">
        <div className="consult-orb">
          <Sparkles size={24} aria-hidden="true" />
        </div>
        <p className="eyebrow">A useful description</p>
        <h2>
          {timeline.length
            ? "What would you like to check next?"
            : "Start with what you can see or feel."}
        </h2>
        <p>
          {timeline.length
            ? "Share what changed, what helped, or what you want to understand next."
            : "Mention where it is, how it feels, and when you first noticed it."}
        </p>
        <div
          className="prompt-row"
          role="group"
          aria-label="Example descriptions"
        >
          {prompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              disabled={busy}
              aria-pressed={input === prompt.text}
              onClick={() => choosePrompt(prompt.text)}
            >
              <span>{prompt.label}</span>
              <strong>{prompt.text}</strong>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
        {timeline.length ? (
          <p className="timeline-note">
            <CalendarClock size={14} /> {timeline.length} guide
            {timeline.length === 1 ? "" : "s"} in this visit.
          </p>
        ) : null}
      </div>
      <button
        className="profile-trigger"
        type="button"
        ref={profileTrigger}
        disabled={busy}
        onClick={openProfile}
      >
        <span>
          <strong>Safety context</strong>
          <small>
            {profileContextCount
              ? `${profileContextCount} detail${profileContextCount === 1 ? "" : "s"} added`
              : "Optional · used for this visit only"}
          </small>
        </span>
        <span className="profile-trigger-action">
          {profileContextCount ? <Check size={16} aria-hidden="true" /> : null}
          {profileContextCount ? "Review" : "Add"}
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </button>
      <dialog
        className="profile-dialog"
        ref={profileDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        tabIndex={-1}
        onClick={(event) => {
          if (event.target === profileDialog.current) closeProfile();
        }}
      >
        <div className="profile-sheet">
          <header className="profile-head">
            <div>
              <small>Optional</small>
              <h2 id="profile-dialog-title">About you.</h2>
            </div>
            <button
              type="button"
              onClick={closeProfile}
              aria-label="Close personal details"
            >
              <X size={20} />
            </button>
          </header>
          <div className="profile-grid">
            <label>
              Age
              <input
                inputMode="numeric"
                min="0"
                max="100"
                value={profile.age}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    age: event.target.value.replace(/\D/g, "").slice(0, 3),
                  })
                }
                placeholder="Optional"
              />
            </label>
            <label className="profile-wide">
              Current products or ingredients
              <textarea
                rows={2}
                value={profile.currentIngredients}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    currentIngredients: event.target.value,
                  })
                }
                placeholder="Retinol, salicylic acid, benzoyl peroxide…"
              />
            </label>
            <label>
              Allergies
              <input
                value={profile.allergies}
                onChange={(event) =>
                  setProfile({ ...profile, allergies: event.target.value })
                }
                placeholder="Comma-separated"
              />
            </label>
            <label>
              Medications
              <input
                value={profile.medications}
                onChange={(event) =>
                  setProfile({ ...profile, medications: event.target.value })
                }
                placeholder="Comma-separated"
              />
            </label>
            <div className="profile-toggles">
              <button
                type="button"
                aria-pressed={profile.sensitiveSkin}
                onClick={() =>
                  setProfile({
                    ...profile,
                    sensitiveSkin: !profile.sensitiveSkin,
                  })
                }
              >
                Sensitive skin
              </button>
              <button
                type="button"
                aria-pressed={profile.pregnant}
                onClick={() =>
                  setProfile({ ...profile, pregnant: !profile.pregnant })
                }
              >
                Pregnant
              </button>
              <button
                type="button"
                aria-pressed={profile.breastfeeding}
                onClick={() =>
                  setProfile({
                    ...profile,
                    breastfeeding: !profile.breastfeeding,
                  })
                }
              >
                Breastfeeding
              </button>
            </div>
          </div>
          <footer>
            <p>
              Allergies, medicines, pregnancy, breastfeeding and age under 18
              pause product guidance for human review. Used for this visit only.
            </p>
            <button type="button" onClick={closeProfile}>
              Done
            </button>
          </footer>
        </div>
      </dialog>
      <form
        className="consult-form"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <div className="consult-composer-head">
          <label htmlFor="consult-description">What are you noticing?</label>
          <span>Private to this visit</span>
        </div>
        <div className="consult-compose-row">
          <textarea
            id="consult-description"
            ref={composerRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError("");
              setStatus("");
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                submit(input);
              }
            }}
            placeholder="For example: It is itchy around my jaw and began last week…"
            rows={4}
            disabled={busy}
          />
          <button
            className="consult-submit"
            type="submit"
            disabled={!input.trim() || busy}
          >
            {busy ? (
              <LoaderCircle
                className="consult-spinner"
                size={18}
                aria-hidden="true"
              />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            {busy ? "Creating guide…" : "Create my guide"}
          </button>
        </div>
        <div className="consult-composer-foot">
          <span>Press Ctrl or ⌘ + Enter to create your guide.</span>
          {input && !busy ? (
            <button
              className="consult-clear"
              type="button"
              onClick={() => {
                setInput("");
                setError("");
                setStatus("Description cleared.");
                focusComposer();
              }}
            >
              <Eraser size={14} aria-hidden="true" /> Clear
            </button>
          ) : null}
        </div>
      </form>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {busy ? (
        <div className="consult-progress">
          <LoaderCircle
            className="consult-spinner"
            size={16}
            aria-hidden="true"
          />
          Reading your description and safety context…
        </div>
      ) : null}
      {error ? (
        <div className="consult-error" role="alert" aria-live="assertive">
          <strong>We couldn’t create your guide.</strong>
          <span>
            {error} Your description is still here so you can try again.
          </span>
        </div>
      ) : null}
      <p className="consult-note">
        <ShieldAlert size={14} aria-hidden="true" /> Urgent or worsening
        symptoms need in-person care.
      </p>
    </motion.section>
  );
}
