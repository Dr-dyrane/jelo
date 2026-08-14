import assert from "node:assert/strict";
import test from "node:test";
import { deliverWithSmtpFallback } from "@/lib/email/delivery-strategy";
import {
  HostingerMailApiError,
  isSafeHostingerMailApiFallback,
} from "@/lib/email/hostinger-mail-api";

test("a definitive API rejection falls back once to configured SMTP", async () => {
  const attempts: string[] = [];
  let fallbackNoticeCount = 0;

  await deliverWithSmtpFallback({
    sendApi: async () => {
      attempts.push("api");
      throw new HostingerMailApiError(
        "hostinger_mail_account_401",
        false,
        true,
      );
    },
    sendSmtp: async () => {
      attempts.push("smtp");
    },
    canFallbackFromApi: isSafeHostingerMailApiFallback,
    onApiFallback: () => {
      fallbackNoticeCount += 1;
    },
  });

  assert.deepEqual(attempts, ["api", "smtp"]);
  assert.equal(fallbackNoticeCount, 1);
});

test("an uncertain API send does not risk a duplicate SMTP delivery", async () => {
  let smtpAttempts = 0;

  await assert.rejects(
    deliverWithSmtpFallback({
      sendApi: async () => {
        throw new HostingerMailApiError(
          "hostinger_mail_send_uncertain",
          true,
          false,
        );
      },
      sendSmtp: async () => {
        smtpAttempts += 1;
      },
      canFallbackFromApi: isSafeHostingerMailApiFallback,
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "transactional_email_api_failed");
      assert.doesNotMatch(
        (error as Error).message,
        /hostinger_mail_send_uncertain/,
      );
      return true;
    },
  );

  assert.equal(smtpAttempts, 0);
});

test("a failed fallback exposes only a generic delivery error", async () => {
  await assert.rejects(
    deliverWithSmtpFallback({
      sendApi: async () => {
        throw new Error("api-secret");
      },
      sendSmtp: async () => {
        throw new Error("smtp-secret");
      },
      canFallbackFromApi: () => true,
    }),
    (error: unknown) => {
      assert.equal(
        (error as Error).message,
        "transactional_email_delivery_failed",
      );
      assert.doesNotMatch((error as Error).message, /api-secret|smtp-secret/);
      return true;
    },
  );
});
