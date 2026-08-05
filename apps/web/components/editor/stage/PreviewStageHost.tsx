"use client";

/**
 * Stage shell for web — patterned after desktop PreviewStage (no desktop imports).
 * React owns lifecycle + document revision; playback ticks paint via StageRendererPort.
 */

import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";
import { createStageRendererLazy, resolveStageRendererBackend } from "@/lib/editor/stage/stage-renderer-factory";
import type { StageRendererPort } from "@/lib/editor/stage/stage-renderer-port";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import type { MotionProject } from "@motionvideo/motion-schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
};

export function PreviewStageHost({ project, clips, lanes }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<StageRendererPort | null>(null);
  const [scale, setScale] = useState(0.25);

  const projectAvailable = project !== null;
  const aspectRatio = project?.metadata.aspectRatio;
  const background = project?.metadata.brand?.primaryColor ?? "#ffffff";
  const fps = project
    ? Math.max(1, Math.round(project.metadata.fps ?? 30))
    : 30;
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  const projectRef = useRef(project);
  const clipsRef = useRef(clips);
  const lanesRef = useRef(lanes);
  const backgroundRef = useRef(background);
  const scaleRef = useRef(scale);
  projectRef.current = project;
  clipsRef.current = clips;
  lanesRef.current = lanes;
  backgroundRef.current = background;
  scaleRef.current = scale;

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || !aspectRatio) return undefined;
    const stage = stageSizeForAspect(aspectRatio);
    const update = () => {
      const pad = 48;
      const availW = Math.max(80, el.clientWidth - pad);
      const availH = Math.max(80, el.clientHeight - pad);
      const next = Math.min(availW / stage.width, availH / stage.height, 1);
      setScale(Math.max(0.08, next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio]);

  useEffect(() => {
    if (!projectAvailable) return undefined;
    const mount = mountRef.current;
    if (!mount) return undefined;
    let cancelled = false;
    let renderer: StageRendererPort | null = null;
    void createStageRendererLazy(mount, resolveStageRendererBackend()).then((r) => {
      renderer = r;
      if (cancelled) {
        renderer = null;
        r.dispose();
        return;
      }
      rendererRef.current = r;
      const p = projectRef.current;
      if (p) {
        r.setDocument({
          project: p,
          clips: clipsRef.current,
          lanes: lanesRef.current,
        });
        r.setBackground(backgroundRef.current);
        r.setScale(scaleRef.current);
        r.paintFrame(
          playbackFrameIndex(
            usePlaybackClock.getState().currentTime,
            fpsRef.current,
          ),
        );
      }
    });
    return () => {
      cancelled = true;
      const active = rendererRef.current ?? renderer;
      rendererRef.current = null;
      renderer = null;
      active?.dispose();
    };
  }, [projectAvailable]);

  useEffect(() => {
    if (!project) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setDocument({ project, clips, lanes });
    renderer.paintFrame(
      playbackFrameIndex(usePlaybackClock.getState().currentTime, fps),
    );
  }, [project, clips, lanes, fps]);

  useEffect(() => {
    rendererRef.current?.setBackground(background);
  }, [background]);

  useEffect(() => {
    rendererRef.current?.setScale(scale);
  }, [scale]);

  useEffect(() => {
    if (!projectAvailable) return undefined;
    let last = -1;
    return usePlaybackClock.subscribe((state) => {
      const frame = playbackFrameIndex(state.currentTime, fpsRef.current);
      if (frame === last) return;
      last = frame;
      rendererRef.current?.paintFrame(frame);
    });
  }, [projectAvailable]);

  if (!project) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-[12px] text-[var(--fg-muted)]"
        data-testid="preview-stage"
      >
        No project loaded
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--preview-bg)]"
      data-testid="preview-stage"
      ref={hostRef}
    >
      <div
        className="preview-stage__viewport relative overflow-hidden"
        ref={mountRef}
        data-testid="editor-stage-frame"
      />
    </div>
  );
}
