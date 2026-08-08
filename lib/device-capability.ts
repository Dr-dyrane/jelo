/**
 * Device capability detection for progressive enhancement.
 *
 * WebGL effects (morning light shader, product light shift, ingredient
 * particles, glass refraction) are only rendered when the device can
 * handle them. On low-end devices or slow connections, the existing CSS
 * atmosphere remains.
 */

const SESSION_KEY = "jelo-device-capability";

type Capability = {
  webgl: boolean;
  heavyMotion: boolean;
};

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl && gl instanceof WebGLRenderingContext;
  } catch {
    return false;
  }
}

function detectHeavyMotion(): boolean {
  if (typeof window === "undefined") return false;
  // Skip on low core counts — shader animation needs GPU headroom
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return false;
  // Skip on slow connections — shader source is tiny but the rAF loop
  // competes with image loading on metered data
  const conn = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection;
  if (conn?.effectiveType) {
    const slow = ["slow-2g", "2g", "3g"].includes(conn.effectiveType);
    if (slow) return false;
  }
  return true;
}

function readCache(): Capability | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return JSON.parse(cached) as Capability;
  } catch {
    // sessionStorage might be unavailable (private mode)
  }
  return null;
}

function writeCache(cap: Capability): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(cap));
  } catch {
    // ignore
  }
}

/**
 * Returns true if the device supports WebGL and has enough GPU/CPU
 * headroom for shader-based atmosphere effects.
 */
export function canUseWebGL(): boolean {
  const cached = readCache();
  if (cached) return cached.webgl;
  const webgl = detectWebGL();
  const heavyMotion = detectHeavyMotion();
  const result: Capability = { webgl: webgl && heavyMotion, heavyMotion };
  writeCache(result);
  return result.webgl;
}

/**
 * Returns true if the device can handle heavy motion (springs, rAF
 * loops, multiple concurrent animations). Used to gate non-WebGL
 * effects like Ken Burns drift or breathing CTAs on low-end devices.
 */
export function canUseHeavyMotion(): boolean {
  const cached = readCache();
  if (cached) return cached.heavyMotion;
  const heavyMotion = detectHeavyMotion();
  const webgl = detectWebGL();
  const result: Capability = { webgl: webgl && heavyMotion, heavyMotion };
  writeCache(result);
  return result.heavyMotion;
}
