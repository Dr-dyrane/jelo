/**
 * JeloCare manual bank transfer details.
 * Used in the customer-facing payment section when Stripe is unavailable
 * or the customer prefers a direct bank transfer.
 */
export const JELOCARE_BANK_ACCOUNT = {
  bankName: "Opay",
  accountName: "Umeh JeloCare",
  accountNumber: "8122887847",
} as const;
