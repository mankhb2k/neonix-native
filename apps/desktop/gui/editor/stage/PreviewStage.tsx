import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlaybackClockApi } from "../playback/playback-clock-store";
import {
  playbackFrameIndex,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { stageSizeForAspect } from "../preview/preview-evaluate";
import {
  createStageRendererLazy,
  prefetchCanvasStageRenderer,
  STAGE_RENDERER_BACKEND,
} from "./stage-renderer-factory";
import type { StageRendererPort } from "./stage-renderer-port";
import type { MotionProject } from "@motionvideo/motion-protocol";
import "./stage-layout.css";

type Props = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
};

/**
 * Stage shell: React owns lifecycle + document revision; playback ticks
 * paint through StageRendererPort (no per-frame React setState).
 */
export function PreviewStage({ project, clips, lanes }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<StageRendererPort | null>(null);
  const [scale, setScale] = useState(0.25);
  const clock = usePlaybackClockApi();
  const projectAvailable = project !== null;
  const aspectRatio = project?.metadata.aspectRatio;
  const background = project?.metadata.brand?.primaryColor ?? "#0c0c0e";
  const fps = project
    ? Math.max(1, Math.round(project.metadata.fps ?? 30))
    : 30;
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || !aspectRatio) return undefined;
    const stage = stageSizeForAspect(aspectRatio);
    const update = () => {
      const pad = 48;
      const availW = Math.max(80, el.clientWidth - pad);
      const availH = Math.max(80, el.clientHeight - pad);
      const next = Math.min(availW / stage.width, availH / stage.height, 0.45);
      setScale(Math.max(0.08, next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio]);

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

  // Mount once when a project becomes available (remount only if clock identity changes).
  useEffect(() => {
    if (!projectAvailable) return undefined;
    const mount = mountRef.current;
    if (!mount) return undefined;
    let cancelled = false;
    let renderer: StageRendererPort | null = null;
    void createStageRendererLazy(mount, STAGE_RENDERER_BACKEND).then((r) => {
      // Assign first so cleanup can own dispose; re-check cancelled after assign.
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
          playbackFrameIndex(clock.getState().currentTime, fpsRef.current),
        );
      }
      prefetchCanvasStageRenderer();
    });
    return () => {
      cancelled = true;
      const active = rendererRef.current ?? renderer;
      rendererRef.current = null;
      renderer = null;
      // Idempotent StageRendererPort.dispose — call at most once per mount.
      active?.dispose();
    };
  }, [projectAvailable, clock]);

  useEffect(() => {
    if (!project) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setDocument({ project, clips, lanes });
    renderer.paintFrame(
      playbackFrameIndex(clock.getState().currentTime, fps),
    );
  }, [project, clips, lanes, clock, fps]);

  useEffect(() => {
    rendererRef.current?.setBackground(background);
  }, [background]);

  useEffect(() => {
    rendererRef.current?.setScale(scale);
  }, [scale]);

  useEffect(() => {
    if (!projectAvailable) return undefined;
    let last = -1;
    return clock.subscribe((state) => {
      const frame = playbackFrameIndex(state.currentTime, fpsRef.current);
      if (frame === last) return;
      last = frame;
      rendererRef.current?.paintFrame(frame);
    });
  }, [clock, projectAvailable]);

  if (!project) {
    return (
      <div className="preview-stage preview-stage--empty" data-testid="preview-stage">
        <p>No project loaded</p>
      </div>
    );
  }

  return (
    <div className="preview-stage" data-testid="preview-stage" ref={hostRef}>
      <div className="preview-stage__viewport" ref={mountRef} />
    </div>
  );
}
