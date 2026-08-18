"use client";

import { useEffect, useRef } from "react";

/**
 * Neon ring that pulses on a ~2Hz beat envelope.
 *
 * Phase 2 stand-in: a synthetic pulse. Phase 3 swaps this for real data from
 * `packages/audio-analysis` (`clip-ring-scale` + `clip-beat-glow`).
 */
export function BeatPulsePreview() {
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const phase = t % 0.5; // 0..0.5s
      const beat = Math.exp(-phase * 14); // sharp attack + fast decay
      const scale = 1 + beat * 0.1;
      const glow = 0.35 + beat * 0.65;

      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${scale.toFixed(4)})`;
      }
      if (glowRef.current) {
        glowRef.current.style.opacity = glow.toFixed(3);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative grid h-[300px] w-full place-items-center sm:h-[380px]">
      <div
        ref={glowRef}
        className="absolute h-56 w-56 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.5) 0%, rgba(34,211,238,0) 70%)",
        }}
      />
      <div
        ref={ringRef}
        className="relative h-40 w-40 rounded-full border-2 border-[var(--accent)] will-change-transform"
        style={{
          boxShadow:
            "0 0 30px rgba(34,211,238,0.6), inset 0 0 30px rgba(34,211,238,0.4)",
        }}
      />
      <div
        className="absolute h-28 w-28 rounded-full border border-[var(--accent-magenta)]"
        style={{ boxShadow: "0 0 20px rgba(192,132,252,0.5)" }}
      />
      <span className="absolute font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">
        beat sync
      </span>
    </div>
  );
}
