"use client";

import { useEffect, useRef, useState } from "react";
import { canUseWebGL } from "@/lib/device-capability";

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_opacity;

// Hash-based noise — cheap but sufficient for subtle atmosphere
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  // Slowly drifting "sun" position
  float t = u_time * 0.04;
  vec2 sun = vec2(
    0.3 + 0.15 * sin(t),
    0.4 + 0.1 * cos(t * 0.8)
  );
  float dist = length(p - vec2(sun.x * (u_resolution.x / u_resolution.y), sun.y));
  float sunGlow = 0.6 / (dist * dist + 0.15);

  // Color palette — warm cream/peach/rose
  vec3 cream = vec3(0.98, 0.95, 0.93);
  vec3 peach = vec3(0.96, 0.87, 0.79);
  vec3 rose  = vec3(0.93, 0.82, 0.80);

  // Base gradient shifts over time
  float phase = sin(u_time * 0.025) * 0.5 + 0.5;
  vec3 base = mix(cream, peach, phase);
  base = mix(base, rose, sin(u_time * 0.018) * 0.3 + 0.3);

  // Add fbm texture for organic movement
  float n = fbm(uv * 3.0 + vec2(u_time * 0.01, u_time * 0.008));
  base += (n - 0.5) * 0.06;

  // Add sun glow
  base += vec3(1.0, 0.95, 0.88) * sunGlow * 0.15;

  // Subtle grain
  float grain = hash(uv * u_resolution.xy + u_time) * 0.03;
  base += grain - 0.015;

  gl_FragColor = vec4(base, u_opacity);
}
`;

type MorningLightCanvasProps = {
  opacity?: number;
  className?: string;
};

/**
 * WebGL morning light shader. A fullscreen canvas that renders a warm,
 * slowly shifting gradient with a drifting "sun" and subtle grain.
 *
 * Sits behind hero content (z-index 1), above the background image.
 * Pauses when the hero is out of viewport. Falls back to nothing (the
 * existing CSS gradient/image remains) when WebGL is unavailable.
 */
export function MorningLightCanvas({
  opacity = 0.5,
  className,
}: MorningLightCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Detect WebGL after mount to avoid SSR hydration mismatch.
    // This is a one-time capability check, not reactive state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(canUseWebGL());
  }, []);

  useEffect(() => {
    if (!supported) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return;

    // Compile shaders
    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // Fullscreen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const opLoc = gl.getUniformLocation(program, "u_opacity");

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas!.clientWidth * dpr;
      const h = canvas!.clientHeight * dpr;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }

    let visible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const start = performance.now();
    function render() {
      if (visible) {
        resize();
        const time = (performance.now() - start) / 1000;
        gl!.uniform2f(resLoc, canvas!.width, canvas!.height);
        gl!.uniform1f(timeLoc, time);
        gl!.uniform1f(opLoc, opacity);
        gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      }
      rafRef.current = requestAnimationFrame(render);
    }
    render();

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [opacity, supported]);

  if (!supported) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
