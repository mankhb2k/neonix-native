"use client";

import { useMemo, useState } from "react";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import type { MotionProject } from "@motionvideo/motion-schema";
import { useEditorStore, nodeText } from "@/lib/store/editor-store";
import {
  matrixToCss,
  previewParitySnapshot,
  stageSizeForAspect,
  type PreviewParityNode,
} from "@/lib/runtime/preview-evaluate";

function nodeLabel(node: PreviewParityNode, project: MotionProject): string {
  if (node.type === "text") {
    const scene = project.scenes[0];
    const authored = scene?.nodes.find((candidate) => candidate.id === node.id);
    return nodeText(authored) || node.id;
  }
  if (node.type === "shape" || node.type === "path") return node.type;
  if (node.type === "group" || node.type === "bone") return "";
  return node.id;
}

function RuntimeLayer({ node, project }: { node: PreviewParityNode; project: MotionProject }) {
  if (!node.visible || node.worldOpacity <= 0) return null;
  if (node.type === "group" || node.type === "bone" || node.type === "camera") return null;
  const label = nodeLabel(node, project);
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

export function PreviewStage() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const [time, setTime] = useState(0);

  const compiled = useMemo(() => {
    if (!project) return null;
    try {
      return compileMotionProject(project);
    } catch {
      return null;
    }
  }, [project]);

  if (!project) {
    return (
      <div className="mv-preview-wrap">
        <p style={{ color: "var(--fg-muted)" }}>Chưa có dự án</p>
      </div>
    );
  }

  if (project.scenes.length === 0) {
    return (
      <div className="mv-preview-wrap">
        <p style={{ color: "var(--fg-muted)" }}>
          Thêm khung hình ở panel trái, rồi kéo vào timeline để preview.
        </p>
      </div>
    );
  }

  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  if (!scene) return null;
  const brand = project.metadata.brand;
  const accent = brand.primaryColor ?? "#3f9a62";
  const fps = project.metadata.fps ?? 30;
  const stage = stageSizeForAspect(project.metadata.aspectRatio);
  const frame = quantizeTimeToFrame(Math.min(time, scene.duration), fps);
  const snapshot = compiled
    ? previewParitySnapshot(compiled, scene.id, frame.time)
    : null;

  return (
    <div className="mv-preview-wrap">
      <div className="mv-preview-toolbar">
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          t={frame.time.toFixed(2)}s
          <input
            type="range"
            min={0}
            max={scene.duration}
            step={1 / fps}
            value={frame.time}
            onChange={(event) => setTime(Number(event.target.value))}
            data-testid="preview-time-scrubber"
          />
        </label>
        <span className="mv-pill">{scene.semantic?.role ?? scene.name ?? scene.id}</span>
        <span className="mv-pill">{compiled ? "Runtime IR" : "compile error"}</span>
      </div>
      <div
        className="mv-stage"
        data-ratio={project.metadata.aspectRatio}
        data-testid="runtime-preview-stage"
        style={{
          ["--stage-accent" as string]: accent,
          background: accent,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="mv-stage-brand">
          <div className="mv-stage-logo" />
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
              <RuntimeLayer key={node.id} node={node} project={project} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
