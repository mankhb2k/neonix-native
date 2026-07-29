"use client";

import { memo, useMemo } from "react";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import type { MotionProject, MotionScene } from "@motionvideo/motion-schema";
import { useEditorStore, nodeText } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";
import {
  composeVisualLayersAtTime,
  resolveScene,
} from "@/lib/editor/preview/compose-layers";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import {
  matrixToCss,
  previewParitySnapshot,
  stageSizeForAspect,
  type PreviewParityNode,
} from "@/lib/runtime/preview-evaluate";

function nodeLabel(node: PreviewParityNode, scene: MotionScene | null): string {
  if (node.type === "text") {
    // Dùng scene đang render — không hard-code scenes[0] (PERF-04).
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
  if (node.type === "group" || node.type === "bone" || node.type === "camera") return null;
  const label = nodeLabel(node, scene);
  const width = Math.max(8, node.transform.width || node.worldBounds.width);
  const height = Math.max(8, node.transform.height || node.worldBounds.height);
  return (
    <div
      data-testid={`runtime-node-${node.id}`}
      data-node-type={node.type}
      data-world-x={node.worldOrigin.x.toFixed(4)}
      data-world-y={node.worldOrigin.y.toFixed(4)}
      data-world-opacity={node.worldOpacity.toFixed(4)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        opacity: node.worldOpacity,
        transform: matrixToCss(node.worldMatrix),
        transformOrigin: "0 0",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: node.type === "text" ? "flex-start" : "center",
        color: "#f4f7fb",
        fontSize: node.type === "text" ? 42 : 18,
        fontWeight: 600,
        background: node.type === "text" ? "transparent" : "rgba(255,255,255,0.12)",
        border: node.type === "text" ? "none" : "1px solid rgba(255,255,255,0.35)",
        boxSizing: "border-box",
        padding: node.type === "text" ? "0 12px" : 0,
        whiteSpace: "pre-wrap",
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
};

/** Time-sensitive canvas — re-renders only when frameIndex / project / clips change. */
const PreviewRuntimeCanvas = memo(function PreviewRuntimeCanvas({
  project,
  timelineClips,
  timelineLanes,
  frameIndex,
  fps,
  backgroundColor,
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

  // Compose memo theo clips/lanes — lookup theo time mỗi frame (PERF-04).
  const composed = useMemo(
    () => composeVisualLayersAtTime(timelineClips, timelineLanes, previewTime),
    [timelineClips, timelineLanes, previewTime],
  );

  const stage = stageSizeForAspect(project.metadata.aspectRatio);

  return (
    <div
      data-testid="runtime-preview-canvas"
      data-compose-layers={composed.length}
      style={{
        position: "relative",
        width: stage.width,
        height: stage.height,
        transform: "scale(0.25)",
        transformOrigin: "center center",
        // Base gap / trống → hiện project background (brand).
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
            data-z-order={layer.zOrder}
            style={{
              position: "absolute",
              inset: 0,
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

/** Subscribe clock ở leaf — shell PreviewStage không re-render theo tick. */
function PreviewClockBridge({
  project,
  timelineClips,
  timelineLanes,
  backgroundColor,
}: {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  backgroundColor: string;
}) {
  const fps = Math.max(1, Math.round(project.metadata.fps ?? 30));
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
    />
  );
}

export function PreviewStage() {
  const project = useEditorStore((state) => state.project);
  const timelineClips = useEditorStore((state) => state.timelineClips);
  const timelineLanes = useEditorStore((state) => state.timelineLanes);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-transparent min-h-0 overflow-hidden text-[var(--fg-muted)]">
        <p>Chưa có dự án</p>
      </div>
    );
  }

  if (project.scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-transparent min-h-0 overflow-hidden text-[var(--fg-muted)]">
        <p>
          Thêm khung hình ở panel trái, rồi kéo vào timeline để preview.
        </p>
      </div>
    );
  }

  const brand = project.metadata.brand;
  const accent = brand.primaryColor ?? "#3f9a62";

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-transparent min-h-0 overflow-hidden">
      <div
        className="relative bg-[var(--stage-bg)] rounded-xl overflow-hidden shadow-2xl flex flex-col justify-center items-center p-6 gap-4 text-center select-none"
        data-ratio={project.metadata.aspectRatio}
        data-testid="runtime-preview-stage"
        style={{
          ["--stage-accent" as string]: accent,
          background: accent,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-[11px] text-[var(--fg-muted)]">
          <div className="w-7 h-7 rounded-lg bg-[var(--stage-accent,var(--accent))]" />
          <span>{brand.name}</span>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PreviewClockBridge
            project={project}
            timelineClips={timelineClips}
            timelineLanes={timelineLanes}
            backgroundColor={accent}
          />
        </div>
      </div>
    </div>
  );
}
