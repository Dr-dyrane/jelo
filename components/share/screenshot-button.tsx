'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import styles from './screenshot-button.module.css';

type Props = {
  /** The DOM element ID to capture */
  targetId: string;
  fileName: string;
};

/**
 * One-tap card screenshot. Captures the actual rendered DOM element
 * (the card grid with both the share card and trend card) as a PNG.
 *
 * Uses html-to-image which handles:
 * - Cross-origin images (fetches and converts to data URLs)
 * - CSS custom properties (inlines computed styles)
 * - color-mix() and gradients (resolved via getComputedStyle)
 * - Web fonts (embeds as data URLs)
 * - SVG foreignObject serialization
 */
export function ScreenshotButton({ targetId, fileName }: Props) {
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
    const target = document.getElementById(targetId);
    if (!target) return;

    setState('flashing');
    playShutter();

    try {
      const dataUrl = await toPng(target, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#fffdf9',
        skipFonts: false,
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setState('done');
      setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      console.error('Screenshot failed:', err);
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
