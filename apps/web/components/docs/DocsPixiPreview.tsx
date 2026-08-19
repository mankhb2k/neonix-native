"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseMotionProjectV1,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { deriveProjectDurationV1 } from "@motionvideo/patterns";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { createStageRenderer } from "@/lib/editor/stage/stage-renderer-factory";
import type { StageRendererPort } from "@/lib/editor/stage/stage-renderer-port";
import {
  compositionAspectRatio,
  compositionFps,
} from "@/lib/runtime/project-composition";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";

const hostCanvasClass =
  "relative h-[240px] w-full overflow-hidden bg-[var(--bg-surface)] [&_canvas]:absolute [&_canvas]:inset-0 [&_canvas]:h-full [&_canvas]:w-full [&_canvas]:object-contain";

export function DocsPixiPreview({
  project,
  play = false,
  chrome = "gallery",
}: {
  project: unknown;
  play?: boolean;
  chrome?: "gallery" | "bare";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<StageRendererPort | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let raf = 0;
    let parsed: MotionProject;

    try {
      parsed = parseMotionProjectV1(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    try {
      compileMotionProject(parsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Compiler: ${err.message.slice(0, 400)}`
          : String(err),
      );
      return;
    }

    setError(null);
    void createStageRenderer(host, "pixi").then((renderer) => {
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      renderer.setScale(1);
      renderer.setBackground(parsed.composition.background);
      renderer.setDocument({ project: parsed, clips: [], lanes: [] });
      const fps = compositionFps(parsed);
      renderer.paintFrame(0);
      if (!play) return;
      const started = performance.now();
      const duration = deriveProjectDurationV1(parsed.layers) || 5;
      const tick = (now: number) => {
        const t = ((now - started) / 1000) % Math.max(duration, 0.1);
        renderer.paintFrame(Math.round(t * fps));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      rendererRef.current?.dispose();
      rendererRef.current = null;
      host.replaceChildren();
    };
  }, [project, play]);

  const stage = error ? null : (
    <div
      ref={hostRef}
      className={hostCanvasClass}
      data-testid="docs-pixi-preview"
    />
  );

  if (chrome === "bare") {
    if (error) {
      return (
        <pre className="h-[240px] overflow-auto p-3 text-[12px] text-red-700 whitespace-pre-wrap">
          {error}
        </pre>
      );
    }
    return stage;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-surface)]">
      <p className="border-b border-[var(--border-subtle,#e4e4e7)] px-3 py-2 text-[11px] text-[var(--fg-muted)]">
        Live preview — not a schema validator.
      </p>
      {error ? (
        <pre className="p-3 text-[12px] text-red-700 whitespace-pre-wrap">
          {error}
        </pre>
      ) : (
        stage
      )}
    </div>
  );
}

export function docsStageViewBox(project: unknown): {
  width: number;
  height: number;
} | null {
  try {
    const parsed = parseMotionProjectV1(project);
    return stageSizeForAspect(compositionAspectRatio(parsed));
  } catch {
    return null;
  }
}
