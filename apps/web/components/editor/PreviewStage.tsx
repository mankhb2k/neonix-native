"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useEditorStore, nodeText } from "@/lib/store/editor-store";
import { getBlockByPreset } from "@motionvideo/template-library";
import type { MotionClip, MotionNode } from "@motionvideo/motion-schema";

function previewClass(presetId: string | undefined): string {
  if (!presetId) return "mv-stage-layer-static";
  return getBlockByPreset(presetId)?.previewClass ?? `mv-block-text-${presetId}`;
}

function NodePreview({ node, clip, brandName, playId }: {
  node: MotionNode;
  clip?: MotionClip;
  brandName: string;
  playId: number;
}) {
  if (node.type !== "text" && node.type !== "logo") return null;
  const presetId = clip?.source.kind === "preset" ? clip.source.presetId : undefined;
  const at = clip?.schedule.kind === "absolute" ? clip.schedule.at : 0;
  const style: CSSProperties = {
    animationDuration: `${clip?.duration ?? 0.6}s`,
    animationDelay: `${at}s`,
    transform: `translate(${(node.transform.x - 540) * 0.25}px, ${(node.transform.y - 960) * 0.25}px)`,
    opacity: node.transform.visible ? node.transform.opacity : 0,
  };
  if (node.type === "logo") {
    return <div key={`${node.id}-${playId}`} className={`mv-stage-layer mv-stage-layer-logo ${previewClass(presetId)}`} style={style}>
      <span className="mv-stage-logo-mark">{brandName.slice(0, 2).toUpperCase()}</span>
    </div>;
  }
  return <p key={`${node.id}-${playId}`} className={`mv-stage-layer mv-stage-layer-text ${previewClass(presetId)}`} style={style}>
    {nodeText(node) || "…"}
  </p>;
}

export function PreviewStage() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const [playId, setPlayId] = useState(0);
  useEffect(() => setPlayId((value) => value + 1), [selectedSceneId]);
  if (!project) return <div className="mv-preview-wrap"><p style={{ color: "var(--fg-muted)" }}>Chưa có dự án</p></div>;
  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  if (!scene) return null;
  const brand = project.metadata.brand;
  const accent = brand.primaryColor ?? "#3f9a62";
  return <div className="mv-preview-wrap">
    <div className="mv-preview-toolbar">
      <button type="button" className="mv-btn mv-btn-ghost mv-btn-sm" onClick={() => setPlayId((value) => value + 1)}>▶ Phát lại</button>
      <span className="mv-pill">{scene.semantic?.role ?? scene.name ?? scene.id}</span>
    </div>
    <div className="mv-stage" data-ratio={project.metadata.aspectRatio} style={{ ["--stage-accent" as string]: accent, background: accent }} key={`${scene.id}-${playId}`}>
      <div className="mv-stage-brand"><div className="mv-stage-logo" /><span>{brand.name}</span></div>
      <div className="mv-stage-layers">
        {scene.nodes.map((node) => <NodePreview key={`${node.id}-${playId}`} node={node} clip={scene.clips.find((clip) => clip.targetId === node.id)} brandName={brand.name} playId={playId} />)}
      </div>
    </div>
  </div>;
}
