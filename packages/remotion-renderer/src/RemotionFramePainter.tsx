/**
 * RemotionFramePainter — paints from PaintDisplayList / RemotionPaintTree.
 * Paths → SVG; video → OffthreadVideo with evaluated mediaTime.
 */

import {
  matrixToCssTransform,
  resolveMediaTiming,
  type PaintDrawCommand,
  type PaintTransformState,
} from "@motionvideo/motion-runtime";
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import {
  assertRemotionDrawOp,
  buildRemotionPaintTree,
  contoursToSvgPathD,
  flattenRemotionDrawables,
  type RemotionPaintTree,
} from "./build-remotion-paint-tree";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";

function baseStyle(transform: PaintTransformState): React.CSSProperties {
  if (!transform.visible || transform.alpha <= 0) {
    return { display: "none" };
  }
  const blend =
    transform.blendMode && transform.blendMode !== "normal"
      ? ({ mixBlendMode: transform.blendMode } as React.CSSProperties)
      : {};
  return {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "0 0",
    transform: matrixToCssTransform(transform.matrix),
    opacity: transform.alpha,
    zIndex: transform.zIndex,
    pointerEvents: "none",
    ...blend,
  };
}

function cssFill(
  fill: string | undefined,
  fillPaint:
    | {
        type: "solid" | "linear-gradient" | "radial-gradient";
        color?: string;
        angle?: number;
        stops?: Array<{ offset: number; color: string }>;
      }
    | undefined,
): string {
  if (fillPaint?.type === "linear-gradient" && fillPaint.stops?.length) {
    const angle = fillPaint.angle ?? 0;
    const stops = fillPaint.stops
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(", ");
    return `linear-gradient(${angle}deg, ${stops})`;
  }
  if (fillPaint?.type === "radial-gradient" && fillPaint.stops?.length) {
    const stops = fillPaint.stops
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(", ");
    return `radial-gradient(circle, ${stops})`;
  }
  return fill ?? fillPaint?.color ?? "#ffffff";
}

function drawableToView(
  key: string,
  transform: PaintTransformState,
  draw: PaintDrawCommand,
  fps: number,
): React.ReactNode {
  assertRemotionDrawOp(draw);
  const style = baseStyle(transform);
  if (style.display === "none") return null;

  switch (draw.op) {
    case "unsupported":
      throw new Error(
        `Unsupported paint command: ${draw.message} (${draw.layerId ?? "unknown"})`,
      );
    case "drawText":
      return (
        <div
          key={key}
          data-paint-key={key}
          style={{
            ...style,
            color: draw.fill,
            fontSize: draw.fontSize,
            fontWeight: draw.fontWeight ?? 600,
            textAlign: draw.align ?? "left",
            whiteSpace: draw.wrap === "none" ? "pre" : "pre-wrap",
            lineHeight: draw.lineHeight ? `${draw.lineHeight}px` : 1.2,
            letterSpacing: draw.letterSpacing != null ? `${draw.letterSpacing}px` : undefined,
            width: draw.width || undefined,
            overflow: draw.overflow === "clip" || draw.overflow === "ellipsis" ? "hidden" : undefined,
            textOverflow: draw.overflow === "ellipsis" ? "ellipsis" : undefined,
            background: draw.fillPaint
              ? cssFill(draw.fill, draw.fillPaint)
              : undefined,
          }}
        >
          {draw.runs && draw.runs.length > 0
            ? draw.runs.map((run) => (
                <span
                  key={run.id}
                  data-source-ref={
                    run.sourceRef
                      ? `${run.sourceRef.kind}:${run.sourceRef.layerId}:${run.sourceRef.runId}`
                      : undefined
                  }
                  style={{
                    color: run.fill,
                    fontWeight: run.fontWeight,
                    fontStyle: run.fontStyle,
                    letterSpacing: run.letterSpacing,
                    background: run.highlight?.fill,
                    padding: run.highlight
                      ? `${run.highlight.paddingY ?? 0}px ${run.highlight.paddingX ?? 0}px`
                      : undefined,
                    borderRadius: run.highlight?.radius,
                  }}
                >
                  {run.text}
                </span>
              ))
            : draw.text}
        </div>
      );
    case "drawShape": {
      const background = cssFill(draw.fill, draw.fillPaint);
      const common = {
        ...style,
        width: draw.width,
        height: draw.height,
        background,
      };
      if (draw.shape === "ellipse") {
        return (
          <div
            key={key}
            data-paint-key={key}
            style={{ ...common, borderRadius: "50%" }}
          />
        );
      }
      if (draw.shape === "polygon") {
        return (
          <div
            key={key}
            data-paint-key={key}
            style={{
              ...common,
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
            }}
          />
        );
      }
      return (
        <div
          key={key}
          data-paint-key={key}
          style={{ ...common, borderRadius: draw.cornerRadius ?? 0 }}
        />
      );
    }
    case "drawSolid":
      return (
        <div
          key={key}
          data-paint-key={key}
          style={{
            ...style,
            width: draw.width,
            height: draw.height,
            background: draw.fill,
          }}
        />
      );
    case "drawImage":
      if (draw.uri) {
        return (
          <Img
            key={key}
            data-paint-key={key}
            src={draw.uri}
            style={{
              ...style,
              width: draw.width,
              height: draw.height,
              objectFit: "contain",
            }}
          />
        );
      }
      return (
        <div
          key={key}
          data-paint-key={key}
          style={{
            ...style,
            width: draw.width,
            height: draw.height,
            background: "#1a1916",
          }}
        />
      );
    case "drawVideo": {
      if (!draw.uri) {
        return (
          <div
            key={key}
            data-paint-key={key}
            style={{
              ...style,
              width: draw.width,
              height: draw.height,
              background: "#1a1916",
            }}
          />
        );
      }
      const timing = resolveMediaTiming({
        mediaTimeSeconds: draw.mediaTime,
        fps,
      });
      return (
        <OffthreadVideo
          key={key}
          data-paint-key={key}
          src={draw.uri}
          muted
          trimBefore={timing.sourceFrame}
          style={{
            ...style,
            width: draw.width,
            height: draw.height,
            objectFit: "contain",
          }}
        />
      );
    }
    case "drawPath": {
      const d = contoursToSvgPathD(draw.contours);
      const fill = cssFill(draw.fill, draw.fillPaint);
      return (
        <svg
          key={key}
          data-paint-key={key}
          style={{
            ...style,
            overflow: "visible",
            width: 1,
            height: 1,
          }}
          aria-label="path"
        >
          <path
            d={d}
            fill={draw.fill || draw.fillPaint ? fill : "none"}
            fillOpacity={draw.fillOpacity ?? 1}
            fillRule={draw.fillRule}
            stroke={draw.stroke ?? "none"}
            strokeWidth={draw.strokeWidth ?? 0}
            strokeOpacity={draw.strokeOpacity ?? 1}
          />
        </svg>
      );
    }
    default:
      return null;
  }
}

export type RemotionFramePainterProps = {
  paint: PaintCommandBuffer;
  /** Used to map mediaTime → trimBefore frames for OffthreadVideo. */
  fps?: number;
};

/**
 * Remotion frame painter — decode → tree → React views.
 * Throws on unsupported ops (export fail-closed).
 */
export function RemotionFramePainter({
  paint,
  fps = 30,
}: RemotionFramePainterProps) {
  const tree = buildRemotionPaintTree(paint);
  return <RemotionFramePainterFromTree tree={tree} fps={fps} />;
}

export function RemotionFramePainterFromTree({
  tree,
  fps = 30,
}: {
  tree: RemotionPaintTree;
  fps?: number;
}) {
  const drawables = flattenRemotionDrawables(tree);
  const layers = drawables.map((item) =>
    drawableToView(item.key, item.transform, item.draw, fps),
  );

  return (
    <AbsoluteFill
      data-testid="remotion-frame-painter"
      style={{ background: tree.background ?? "#ffffff" }}
    >
      {layers}
    </AbsoluteFill>
  );
}

/** @deprecated Prefer {@link RemotionFramePainter}. */
export function RemotionPaintRenderer({
  paint,
  fps,
}: RemotionFramePainterProps) {
  return <RemotionFramePainter paint={paint} fps={fps} />;
}
