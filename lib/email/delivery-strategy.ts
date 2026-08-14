type DeliveryAttempt = () => Promise<unknown>;

type TransactionalDeliveryInput = {
  sendApi?: DeliveryAttempt;
  sendSmtp?: DeliveryAttempt;
  canFallbackFromApi: (error: unknown) => boolean;
  onApiFallback?: () => void;
};

// API delivery is preferred, but a definitive rejection before acceptance may
// use the independently configured SMTP transport. An ambiguous API send never
// falls back because doing so could deliver the same message twice.
export async function deliverWithSmtpFallback(
  input: TransactionalDeliveryInput,
): Promise<void> {
  if (input.sendApi) {
    try {
      await input.sendApi();
      return;
    } catch (error) {
      if (!input.sendSmtp || !input.canFallbackFromApi(error)) {
        throw new Error("transactional_email_api_failed");
      }
      input.onApiFallback?.();
      try {
        await input.sendSmtp();
        return;
      } catch {
        throw new Error("transactional_email_delivery_failed");
      }
    }
  }

  if (input.sendSmtp) {
    try {
      await input.sendSmtp();
      return;
    } catch {
      throw new Error("transactional_email_smtp_failed");
    }
  }

  throw new Error("transactional_email_not_configured");
}
