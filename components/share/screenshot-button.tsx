'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import styles from './screenshot-button.module.css';

type Props = {
  /** The OG image URL to fetch (e.g. /og?kind=product&slug=...&surface=share) */
  ogUrl: string;
  fileName: string;
};

/**
 * One-tap card screenshot. Fetches the pixel-perfect OG image from the
 * /og endpoint (rendered server-side by next/og via Satori + resvg),
 * plays a camera shutter sound, flashes the screen, and downloads the
 * PNG to the device. This is the same image used for social sharing,
 * so it's always pixel-perfect — no DOM capture, no canvas tainting,
 * no cross-origin image issues.
 */
export function ScreenshotButton({ ogUrl, fileName }: Props) {
  const [state, setState] = useState<'idle' | 'flashing' | 'done'>('idle');
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playShutter() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      function click(at: number) {
        const bufferSize = Math.floor(ctx.sampleRate * 0.03);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(2500, at);
        bandpass.Q.setValueAtTime(2, at);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.025);

        noise.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(ctx.destination);
        noise.start(at);
        noise.stop(at + 0.03);
      }

      click(now);
      click(now + 0.06);
    } catch {
      // Audio is a nice-to-have; ignore failures silently.
    }
  }

  async function captureCard() {
    setState('flashing');
    playShutter();

    try {
      const res = await fetch(ogUrl);
      if (!res.ok) throw new Error(`OG image fetch failed: ${res.status}`);
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState('done');
      setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('done');
      setTimeout(() => setState('idle'), 1800);
    }
  }

  return (
    <button
      className={`${styles.button} ${state === 'flashing' ? styles.flashing : ''} ${state === 'done' ? styles.done : ''}`}
      onClick={captureCard}
      aria-label="Save card as image"
      title="Save card as image"
    >
      {state === 'done' ? <Check size={18} strokeWidth={1.5} aria-hidden="true" />
      : state === 'flashing' ? <Loader2 size={18} strokeWidth={1.5} aria-hidden="true" className={styles.spin} />
      : <Camera size={18} strokeWidth={1.5} aria-hidden="true" />}
      {state === 'flashing' ? <span className={styles.flash} /> : null}
    </button>
  );
}
