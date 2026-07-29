"use client";

import { memo, useMemo } from "react";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import type { MotionProject, MotionScene } from "@motionvideo/motion-schema";
import { useEditorStore, nodeText } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";
import type { TimelineClip } from "@/lib/editor/timeline-clips";
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

function findMainClipAtTime(
  sortedMainClips: TimelineClip[],
  time: number,
): TimelineClip | undefined {
  // Binary search trên clips đã sort theo startTime.
  let lo = 0;
  let hi = sortedMainClips.length - 1;
  let candidate: TimelineClip | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const clip = sortedMainClips[mid];
    if (time < clip.startTime) {
      hi = mid - 1;
    } else {
      candidate = clip;
      lo = mid + 1;
    }
  }
  if (!candidate) return undefined;
  if (time < candidate.startTime + candidate.duration) return candidate;
  return sortedMainClips[sortedMainClips.length - 1];
}

function sceneAtGlobalTime(
  scenes: MotionScene[],
  sortedMainClips: TimelineClip[],
  scenesById: Map<string, MotionScene>,
  time: number,
): { scene: MotionScene; localTime: number; start: number } | null {
  const clip = findMainClipAtTime(sortedMainClips, time);
  if (!clip) return null;
  const scene = scenesById.get(clip.sceneId) ?? scenes.find((s) => s.id === clip.sceneId);
  if (!scene) return null;
  return {
    scene,
    localTime: Math.min(Math.max(0, time - clip.startTime), clip.duration),
    start: clip.startTime,
  };
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
  mainLaneId: string | undefined;
  frameIndex: number;
  fps: number;
};

/** Time-sensitive canvas — re-renders only when frameIndex / project / clips change. */
const PreviewRuntimeCanvas = memo(function PreviewRuntimeCanvas({
  project,
  timelineClips,
  mainLaneId,
  frameIndex,
  fps,
}: PreviewRuntimeCanvasProps) {
  const previewTime = frameIndex / Math.max(1, fps);
  const compiled = useMemo(() => {
    try {
      return compileMotionProject(project);
    } catch {
      return null;
    }
  }, [project]);

  // Memo index — không filter/sort lại mỗi frame (PERF-04).
  const sortedMainClips = useMemo(
    () =>
      timelineClips
        .filter((clip) => clip.laneId === mainLaneId)
        .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id)),
    [timelineClips, mainLaneId],
  );
  const scenesById = useMemo(
    () => new Map(project.scenes.map((scene) => [scene.id, scene])),
    [project.scenes],
  );

  const at = sceneAtGlobalTime(
    project.scenes,
    sortedMainClips,
    scenesById,
    previewTime,
  );
  if (!at) return null;
  const { scene, localTime } = at;
  const stage = stageSizeForAspect(project.metadata.aspectRatio);
  const frame = quantizeTimeToFrame(localTime, fps);
  const snapshot = compiled
    ? previewParitySnapshot(compiled, scene.id, frame.time)
    : null;

  return (
    <div
      data-testid="runtime-preview-canvas"
      style={{
        position: "relative",
        width: stage.width,
        height: stage.height,
        transform: "scale(0.25)",
        transformOrigin: "center center",
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {snapshot?.nodes.map((node) => (
        <RuntimeLayer key={node.id} node={node} scene={scene} />
      ))}
    </div>
  );
});

/** Subscribe clock ở leaf — shell PreviewStage không re-render theo tick. */
function PreviewClockBridge({
  project,
  timelineClips,
  mainLaneId,
}: {
  project: MotionProject;
  timelineClips: TimelineClip[];
  mainLaneId: string | undefined;
}) {
  const fps = Math.max(1, Math.round(project.metadata.fps ?? 30));
  const frameIndex = usePlaybackClock((state) =>
    playbackFrameIndex(state.currentTime, fps),
  );
  return (
    <PreviewRuntimeCanvas
      project={project}
      timelineClips={timelineClips}
      mainLaneId={mainLaneId}
      frameIndex={frameIndex}
      fps={fps}
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

  const mainLaneId = timelineLanes.find((lane) => lane.kind === "main")?.id;
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
            mainLaneId={mainLaneId}
          />
        </div>
      </div>
    </div>
  );
}
