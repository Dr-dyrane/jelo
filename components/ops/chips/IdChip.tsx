'use client';

import { useState } from 'react';
import { idChip } from '@/lib/humanize/ids';
import styles from './chips.module.css';

// A short head of an opaque id (UUID, contribution ref) on a pill; click copies
// the full value. title carries the full value for hover.
export function IdChip({ value, label }: { value: string; label?: string }) {
  const { short, full } = idChip(value);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard denied (insecure context / permissions) — the title still shows the value.
    }
  }

  return (
    <span className={styles.idChipWrap}>
      {label ? <span className={styles.idChipLabel}>{label}</span> : null}
      <button
        type="button"
        className={`${styles.idChip} ${copied ? styles.copied : ''}`}
        title={full}
        aria-label={`Copy ${label ?? 'id'} ${full}`}
        onClick={copy}
      >
        {copied ? 'copied' : short}
      </button>
    </span>
  );
}
