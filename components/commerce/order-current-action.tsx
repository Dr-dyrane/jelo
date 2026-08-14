"use client";

import {
  Check,
  ExternalLink,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { AssistedOrderCustomerView } from "@/lib/commerce/assisted-procurement-model";
import styles from "./order-current-action.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function OrderCurrentAction({
  order,
  member,
  onUpdated,
}: {
  order: AssistedOrderCustomerView;
  member: boolean;
  onUpdated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function requestReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/orders/current/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(member ? { orderId: order.id } : {}),
          orderRevision: order.revision,
          reason,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "The return request could not be saved.");
        setPending(false);
        return;
      }
      onUpdated();
    } catch {
      setError(
        "The connection was interrupted. Your return request was not assumed.",
      );
      setPending(false);
    }
  }

  if (order.state === "paid" || order.state === "procurement") {
    return (
      <div className={styles.status} data-tone="progress">
        <Store size={19} aria-hidden="true" />
        <span>
          <strong>
            {order.state === "paid"
              ? "Payment confirmed"
              : "Retailer purchase in progress"}
          </strong>
          <small>
            {order.state === "paid"
              ? "Operations will place the exact approved basket next."
              : "No action is needed while the exact retailer order is placed."}
          </small>
        </span>
      </div>
    );
  }

  if (order.state === "retailer_confirmed") {
    return (
      <div className={styles.status} data-tone="progress">
        <PackageCheck size={19} aria-hidden="true" />
        <span>
          <strong>Retailer confirmed</strong>
          <small>
            {order.fulfillment.retailerOrderReference
              ? `Retailer reference ${order.fulfillment.retailerOrderReference}`
              : "The exact approved basket was accepted."}
          </small>
        </span>
      </div>
    );
  }

  if (order.state === "out_for_delivery") {
    return (
      <div className={styles.status} data-tone="progress">
        <Truck size={19} aria-hidden="true" />
        <span>
          <strong>Out for delivery</strong>
          <small>
            {[order.fulfillment.carrier, order.fulfillment.trackingReference]
              .filter(Boolean)
              .join(" · ") || "Dispatch evidence was recorded."}
          </small>
        </span>
        {order.fulfillment.trackingUrl ? (
          <a
            href={order.fulfillment.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Track delivery <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  if (order.state === "delivered") {
    if (order.returnRequest?.status === "requested") {
      return (
        <div className={styles.status} data-tone="attention">
          <RefreshCw size={19} aria-hidden="true" />
          <span>
            <strong>Return request under review</strong>
            <small>{order.returnRequest.reason}</small>
          </span>
        </div>
      );
    }
    if (order.returnRequest?.status === "declined") {
      return (
        <div className={styles.status} data-tone="attention">
          <PackageCheck size={19} aria-hidden="true" />
          <span>
            <strong>Return request reviewed</strong>
            <small>
              {order.returnRequest.decisionReason ??
                "Operations recorded a decision on the request."}
            </small>
          </span>
        </div>
      );
    }
    return (
      <form className={styles.returnForm} onSubmit={requestReturn}>
        <span className={styles.formIdentity}>
          <Check size={18} aria-hidden="true" />
          <span>
            <strong>Delivered</strong>
            <small>Need to return the order? Record one private request.</small>
          </span>
        </span>
        <label>
          <span>What happened?</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe the item and issue without adding medical or sensitive details"
            minLength={10}
            maxLength={1000}
            required
          />
        </label>
        <button disabled={pending || reason.trim().length < 10} type="submit">
          {pending ? "Sending…" : "Request a return"}
        </button>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  if (order.state === "cancelled") {
    return (
      <div className={styles.status} data-tone="danger">
        <XCircle size={19} aria-hidden="true" />
        <span>
          <strong>Cancelled</strong>
          <small>No further procurement will proceed.</small>
        </span>
        <Link href="/products">
          <RotateCcw size={14} aria-hidden="true" /> Start a new basket
        </Link>
      </div>
    );
  }

  if (order.state === "refund_pending" || order.state === "refunded") {
    return (
      <div className={styles.status} data-tone="attention">
        <RefreshCw size={19} aria-hidden="true" />
        <span>
          <strong>
            {order.state === "refunded" ? "Refunded" : "Refund pending"}
          </strong>
          <small>
            {order.refund
              ? `${naira.format(order.refund.amountNgn)} · ${
                  order.state === "refunded"
                    ? "governed completion evidence recorded"
                    : "being reconciled"
                }`
              : order.state === "refunded"
                ? "Governed completion evidence was recorded."
                : "The refund is being reconciled."}
          </small>
        </span>
      </div>
    );
  }

  return null;
}
