import type { RenderSnapshot, RenderSnapshotItem } from "@motionvideo/motion-runtime";
import { matrixToCssTransform } from "@motionvideo/motion-runtime";
import React from "react";
import { AbsoluteFill } from "remotion";

function SnapshotItemView({ item }: { item: RenderSnapshotItem }) {
  if (!item.visible || item.worldOpacity <= 0) return null;
  if (item.payload.kind === "group" || item.payload.kind === "unknown") return null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "0 0",
    transform: matrixToCssTransform(item.worldMatrix),
    opacity: item.worldOpacity,
    pointerEvents: "none",
  };

  switch (item.payload.kind) {
    case "text":
      return (
        <div
          data-render-item-key={item.key}
          style={{
            ...style,
            color: item.payload.fill,
            fontSize: item.payload.fontSize,
            fontWeight: item.payload.fontWeight ?? 600,
            textAlign: item.payload.align ?? "left",
            whiteSpace: "pre-wrap",
            lineHeight: 1.2,
            width: item.worldBounds.width || undefined,
          }}
        >
          {item.payload.text}
        </div>
      );
    case "shape": {
      const common = {
        ...style,
        width: item.payload.width,
        height: item.payload.height,
        background: item.payload.fill,
      };
      if (item.payload.shape === "ellipse") {
        return (
          <div
            data-render-item-key={item.key}
            style={{ ...common, borderRadius: "50%" }}
          />
        );
      }
      return (
        <div
          data-render-item-key={item.key}
          style={{
            ...common,
            borderRadius: item.payload.cornerRadius ?? 0,
          }}
        />
      );
    }
    case "solid":
      return (
        <div
          data-render-item-key={item.key}
          style={{
            ...style,
            width: item.payload.width,
            height: item.payload.height,
            background: item.payload.fill,
          }}
        />
      );
    case "image":
      return (
        <div
          data-render-item-key={item.key}
          style={{
            ...style,
            width: item.payload.width,
            height: item.payload.height,
            background: "linear-gradient(135deg, #2a2824 0%, #1a1916 100%)",
            border: "1px solid rgba(235,230,220,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8a8378",
            fontSize: 12,
          }}
        >
          image:{item.payload.assetId}
        </div>
      );
    default:
      return null;
  }
}

export type RemotionSnapshotRendererProps = {
  snapshot: RenderSnapshot;
  /** Editor overlays stay outside; this flag is reserved for future debug chrome. */
  interactive?: boolean;
};

export function RemotionSnapshotRenderer({
  snapshot,
}: RemotionSnapshotRendererProps) {
  const ordered = [...snapshot.items].sort(
    (a, b) => a.renderOrder - b.renderOrder,
  );

  return (
    <AbsoluteFill
      data-testid="remotion-snapshot-renderer"
      style={{ background: snapshot.background ?? "#0c0b0a" }}
    >
      {ordered.map((item) => (
        <SnapshotItemView key={item.key} item={item} />
      ))}
    </AbsoluteFill>
  );
}
