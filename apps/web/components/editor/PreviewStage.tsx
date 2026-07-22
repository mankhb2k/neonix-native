"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { getBlockByPreset, resolvePresetId } from "@motionvideo/template-library";
import type { Layer } from "@motionvideo/motion-schema";

function presetPreviewClass(preset: string | undefined): string {
  if (!preset) return "mv-stage-layer-static";
  const block = getBlockByPreset(resolvePresetId(preset));
  if (block?.previewClass) return block.previewClass;
  // Fallback for presets without a lab class
  const id = resolvePresetId(preset);
  return `mv-block-text-${id}`;
}

function LayerPreview({
  layer,
  brandName,
  playId,
}: {
  layer: Layer;
  brandName: string;
  playId: number;
}) {
  const anim = layer.animations[0];
  const duration = anim?.duration ?? 0.6;
  const delay = anim?.delay ?? 0;
  const className = presetPreviewClass(anim?.preset);
  const style: CSSProperties = {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    transform: `translate(${layer.x}px, ${layer.y}px)`,
  };

  if (layer.type === "logo") {
    return (
      <div
        key={`${layer.id}-${playId}`}
        className={`mv-stage-layer mv-stage-layer-logo ${className}`}
        style={style}
        aria-label="Logo"
      >
        <span className="mv-stage-logo-mark">
          {(brandName || "MV").slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <p
      key={`${layer.id}-${playId}`}
      className={`mv-stage-layer mv-stage-layer-text ${className}`}
      style={style}
    >
      {layer.content || "…"}
    </p>
  );
}

export function PreviewStage() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const [playId, setPlayId] = useState(0);

  useEffect(() => {
    setPlayId((n) => n + 1);
  }, [selectedSceneId]);

  if (!project) {
    return (
      <div className="mv-preview-wrap">
        <p style={{ color: "var(--fg-muted)" }}>Chưa có dự án</p>
      </div>
    );
  }

  const scene =
    project.scenes.find((s) => s.id === selectedSceneId) ?? project.scenes[0];
  const accent = project.brand.primaryColor ?? "#3f9a62";

  return (
    <div className="mv-preview-wrap">
      <div className="mv-preview-toolbar">
        <button
          type="button"
          className="mv-btn mv-btn-ghost mv-btn-sm"
          onClick={() => setPlayId((n) => n + 1)}
        >
          ▶ Phát lại
        </button>
        <span className="mv-pill">{scene.role ?? scene.id}</span>
      </div>
      <div
        className="mv-stage"
        data-ratio={project.aspectRatio}
        style={
          {
            ["--stage-accent" as string]: accent,
            background: accent,
          } as CSSProperties
        }
        key={`${scene.id}-${playId}`}
      >
        <div className="mv-stage-brand">
          <div className="mv-stage-logo" />
          <span>{project.brand.name}</span>
        </div>
        <div className="mv-stage-layers">
          {scene.layers.map((layer) => (
            <LayerPreview
              key={`${layer.id}-${playId}`}
              layer={layer}
              brandName={project.brand.name}
              playId={playId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
