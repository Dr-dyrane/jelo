"use client";

import { useState, useTransition, type FormEvent } from "react";
import { HandCoins, Plus, ShieldCheck } from "lucide-react";
import type {
  ServiceFeePolicy,
  ServiceFeeModel,
} from "@/lib/commerce/service-fee-policy";
import {
  createServiceFeePolicyAction,
  updateServiceFeePolicyAction,
} from "./actions";
import styles from "./service-fees.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function describePolicy(policy: ServiceFeePolicy): string {
  if (policy.feeModel === "flat") {
    return `Flat ${naira.format(policy.flatFeeNgn ?? 0)}`;
  }
  const rate = policy.percentageRate ?? 0;
  if (policy.feeModel === "percentage") {
    return `${rate}% of product subtotal`;
  }
  return `${rate}% of subtotal, min ${naira.format(policy.minFeeNgn ?? 0)}, max ${naira.format(policy.maxFeeNgn ?? 0)}`;
}

function describeScope(policy: ServiceFeePolicy): string {
  const parts: string[] = [];
  parts.push(policy.retailerSlug ?? "Any retailer");
  parts.push(policy.deliveryState ?? "Any state");
  return parts.join(" · ");
}

export function ServiceFeeManager({
  policies,
  canManage,
}: {
  policies: ServiceFeePolicy[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Action failed.");
      else {
        setShowForm(false);
        setEditingId(null);
      }
    });
  }

  return (
    <div className={styles.manager}>
      <header className={styles.header}>
        <div>
          <span className={styles.headerIcon}>
            <HandCoins size={20} aria-hidden="true" />
          </span>
          <div>
            <p>Service fee policies</p>
            <strong>{policies.length} active and inactive policies</strong>
          </div>
        </div>
        {canManage ? (
          <button
            type="button"
            className={styles.addButton}
            disabled={pending || showForm}
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} aria-hidden="true" /> New policy
          </button>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showForm ? (
        <PolicyForm
          key={editingId ?? "new"}
          existing={policies.find((p) => p.id === editingId) ?? null}
          disabled={pending}
          onSubmit={(input) =>
            run(() =>
              editingId
                ? updateServiceFeePolicyAction({
                    ...(input as Record<string, unknown>),
                    id: editingId,
                  })
                : createServiceFeePolicyAction(input),
            )
          }
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      ) : null}

      <div className={styles.policyList}>
        {policies.map((policy) => (
          <div
            key={policy.id}
            className={styles.policyCard}
            data-active={policy.isActive}
          >
            <div className={styles.policyHeader}>
              <span className={styles.policyName}>
                <ShieldCheck size={16} aria-hidden="true" />
                {policy.name}
              </span>
              <span className={styles.policyPriority}>
                Priority {policy.priority}
              </span>
            </div>
            <dl className={styles.policyDetails}>
              <div>
                <dt>Scope</dt>
                <dd>{describeScope(policy)}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{describePolicy(policy)}</dd>
              </div>
              {policy.notes ? (
                <div>
                  <dt>Notes</dt>
                  <dd>{policy.notes}</dd>
                </div>
              ) : null}
            </dl>
            {canManage ? (
              <button
                type="button"
                className={styles.editButton}
                disabled={pending}
                onClick={() => {
                  setEditingId(policy.id);
                  setShowForm(true);
                }}
              >
                {policy.isActive ? "Edit" : "Edit / reactivate"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PolicyForm({
  existing,
  disabled,
  onSubmit,
  onCancel,
}: {
  existing: ServiceFeePolicy | null;
  disabled: boolean;
  onSubmit: (input: unknown) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    retailerSlug: existing?.retailerSlug ?? "",
    deliveryState: existing?.deliveryState ?? "",
    feeModel: existing?.feeModel ?? ("pct_with_cap" as ServiceFeeModel),
    flatFeeNgn: existing?.flatFeeNgn?.toString() ?? "",
    percentageRate: existing?.percentageRate?.toString() ?? "",
    minFeeNgn: existing?.minFeeNgn?.toString() ?? "",
    maxFeeNgn: existing?.maxFeeNgn?.toString() ?? "",
    priority: existing?.priority.toString() ?? "0",
    isActive: existing?.isActive ?? true,
    notes: existing?.notes ?? "",
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const feeModel = form.feeModel as ServiceFeeModel;
    onSubmit({
      name: form.name,
      retailerSlug: form.retailerSlug || null,
      deliveryState: form.deliveryState || null,
      feeModel,
      flatFeeNgn: feeModel === "flat" ? Number(form.flatFeeNgn) : null,
      percentageRate: feeModel !== "flat" ? Number(form.percentageRate) : null,
      minFeeNgn: feeModel === "pct_with_cap" ? Number(form.minFeeNgn) : null,
      maxFeeNgn: feeModel === "pct_with_cap" ? Number(form.maxFeeNgn) : null,
      priority: Number(form.priority),
      isActive: form.isActive,
      notes: form.notes || null,
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h3>{existing ? "Edit policy" : "New service fee policy"}</h3>
      <label>
        <span>Name</span>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Default, Dang Lagos express"
          required
          maxLength={120}
        />
      </label>
      <div className={styles.formRow}>
        <label>
          <span>Retailer slug (optional)</span>
          <input
            value={form.retailerSlug}
            onChange={(e) => setForm({ ...form, retailerSlug: e.target.value })}
            placeholder="e.g. dang, beauty-by-daz"
            maxLength={120}
          />
        </label>
        <label>
          <span>Delivery state (optional)</span>
          <input
            value={form.deliveryState}
            onChange={(e) =>
              setForm({ ...form, deliveryState: e.target.value })
            }
            placeholder="e.g. Lagos, Abuja"
            maxLength={60}
          />
        </label>
      </div>
      <label>
        <span>Fee model</span>
        <select
          value={form.feeModel}
          onChange={(e) =>
            setForm({ ...form, feeModel: e.target.value as ServiceFeeModel })
          }
        >
          <option value="pct_with_cap">Percentage with min/max cap</option>
          <option value="percentage">Percentage (no cap)</option>
          <option value="flat">Flat fee</option>
        </select>
      </label>
      {form.feeModel === "flat" ? (
        <label>
          <span>Flat fee (NGN)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.flatFeeNgn}
            onChange={(e) => setForm({ ...form, flatFeeNgn: e.target.value })}
            placeholder="e.g. 1000"
            required
          />
        </label>
      ) : null}
      {form.feeModel !== "flat" ? (
        <>
          <label>
            <span>Percentage rate (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={form.percentageRate}
              onChange={(e) =>
                setForm({ ...form, percentageRate: e.target.value })
              }
              placeholder="e.g. 5"
              required
            />
          </label>
          {form.feeModel === "pct_with_cap" ? (
            <div className={styles.formRow}>
              <label>
                <span>Minimum fee (NGN)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.minFeeNgn}
                  onChange={(e) =>
                    setForm({ ...form, minFeeNgn: e.target.value })
                  }
                  placeholder="e.g. 500"
                  required
                />
              </label>
              <label>
                <span>Maximum fee (NGN)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.maxFeeNgn}
                  onChange={(e) =>
                    setForm({ ...form, maxFeeNgn: e.target.value })
                  }
                  placeholder="e.g. 5000"
                  required
                />
              </label>
            </div>
          ) : null}
        </>
      ) : null}
      <label>
        <span>Priority (higher = checked first)</span>
        <input
          type="number"
          min="0"
          max="1000"
          inputMode="numeric"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          required
        />
      </label>
      {existing ? (
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span>Active</span>
        </label>
      ) : null}
      <label>
        <span>Notes (optional)</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Operator rationale for this policy"
          maxLength={1000}
          rows={2}
        />
      </label>
      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} disabled={disabled}>
          Cancel
        </button>
        <button type="submit" disabled={disabled}>
          {existing ? "Save changes" : "Create policy"}
        </button>
      </div>
    </form>
  );
}
