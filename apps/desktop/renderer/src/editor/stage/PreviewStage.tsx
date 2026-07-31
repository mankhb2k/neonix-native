import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import type { MotionProject, MotionScene } from "@motionvideo/motion-schema";
import { nodeText, type TimelineClip, type TimelineLane } from "@motionvideo/editor-core";
import { usePlaybackClock } from "../playback/playback-clock-store";
import { playbackFrameIndex } from "../playback/time-frame";
import {
  buildVisualLaneIndex,
  composeAtTime,
  resolveScene,
} from "../preview/compose-layers";
import {
  matrixToCss,
  previewParitySnapshot,
  stageSizeForAspect,
  type PreviewParityNode,
} from "../preview/preview-evaluate";
import "./stage-layout.css";

function nodeLabel(node: PreviewParityNode, scene: MotionScene | null): string {
  if (node.type === "text") {
    const authored = scene?.nodes.find((candidate) => candidate.id === node.id);
    return nodeText(authored) || node.id;
  }
  if (node.type === "shape" || node.type === "path") return node.type;
  if (node.type === "group" || node.type === "bone") return "";
  return node.id;
}

function RuntimeLayer({
  node,
  scene,
}: {
  node: PreviewParityNode;
  scene: MotionScene | null;
}) {
  if (!node.visible || node.worldOpacity <= 0) return null;
  if (node.type === "group" || node.type === "bone" || node.type === "camera") {
    return null;
  }
  const label = nodeLabel(node, scene);
  const width = Math.max(8, node.transform.width || node.worldBounds.width);
  const height = Math.max(8, node.transform.height || node.worldBounds.height);
  return (
    <div
      data-testid={`runtime-node-${node.id}`}
      data-node-type={node.type}
      className="preview-layer-node"
      style={{
        width,
        height,
        opacity: node.worldOpacity,
        transform: matrixToCss(node.worldMatrix),
        justifyContent: node.type === "text" ? "flex-start" : "center",
        fontSize: node.type === "text" ? 42 : 18,
        background: node.type === "text" ? "transparent" : "rgba(255,255,255,0.12)",
        border: node.type === "text" ? "none" : "1px solid rgba(255,255,255,0.35)",
        padding: node.type === "text" ? "0 12px" : 0,
      }}
    >
      {label}
    </div>
  );
}

type PreviewRuntimeCanvasProps = {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  frameIndex: number;
  fps: number;
  backgroundColor: string;
  scale: number;
};

const PreviewRuntimeCanvas = memo(function PreviewRuntimeCanvas({
  project,
  timelineClips,
  timelineLanes,
  frameIndex,
  fps,
  backgroundColor,
  scale,
}: PreviewRuntimeCanvasProps) {
  const previewTime = frameIndex / Math.max(1, fps);
  const compiled = useMemo(() => {
    try {
      return compileMotionProject(project);
    } catch {
      return null;
    }
  }, [project]);

  const scenesById = useMemo(
    () => new Map(project.scenes.map((scene) => [scene.id, scene])),
    [project.scenes],
  );

  const visualIndex = useMemo(
    () => buildVisualLaneIndex(timelineClips, timelineLanes),
    [timelineClips, timelineLanes],
  );
  const composed = useMemo(
    () => composeAtTime(visualIndex, previewTime),
    [visualIndex, previewTime],
  );

  const stage = stageSizeForAspect(project.metadata.aspectRatio);

  return (
    <div
      data-testid="runtime-preview-canvas"
      data-compose-layers={composed.length}
      className="preview-canvas"
      style={{
        width: stage.width,
        height: stage.height,
        transform: `scale(${scale})`,
        background: backgroundColor,
      }}
    >
      {composed.map((layer) => {
        const scene = resolveScene(scenesById, project.scenes, layer.sceneId);
        if (!scene || !compiled) return null;
        const frame = quantizeTimeToFrame(layer.localTime, fps);
        const snapshot = previewParitySnapshot(compiled, scene.id, frame.time);
        return (
          <div
            key={`${layer.role}-${layer.clipId}`}
            data-testid={`preview-layer-${layer.role}`}
            data-scene-id={layer.sceneId}
            className="preview-compose-layer"
            style={{
              zIndex: layer.role === "base" ? 0 : 10 + layer.zOrder,
            }}
          >
            {snapshot?.nodes.map((node) => (
              <RuntimeLayer
                key={`${layer.clipId}-${node.id}`}
                node={node}
                scene={scene}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
});

function PreviewClockBridge({
  project,
  timelineClips,
  timelineLanes,
  backgroundColor,
  scale,
}: {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  backgroundColor: string;
  scale: number;
}) {
  const fps = Math.max(1, Math.round(project.metadata.fps ?? 30));
  // Frame index still drives compose; canvas is memoized to limit DOM churn.
  // Full imperative compose (no React frame subscription) remains a follow-up.
  const frameIndex = usePlaybackClock((state) =>
    playbackFrameIndex(state.currentTime, fps),
  );
  return (
    <PreviewRuntimeCanvas
      project={project}
      timelineClips={timelineClips}
      timelineLanes={timelineLanes}
      frameIndex={frameIndex}
      fps={fps}
      backgroundColor={backgroundColor}
      scale={scale}
    />
  );
}

type Props = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
};

export function PreviewStage({ project, clips, lanes }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || !project) return undefined;
    const stage = stageSizeForAspect(project.metadata.aspectRatio);
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
  }, [project]);

  if (!project) {
    return (
      <div className="preview-stage preview-stage--empty">
        <p>No project loaded</p>
      </div>
    );
  }

  if (project.scenes.length === 0) {
    return (
      <div className="preview-stage preview-stage--empty">
        <p>Add a scene to the project to preview (blank projects have no scenes yet).</p>
      </div>
    );
  }

  const brand = project.metadata.brand;
  const accent = brand.primaryColor ?? "#3f9a62";

  return (
    <div ref={hostRef} className="preview-stage" data-testid="runtime-preview-stage">
      <div
        className="preview-stage__frame"
        data-ratio={project.metadata.aspectRatio}
        style={{ background: accent }}
      >
        <div className="preview-stage__chrome">
          <div className="preview-stage__swatch" style={{ background: accent }} />
          <span>{brand.name}</span>
        </div>
        <div className="preview-stage__canvas-host">
          <PreviewClockBridge
            project={project}
            timelineClips={clips}
            timelineLanes={lanes}
            backgroundColor={accent}
            scale={scale}
          />
        </div>
      </div>
    </div>
  );
}
