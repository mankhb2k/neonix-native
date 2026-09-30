"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type HtmlFramePreviewProps = {
  html: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
};

/**
 * Frame-by-frame preview for raw HTML projects (Kiến trúc A). The page is
 * rendered by the browser itself in a sandboxed frame (scripts disabled) and
 * every CSS animation is driven to the exact frame time.
 */
export function HtmlFramePreview({ html, width, height, fps, durationSec }: HtmlFramePreviewProps) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const lastFrame = totalFrames - 1;

  const seekDocument = useCallback((frameIndex: number) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const timeMs = (frameIndex / fps) * 1000;
    for (const animation of doc.getAnimations()) {
      animation.pause();
      animation.currentTime = timeMs;
    }
  }, [fps]);

  const goToFrame = useCallback((next: number) => {
    const clamped = Math.min(lastFrame, Math.max(0, Math.round(next)));
    frameRef.current = clamped;
    setFrame(clamped);
    seekDocument(clamped);
  }, [lastFrame, seekDocument]);

  useEffect(() => {
    if (frameRef.current > lastFrame) goToFrame(lastFrame);
    else seekDocument(frameRef.current);
  }, [lastFrame, goToFrame, seekDocument]);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let previous = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += now - previous;
      previous = now;
      const step = 1000 / fps;
      if (carry >= step) {
        const advance = Math.floor(carry / step);
        carry -= advance * step;
        goToFrame((frameRef.current + advance) % totalFrames);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, totalFrames, goToFrame]);

  useEffect(() => {
    const element = stageWrapRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(1, entry.contentRect.width / width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div className="min-w-0">
      <div ref={stageWrapRef} className="w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/5">
        <div style={{ width: width * scale, height: height * scale }}>
          <iframe
            ref={iframeRef}
            title="HTML frame preview"
            srcDoc={html}
            sandbox="allow-same-origin"
            onLoad={() => seekDocument(frameRef.current)}
            style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", background: "#fff" }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setPlaying(false); goToFrame(0); }} aria-label="First frame" className="rounded-lg border border-[var(--border-subtle)] p-2 hover:bg-black/5"><ChevronFirst className="size-4" /></button>
        <button type="button" onClick={() => { setPlaying(false); goToFrame(frame - 1); }} aria-label="Previous frame" className="rounded-lg border border-[var(--border-subtle)] p-2 hover:bg-black/5"><ChevronLeft className="size-4" /></button>
        <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause" : "Play"} className="rounded-lg bg-[var(--accent-text)] p-2 text-white">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
        <button type="button" onClick={() => { setPlaying(false); goToFrame(frame + 1); }} aria-label="Next frame" className="rounded-lg border border-[var(--border-subtle)] p-2 hover:bg-black/5"><ChevronRight className="size-4" /></button>
        <button type="button" onClick={() => { setPlaying(false); goToFrame(lastFrame); }} aria-label="Last frame" className="rounded-lg border border-[var(--border-subtle)] p-2 hover:bg-black/5"><ChevronLast className="size-4" /></button>
        <input
          type="range"
          min={0}
          max={lastFrame}
          value={frame}
          onChange={(event) => { setPlaying(false); goToFrame(Number(event.target.value)); }}
          aria-label="Timeline"
          className="min-w-40 flex-1"
        />
        <span className="font-mono text-sm tabular-nums text-[var(--fg-muted)]">
          {frame} / {lastFrame} · {(frame / fps).toFixed(2)}s
        </span>
      </div>
    </div>
  );
}
