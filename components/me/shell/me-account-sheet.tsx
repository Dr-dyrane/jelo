"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CircleUserRound,
  Download,
  Flag,
  LogOut,
  MapPin,
  PackageCheck,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type RefObject } from "react";
import {
  clearConcernsAction,
  clearShelfAction,
} from "@/app/(customer)/me/actions";
import { createPreviewShelfExport } from "@/components/me/shelf/me-shelf-state";
import { useControlledDialog } from "@/components/ui/use-controlled-dialog";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { authClient } from "@/lib/auth/client";
import type {
  CustomerPortalConcernReference,
  CustomerPortalShelfItem,
  CustomerPortalViewModel,
} from "@/lib/customer/portal-model";
import type { CustomerShelfActionResult } from "@/lib/customer/shelf-service";
import type { CustomerConcernActionResult } from "@/lib/customer/concern-service";
import styles from "./me-account-sheet.module.css";

export type MeAccountHelperItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export const ME_ACCOUNT_HELPER_ITEMS: readonly MeAccountHelperItem[] = [
  {
    id: "notifications",
    label: "Notifications",
    description: "Order updates you chose",
    href: "/me/notifications",
    icon: Bell,
  },
  {
    id: "orders",
    label: "My orders",
    description: "Private request history",
    href: "/me/orders",
    icon: PackageCheck,
  },
  {
    id: "locations",
    label: "Saved locations",
    description: "Delivery and billing",
    href: "/me/locations",
    icon: MapPin,
  },
  {
    id: "report-price-availability",
    label: "Report price or availability",
    description: "Send public catalogue evidence",
    href: "/contribute",
    icon: Flag,
  },
];

export function MeAccountSheet({
  account,
  open,
  onClose,
  triggerRef,
  shelfItems,
  shelfCount,
  shelfAvailable,
  onPreviewClear,
  concerns,
  concernsAvailable = true,
  onPreviewClearConcerns,
}: {
  account: CustomerPortalViewModel["account"];
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  shelfItems: readonly CustomerPortalShelfItem[];
  /** Production shelf count, passed independently from the item array. */
  shelfCount?: number;
  shelfAvailable: boolean;
  onPreviewClear?: () => CustomerShelfActionResult;
  concerns: readonly CustomerPortalConcernReference[];
  concernsAvailable?: boolean;
  onPreviewClearConcerns?: () => CustomerConcernActionResult;
}) {
  // When an explicit count is provided (route-scoped product page), use it.
  // Otherwise fall back to the item array length (home/shelf routes).
  const resolvedShelfCount = shelfCount ?? shelfItems.length;
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useControlledDialog({
    open,
    onClose,
    restoreFocusRef: triggerRef,
    initialFocusRef: closeRef,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lifecycleFeedback, setLifecycleFeedback] = useState("");
  const [concernFeedback, setConcernFeedback] = useState("");
  const [clearing, startClearing] = useTransition();
  const [clearingConcerns, startClearingConcerns] = useTransition();

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!account.synthetic) {
        const result = await authClient.signOut();
        if (result.error) throw result.error;
      }
      window.location.assign("/sign-in?next=/me");
    } catch (err) {
      console.error("customer-sign-out", err);
      setError("Could not sign out. Try again.");
      setBusy(false);
    }
  }

  function clearShelf() {
    if (clearing || !shelfAvailable || resolvedShelfCount === 0) return;
    if (account.synthetic) {
      const result = onPreviewClear?.();
      if (result) setLifecycleFeedback(result.message);
      return;
    }
    if (
      !window.confirm(
        "Remove every product from My Shelf? This cannot be undone.",
      )
    )
      return;
    startClearing(async () => {
      const result = await clearShelfAction();
      setLifecycleFeedback(result.message);
      if (result.status === "cleared") router.refresh();
    });
  }

  function clearConcerns() {
    if (clearingConcerns || !concernsAvailable || concerns.length === 0) return;
    if (account.synthetic) {
      const result = onPreviewClearConcerns?.();
      if (result) setConcernFeedback(result.message);
      return;
    }
    if (!window.confirm("Remove all saved concerns? This cannot be undone."))
      return;
    startClearingConcerns(async () => {
      const result = await clearConcernsAction();
      setConcernFeedback(result.message);
      if (result.status === "cleared") router.refresh();
    });
  }

  function exportPreviewData() {
    const shelfExport = createPreviewShelfExport(shelfItems);
    const payload = {
      ...shelfExport,
      format: "jelocare-preview-data-export-v1",
      concerns: concerns.map((concern) => ({
        slug: concern.slug,
        name: concern.name,
        area: concern.area,
        kind: concern.kind,
        source: concern.source,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "jelocare-preview-data.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setLifecycleFeedback("Preview data exported.");
  }

  return (
    <dialog
      id="me-account-sheet"
      ref={dialogRef}
      className={styles.dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="me-account-sheet-title"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <section
        className={styles.sheet}
        aria-describedby={account.email ? "me-account-sheet-email" : undefined}
      >
        <header className={styles.heading}>
          <div>
            <p>JeloCare Me</p>
            <h2 id="me-account-sheet-title">My Account</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close account"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.identity}>
          <span aria-hidden="true">
            <CircleUserRound size={26} strokeWidth={1.6} />
          </span>
          <div>
            <strong>{account.displayName ?? "My JeloCare"}</strong>
            {account.email ? (
              <p id="me-account-sheet-email">{account.email}</p>
            ) : null}
          </div>
        </div>

        <div className={styles.appearance}>
          <div>
            <strong>Appearance</strong>
          </div>
          <ThemeToggle />
        </div>

        {ME_ACCOUNT_HELPER_ITEMS.length ? (
          <nav className={styles.helpers} aria-label="Account helpers">
            {ME_ACCOUNT_HELPER_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href} onClick={onClose}>
                  <span className={styles.helperLead}>
                    <span className={styles.helperIcon} aria-hidden="true">
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <span className={styles.helperCopy}>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
        ) : null}

        <section
          className={styles.lifecycle}
          aria-labelledby="me-data-export-title"
        >
          <div>
            <strong id="me-data-export-title">My data</strong>
            <span>Shelf and saved concerns</span>
          </div>
          {account.synthetic ? (
            <button type="button" onClick={exportPreviewData}>
              <Download size={18} aria-hidden="true" /> Export my data
            </button>
          ) : shelfAvailable && concernsAvailable ? (
            <a href="/me/shelf/export" download>
              <Download size={18} aria-hidden="true" /> Export my data
            </a>
          ) : (
            <button type="button" disabled>
              <Download size={18} aria-hidden="true" /> Export my data
            </button>
          )}
        </section>

        <section
          className={styles.lifecycle}
          aria-labelledby="me-shelf-data-title"
        >
          <div>
            <strong id="me-shelf-data-title">My Shelf data</strong>
            <span>
              {shelfAvailable
                ? `${resolvedShelfCount} saved product${resolvedShelfCount === 1 ? "" : "s"}`
                : "Unavailable"}
            </span>
          </div>
          {account.synthetic ? (
            <p className={styles.previewScope}>
              Preview only · resets on reload
            </p>
          ) : null}
          <button
            type="button"
            onClick={clearShelf}
            disabled={
              clearing ||
              !shelfAvailable ||
              resolvedShelfCount === 0 ||
              (account.synthetic && !onPreviewClear)
            }
          >
            <Trash2 size={18} aria-hidden="true" />{" "}
            {clearing ? "Clearing…" : "Clear Shelf"}
          </button>
          <p role="status" aria-live="polite">
            {lifecycleFeedback}
          </p>
        </section>

        <section
          className={styles.lifecycle}
          aria-labelledby="me-concerns-data-title"
        >
          <div>
            <strong id="me-concerns-data-title">My concerns</strong>
            <span>
              {!concernsAvailable
                ? "Unavailable"
                : concerns.length === 0
                  ? "No concerns saved"
                  : `${concerns.length} saved concern${concerns.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {concernsAvailable && concerns.length > 0 ? (
            <button
              type="button"
              onClick={clearConcerns}
              disabled={
                clearingConcerns ||
                (account.synthetic && !onPreviewClearConcerns)
              }
            >
              <Trash2 size={18} aria-hidden="true" />{" "}
              {clearingConcerns ? "Clearing…" : "Clear concerns"}
            </button>
          ) : null}
          {concernFeedback ? (
            <p role="status" aria-live="polite">
              {concernFeedback}
            </p>
          ) : null}
        </section>

        <footer className={styles.footer}>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            <LogOut size={18} aria-hidden="true" />
            {busy ? "Signing out…" : "Sign out"}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </footer>
      </section>
    </dialog>
  );
}
