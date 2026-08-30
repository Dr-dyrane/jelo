"use client";

import { useState } from "react";
import styles from "./order-status.module.css";

export function OrderRecoveryForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "danger">("info");

  return (
    <form
      className={styles.recoveryForm}
      aria-busy={pending}
      aria-describedby={
        message
          ? "order-recovery-hint order-recovery-status"
          : "order-recovery-hint"
      }
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/orders/recovery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reference: data.get("reference"),
              contactEmail: data.get("contactEmail"),
            }),
          });
          setMessageTone(response.ok ? "info" : "danger");
          setMessage(
            response.ok
              ? "If the details match an active request, we’ll email a new private link."
              : "We couldn’t send a link. Check the details and try again.",
          );
        } catch {
          setMessageTone("danger");
          setMessage("The connection was interrupted. Try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <p className={styles.recoveryHint} id="order-recovery-hint">
        Use the reference and email from your request.
      </p>
      <label>
        <span>Order reference</span>
        <input
          name="reference"
          placeholder="JC-0000000000"
          required
          pattern="JC-[A-Za-z0-9]{10}"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
        />
      </label>
      <label>
        <span>Email</span>
        <input
          name="contactEmail"
          type="email"
          required
          autoComplete="email"
          enterKeyHint="send"
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email private link"}
      </button>
      {message ? (
        <p id="order-recovery-status" role="status" data-tone={messageTone}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
