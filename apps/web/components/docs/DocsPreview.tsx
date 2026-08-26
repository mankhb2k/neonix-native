"use client";

import { useEffect, useState } from "react";
import { PreviewStage } from "@/components/docs/PreviewStage";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";

const hostCanvasClass =
  "relative h-[240px] w-full overflow-hidden bg-[var(--bg-surface)]";

export function DocsPreview({
  project,
  play = false,
  chrome = "gallery",
}: {
  project: unknown;
  play?: boolean;
  chrome?: "gallery" | "bare";
}) {
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      MotionProtocolV2Schema.parse(project);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [project]);

  useEffect(() => {
    if (!play || error) return undefined;
    const parsed = MotionProtocolV2Schema.parse(project);
    const duration = Math.max(
      0.1,
      ...parsed.layers.map((layer) => layer.timing.start + layer.timing.duration),
    );
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      setTime(((now - started) / 1000) % duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [error, play, project]);

  const stage = error ? (
    <pre className="h-[240px] overflow-auto p-3 text-[12px] text-red-700 whitespace-pre-wrap">
      {error}
    </pre>
  ) : (
    <div className={hostCanvasClass} data-testid="docs-preview-v2">
      <PreviewStage project={project} time={time} />
    </div>
  );

  if (chrome === "bare") return stage;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-surface)]">
      <p className="border-b border-[var(--border-subtle,#e4e4e7)] px-3 py-2 text-[11px] text-[var(--fg-muted)]">
        Protocol V2 atom preview
      </p>
      {stage}
    </div>
  );
}

export function docsStageViewBox(project: unknown): {
  width: number;
  height: number;
} | null {
  try {
    const parsed = MotionProtocolV2Schema.parse(project);
    return {
      width: parsed.composition.width,
      height: parsed.composition.height,
    };
  } catch {
    return null;
  }
}
