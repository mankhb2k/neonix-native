import type {
  PaintCommand,
  PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import { matrixToCssTransform } from "@motionvideo/motion-runtime";
import React from "react";
import { AbsoluteFill, Img } from "remotion";

type TransformState = {
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number };
  alpha: number;
  visible: boolean;
  zIndex: number;
};

/**
 * Remotion painter for {@link PaintCommandBuffer} — no spring/interpolate motion.
 */
export function RemotionPaintRenderer({
  paint,
}: {
  paint: PaintCommandBuffer;
}) {
  const nodes: React.ReactNode[] = [];
  let background = "#ffffff";
  let transform: TransformState | null = null;

  for (const cmd of paint.commands) {
    if (cmd.op === "beginFrame") {
      background = cmd.background ?? "#ffffff";
      continue;
    }
    if (cmd.op === "endFrame" || cmd.op === "beginGroup" || cmd.op === "endGroup") {
      continue;
    }
    if (cmd.op === "setTransform") {
      transform = {
        matrix: cmd.matrix,
        alpha: cmd.alpha,
        visible: cmd.visible,
        zIndex: cmd.zIndex,
      };
      continue;
    }
    if (cmd.op === "unsupported") {
      throw new Error(
        `Unsupported paint command: ${cmd.message} (${cmd.nodeId ?? "unknown"})`,
      );
    }
    const view = paintCommandToView(cmd, transform);
    if (view) nodes.push(view);
  }

  return (
    <AbsoluteFill
      data-testid="remotion-paint-renderer"
      style={{ background }}
    >
      {nodes}
    </AbsoluteFill>
  );
}

function baseStyle(transform: TransformState | null): React.CSSProperties {
  if (!transform || !transform.visible || transform.alpha <= 0) {
    return { display: "none" };
  }
  return {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "0 0",
    transform: matrixToCssTransform(transform.matrix),
    opacity: transform.alpha,
    zIndex: transform.zIndex,
    pointerEvents: "none",
  };
}

function paintCommandToView(
  cmd: Exclude<
    PaintCommand,
    | { op: "beginFrame" }
    | { op: "endFrame" }
    | { op: "beginGroup"; key: string; nodeId: string }
    | { op: "endGroup"; key: string }
    | { op: "setTransform" }
    | { op: "unsupported" }
  >,
  transform: TransformState | null,
): React.ReactNode {
  const style = baseStyle(transform);
  if (style.display === "none") return null;

  switch (cmd.op) {
    case "drawText":
      return (
        <div
          key={cmd.key}
          data-paint-key={cmd.key}
          style={{
            ...style,
            color: cmd.fill,
            fontSize: cmd.fontSize,
            fontWeight: cmd.fontWeight ?? 600,
            textAlign: cmd.align ?? "left",
            whiteSpace: "pre-wrap",
            lineHeight: 1.2,
            width: cmd.width || undefined,
          }}
        >
          {cmd.text}
        </div>
      );
    case "drawShape": {
      const common = {
        ...style,
        width: cmd.width,
        height: cmd.height,
        background: cmd.fill,
      };
      if (cmd.shape === "ellipse") {
        return (
          <div
            key={cmd.key}
            data-paint-key={cmd.key}
            style={{ ...common, borderRadius: "50%" }}
          />
        );
      }
      return (
        <div
          key={cmd.key}
          data-paint-key={cmd.key}
          style={{ ...common, borderRadius: cmd.cornerRadius ?? 0 }}
        />
      );
    }
    case "drawSolid":
      return (
        <div
          key={cmd.key}
          data-paint-key={cmd.key}
          style={{
            ...style,
            width: cmd.width,
            height: cmd.height,
            background: cmd.fill,
          }}
        />
      );
    case "drawImage":
    case "drawVideo":
      if (cmd.uri) {
        return (
          <Img
            key={cmd.key}
            data-paint-key={cmd.key}
            src={cmd.uri}
            style={{
              ...style,
              width: cmd.width,
              height: cmd.height,
              objectFit: "contain",
            }}
          />
        );
      }
      return (
        <div
          key={cmd.key}
          data-paint-key={cmd.key}
          style={{
            ...style,
            width: cmd.width,
            height: cmd.height,
            background: "#1a1916",
          }}
        />
      );
    case "drawPath":
      return (
        <div
          key={cmd.key}
          data-paint-key={cmd.key}
          style={{
            ...style,
            width: 1,
            height: 1,
          }}
          aria-label="path"
        />
      );
    default:
      return null;
  }
}
