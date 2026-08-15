"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseMotionProjectV1,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { createStageRenderer } from "@/lib/editor/stage/stage-renderer-factory";
import type { StageRendererPort } from "@/lib/editor/stage/stage-renderer-port";
import { compositionFps } from "@/lib/runtime/project-composition";

export function DocsPixiPreview({
  project,
  play = false,
}: {
  project: unknown;
  play?: boolean;
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
      renderer.setScale(0.28);
      renderer.setDocument({ project: parsed, clips: [], lanes: [] });
      const fps = compositionFps(parsed);
      renderer.paintFrame(0);
      if (!play) return;
      const started = performance.now();
      const duration = parsed.timeline.duration ?? 5;
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
        <div
          ref={hostRef}
          className="relative h-[220px] w-full overflow-hidden bg-white"
          data-testid="docs-pixi-preview"
        />
      )}
    </div>
  );
}
