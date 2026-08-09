"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Download, Loader2 } from "lucide-react";
import styles from "./screenshot-button.module.css";

type Props = {
  href: string;
  fileName: string;
  label: string;
};

type DownloadState = "idle" | "working" | "done" | "error";

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/\.png$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${cleaned || "jelocare-story"}.png`;
}

/** Downloads one deterministic server-rendered 1080 × 1920 campaign story. */
export function ScreenshotButton({ href, fileName, label }: Props) {
  const [state, setState] = useState<DownloadState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  function resetLater() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), 2400);
  }

  async function downloadStory() {
    if (state === "working") return;
    setState("working");

    try {
      const response = await fetch(href, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "image/png" },
      });
      if (!response.ok) {
        const message = (await response.text()).trim();
        throw new Error(message || `Story render failed (${response.status}).`);
      }
      const blob = await response.blob();
      if (blob.type !== "image/png" || blob.size === 0) {
        throw new Error("The story renderer did not return a PNG.");
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeFileName(fileName);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setState("done");
      resetLater();
    } catch (error) {
      console.error("Campaign story download failed:", error);
      setState("error");
      resetLater();
    }
  }

  const visibleLabel =
    state === "working"
      ? "Preparing story"
      : state === "done"
        ? "Story saved"
        : state === "error"
          ? "Try again"
          : label;

  return (
    <button
      type="button"
      className={`${styles.button} ${state === "done" ? styles.done : ""} ${state === "error" ? styles.error : ""}`}
      onClick={downloadStory}
      disabled={state === "working"}
      aria-busy={state === "working"}
      aria-label={visibleLabel}
      title={visibleLabel}
    >
      {state === "working" ? (
        <Loader2
          size={16}
          strokeWidth={1.7}
          aria-hidden="true"
          className={styles.spin}
        />
      ) : state === "done" ? (
        <Check size={16} strokeWidth={1.7} aria-hidden="true" />
      ) : state === "error" ? (
        <AlertCircle size={16} strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <Download size={16} strokeWidth={1.7} aria-hidden="true" />
      )}
      <span className={styles.status} aria-live="polite" aria-atomic="true">
        {state === "done"
          ? `${label} downloaded.`
          : state === "error"
            ? `${label} could not be downloaded.`
            : ""}
      </span>
    </button>
  );
}
