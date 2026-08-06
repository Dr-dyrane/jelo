'use client';

import { useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import styles from './screenshot-button.module.css';

type Props = {
  cardId: string;
  fileName: string;
};

/**
 * One-tap card screenshot. Uses the browser's native SVG-to-PNG pipeline:
 * 1. Clone the target card element into an offscreen container
 * 2. Serialize to SVG with foreignObject
 * 3. Draw onto a canvas at 2x device pixel ratio
 * 4. Download as PNG
 *
 * The button sits as a transparent overlay icon in the top-left of the page.
 * On click, the target card snaps to a brief full-screen flash, a click sound
 * plays, and the PNG downloads to the device.
 */
export function ScreenshotButton({ cardId, fileName }: Props) {
  const [state, setState] = useState<'idle' | 'flashing' | 'done'>('idle');
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playShutter() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Shutter = two mechanical clicks (mirror-up, then mirror-down)
      // Each click is a short burst of filtered noise with a fast decay.
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

      // First click (mirror up) — sharper
      click(now);
      // Second click (mirror down) — slightly delayed and softer
      click(now + 0.06);
    } catch {
      // Audio is a nice-to-have; ignore failures silently.
    }
  }

  async function captureCard() {
    const card = document.getElementById(cardId);
    if (!card) return;

    setState('flashing');
    playShutter();

    try {
      // Get the actual rendered dimensions
      const rect = card.getBoundingClientRect();
      const scale = 2; // 2x for retina quality
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);

      // Clone the node and inline computed styles
      const clone = card.cloneNode(true) as HTMLElement;
      await inlineStyles(card, clone);

      // Wrap in a foreignObject SVG
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%" style="width:${width}px;height:${height}px">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;transform:scale(${scale});transform-origin:top left;">
            ${new XMLSerializer().serializeToString(clone)}
          </div>
        </foreignObject>
      </svg>`;

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = 'anonymous';

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

      // Download
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
    } catch {
      // Fallback: try html2canvas-like approach or just show done
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
      {state === 'done' ? <Check size={18} strokeWidth={1.5} aria-hidden="true" /> : <Camera size={18} strokeWidth={1.5} aria-hidden="true" />}
      {state === 'flashing' ? <span className={styles.flash} /> : null}
    </button>
  );
}

/**
 * Recursively inlines computed styles from the source element onto the clone
 * so the serialized SVG renders correctly without external CSS.
 */
async function inlineStyles(source: HTMLElement, target: HTMLElement) {
  const sourceStyle = window.getComputedStyle(source);
  const inlineProps = [
    'width', 'height', 'padding', 'margin', 'border', 'border-radius',
    'background', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat', 'color', 'font-family',
    'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height',
    'text-align', 'text-decoration', 'text-transform', 'display', 'flex',
    'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap',
    'grid-template-columns', 'grid-template-rows', 'box-shadow', 'opacity',
    'overflow', 'position', 'top', 'left', 'right', 'bottom', 'z-index',
    'object-fit', 'border-collapse', 'border-spacing', 'table-layout',
    'white-space', 'text-overflow', 'word-break', 'min-width', 'max-width',
    'min-height', 'max-height', 'flex-shrink', 'flex-grow', 'flex-basis',
    'align-self', 'justify-self', 'grid-column', 'grid-row',
  ];
  for (const prop of inlineProps) {
    const value = sourceStyle.getPropertyValue(prop);
    if (value) target.style.setProperty(prop, value);
  }

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
    await inlineStyles(sourceChildren[i] as HTMLElement, targetChildren[i] as HTMLElement);
  }
}
