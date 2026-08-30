"use client";

import { Hash, LockKeyhole, Mail } from "lucide-react";
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
      <div className={styles.recoveryIntro}>
        <span className={styles.recoveryIcon} aria-hidden="true">
          <LockKeyhole size={20} />
        </span>
        <p className={styles.recoveryHint} id="order-recovery-hint">
          Reference and email from your request.
        </p>
      </div>
      <label>
        <span>
          <Hash size={14} aria-hidden="true" /> Order reference
        </span>
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
        <span>
          <Mail size={14} aria-hidden="true" /> Email
        </span>
        <input
          name="contactEmail"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
        />
      </label>
      <button type="submit" disabled={pending}>
        <Mail size={17} aria-hidden="true" />
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
