import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";

export type ServiceFeeModel = "flat" | "percentage" | "pct_with_cap";

export type ServiceFeePolicy = {
  id: string;
  name: string;
  retailerSlug: string | null;
  deliveryState: string | null;
  feeModel: ServiceFeeModel;
  flatFeeNgn: number | null;
  percentageRate: number | null;
  minFeeNgn: number | null;
  maxFeeNgn: number | null;
  priority: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedServiceFee = {
  policyId: string;
  policyName: string;
  feeModel: ServiceFeeModel;
  feeNgn: number;
  calculation: string;
};

export type ServiceFeePolicyInput = {
  retailerSlug: string | null;
  deliveryState: string | null;
  productSubtotalNgn: number;
};

type PolicyRow = {
  id: string;
  name: string;
  retailer_slug: string | null;
  delivery_state: string | null;
  fee_model: ServiceFeeModel;
  flat_fee_ngn: number | null;
  percentage_rate: string | null;
  min_fee_ngn: number | null;
  max_fee_ngn: number | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapPolicy(row: PolicyRow): ServiceFeePolicy {
  return {
    id: row.id,
    name: row.name,
    retailerSlug: row.retailer_slug,
    deliveryState: row.delivery_state,
    feeModel: row.fee_model,
    flatFeeNgn: row.flat_fee_ngn,
    percentageRate:
      row.percentage_rate != null ? Number(row.percentage_rate) : null,
    minFeeNgn: row.min_fee_ngn,
    maxFeeNgn: row.max_fee_ngn,
    priority: row.priority,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Calculate the fee from a policy given a product subtotal.
 * Returns the fee amount in NGN and a human-readable calculation string.
 */
export function calculateFee(
  policy: ServiceFeePolicy,
  productSubtotalNgn: number,
): { feeNgn: number; calculation: string } {
  if (policy.feeModel === "flat") {
    const fee = policy.flatFeeNgn ?? 0;
    return {
      feeNgn: fee,
      calculation: `Flat fee: ${fee.toLocaleString("en-NG")} NGN`,
    };
  }

  const rate = policy.percentageRate ?? 0;
  const rawPct = Math.round((productSubtotalNgn * rate) / 100);

  if (policy.feeModel === "percentage") {
    return {
      feeNgn: rawPct,
      calculation: `${rate}% of ${productSubtotalNgn.toLocaleString("en-NG")} NGN = ${rawPct.toLocaleString("en-NG")} NGN`,
    };
  }

  // pct_with_cap
  const min = policy.minFeeNgn ?? 0;
  const max = policy.maxFeeNgn ?? rawPct;
  const clamped = Math.max(min, Math.min(rawPct, max));
  const parts = [
    `${rate}% of ${productSubtotalNgn.toLocaleString("en-NG")} NGN = ${rawPct.toLocaleString("en-NG")} NGN`,
  ];
  if (rawPct < min) parts.push(`floored at ${min.toLocaleString("en-NG")} NGN`);
  else if (rawPct > max)
    parts.push(`capped at ${max.toLocaleString("en-NG")} NGN`);
  return {
    feeNgn: clamped,
    calculation: parts.join(", "),
  };
}

/**
 * Resolve the applicable service fee policy for an order.
 * Checks active policies in priority order; first match wins.
 * A policy matches when its retailer_slug and delivery_state are both null
 * (catch-all) or match the order's retailer and delivery state.
 * Returns null when no active policy matches.
 */
export async function resolveServiceFee(
  input: ServiceFeePolicyInput,
): Promise<ResolvedServiceFee | null> {
  const sql = getPostgresClient();
  const rows = await sql<PolicyRow[]>`
    select id, name, retailer_slug, delivery_state, fee_model,
           flat_fee_ngn, percentage_rate::text, min_fee_ngn, max_fee_ngn,
           priority, is_active, notes,
           created_at::text, updated_at::text
    from service_fee_policies
    where is_active = true
      and (retailer_slug is null or retailer_slug = ${input.retailerSlug})
      and (delivery_state is null or delivery_state = ${input.deliveryState})
    order by priority desc, id
    limit 1
  `;
  if (!rows.length) return null;
  const policy = mapPolicy(rows[0]);
  const { feeNgn, calculation } = calculateFee(
    policy,
    input.productSubtotalNgn,
  );
  return {
    policyId: policy.id,
    policyName: policy.name,
    feeModel: policy.feeModel,
    feeNgn,
    calculation,
  };
}

export async function listServiceFeePolicies(): Promise<ServiceFeePolicy[]> {
  const sql = getPostgresClient();
  const rows = await sql<PolicyRow[]>`
    select id, name, retailer_slug, delivery_state, fee_model,
           flat_fee_ngn, percentage_rate::text, min_fee_ngn, max_fee_ngn,
           priority, is_active, notes,
           created_at::text, updated_at::text
    from service_fee_policies
    order by priority desc, created_at
  `;
  return rows.map(mapPolicy);
}

export type CreateServiceFeePolicyInput = {
  name: string;
  retailerSlug: string | null;
  deliveryState: string | null;
  feeModel: ServiceFeeModel;
  flatFeeNgn: number | null;
  percentageRate: number | null;
  minFeeNgn: number | null;
  maxFeeNgn: number | null;
  priority: number;
  notes: string | null;
};

export async function createServiceFeePolicy(
  input: CreateServiceFeePolicyInput,
): Promise<ServiceFeePolicy> {
  const sql = getPostgresClient();
  const [row] = await sql<PolicyRow[]>`
    insert into service_fee_policies (
      name, retailer_slug, delivery_state, fee_model,
      flat_fee_ngn, percentage_rate, min_fee_ngn, max_fee_ngn,
      priority, is_active, notes
    ) values (
      ${input.name}, ${input.retailerSlug}, ${input.deliveryState}, ${input.feeModel},
      ${input.flatFeeNgn}, ${input.percentageRate}, ${input.minFeeNgn}, ${input.maxFeeNgn},
      ${input.priority}, true, ${input.notes}
    )
    returning id, name, retailer_slug, delivery_state, fee_model,
              flat_fee_ngn, percentage_rate::text, min_fee_ngn, max_fee_ngn,
              priority, is_active, notes,
              created_at::text, updated_at::text
  `;
  return mapPolicy(row);
}

export type UpdateServiceFeePolicyInput = {
  id: string;
  name: string;
  retailerSlug: string | null;
  deliveryState: string | null;
  feeModel: ServiceFeeModel;
  flatFeeNgn: number | null;
  percentageRate: number | null;
  minFeeNgn: number | null;
  maxFeeNgn: number | null;
  priority: number;
  isActive: boolean;
  notes: string | null;
};

export async function updateServiceFeePolicy(
  input: UpdateServiceFeePolicyInput,
): Promise<ServiceFeePolicy | null> {
  const sql = getPostgresClient();
  const rows = await sql<PolicyRow[]>`
    update service_fee_policies set
      name = ${input.name},
      retailer_slug = ${input.retailerSlug},
      delivery_state = ${input.deliveryState},
      fee_model = ${input.feeModel},
      flat_fee_ngn = ${input.flatFeeNgn},
      percentage_rate = ${input.percentageRate},
      min_fee_ngn = ${input.minFeeNgn},
      max_fee_ngn = ${input.maxFeeNgn},
      priority = ${input.priority},
      is_active = ${input.isActive},
      notes = ${input.notes},
      updated_at = now()
    where id = ${input.id}
    returning id, name, retailer_slug, delivery_state, fee_model,
              flat_fee_ngn, percentage_rate::text, min_fee_ngn, max_fee_ngn,
              priority, is_active, notes,
              created_at::text, updated_at::text
  `;
  return rows.length ? mapPolicy(rows[0]) : null;
}
