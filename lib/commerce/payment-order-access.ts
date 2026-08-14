import "server-only";

import {
  readAssistedOrderBySession,
  readAssistedOrderForOwner,
  type AssistedOrderPrivateView,
} from "./assisted-procurement-repository";

type PaymentOrderReaders = {
  readForOwner: typeof readAssistedOrderForOwner;
  readBySession: typeof readAssistedOrderBySession;
};

const defaultReaders: PaymentOrderReaders = {
  readForOwner: readAssistedOrderForOwner,
  readBySession: readAssistedOrderBySession,
};

/**
 * Resolve exactly one order for payment. A signed-in request is owner-bound
 * and never falls back to a guest cookie. A guest request is capability-bound
 * and cannot select a different order through the JSON body.
 */
export async function resolvePaymentOrderAccess(
  input: {
    ownerSubject: string | null;
    requestedOrderId: string | null;
    sessionHash: string | null;
  },
  readers: PaymentOrderReaders = defaultReaders,
): Promise<{
  order: AssistedOrderPrivateView;
  surface: "member" | "guest";
} | null> {
  if (input.ownerSubject) {
    if (!input.requestedOrderId) return null;
    const owned = await readers.readForOwner(
      input.requestedOrderId,
      input.ownerSubject,
    );
    if (owned) return { order: owned, surface: "member" };

    // A person may sign in while an already-approved guest order remains open.
    // The exact requested ID must still match the guest capability; a stale or
    // unrelated cookie can never replace the requested owner order.
    if (!input.sessionHash) return null;
    const guest = await readers.readBySession(input.sessionHash);
    return guest?.id === input.requestedOrderId
      ? { order: guest, surface: "guest" }
      : null;
  }

  if (!input.sessionHash) return null;
  const order = await readers.readBySession(input.sessionHash);
  if (!order) return null;
  return input.requestedOrderId && input.requestedOrderId !== order.id
    ? null
    : { order, surface: "guest" };
}
