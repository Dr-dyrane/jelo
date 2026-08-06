'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
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
 * Pipeline:
 * 1. Clone the target element
 * 2. Inline ALL computed styles (getComputedStyle resolves var() and color-mix())
 * 3. Convert all <img> src to data URLs (avoids cross-origin canvas tainting)
 * 4. Serialize to SVG with foreignObject
 * 5. Draw onto canvas at 2x retina quality
 * 6. Download as PNG
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
      const rect = target.getBoundingClientRect();
      const scale = 2;
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);

      // Clone and inline all computed styles
      const clone = target.cloneNode(true) as HTMLElement;
      await inlineAllStyles(target, clone);

      // Convert all images to data URLs
      await convertImagesToDataUrls(target, clone);

      // Remove any script tags from the clone
      clone.querySelectorAll('script').forEach(s => s.remove());

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;transform:scale(${scale});transform-origin:top left;overflow:hidden;">
${new XMLSerializer().serializeToString(clone)}
</div>
</foreignObject>
</svg>`;

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG render failed'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);

      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');

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

/**
 * Recursively inlines ALL computed styles from source onto target.
 * getComputedStyle already resolves var() references and color-mix()
 * to concrete values, so we just copy every property.
 */
async function inlineAllStyles(source: HTMLElement, target: HTMLElement) {
  const computed = window.getComputedStyle(source);
  // Copy every non-default computed property
  for (let i = 0; i < computed.length; i++) {
    const prop = computed.item(i);
    const value = computed.getPropertyValue(prop);
    if (value) target.style.setProperty(prop, value);
  }

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
    await inlineAllStyles(sourceChildren[i] as HTMLElement, targetChildren[i] as HTMLElement);
  }
}

/**
 * Converts all <img> elements' src to data URLs so they don't
 * taint the canvas with cross-origin errors.
 */
async function convertImagesToDataUrls(source: HTMLElement, clone: HTMLElement) {
  const sourceImgs = source.querySelectorAll('img');
  const cloneImgs = clone.querySelectorAll('img');

  await Promise.all(Array.from(sourceImgs).map(async (img, i) => {
    const cloneImg = cloneImgs[i] as HTMLImageElement | undefined;
    if (!cloneImg) return;
    try {
      const src = img.src;
      if (!src || src.startsWith('data:')) return;
      const res = await fetch(src, { mode: 'cors' });
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      cloneImg.src = dataUrl;
      cloneImg.removeAttribute('srcset');
    } catch {
      // If we can't fetch the image, leave it — the SVG will still
      // render, just with a broken image placeholder for that one.
    }
  }));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
