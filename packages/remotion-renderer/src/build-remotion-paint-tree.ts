/**
 * Pure Remotion paint tree built from PaintDisplayList (structural, no React).
 */

import {
  assertNeverPaintOp,
  decodePaintCommandBuffer,
  type PaintCommandBuffer,
  type PaintDisplayList,
  type PaintDisplayNode,
  type PaintDrawCommand,
  type PaintTransformState,
} from "@motionvideo/motion-runtime";

export type RemotionPaintTreeNode =
  | {
      kind: "layer";
      key: string;
      isolation: boolean;
      offscreen: boolean;
      mask?: {
        mode: string;
        sourceKey: string;
        sourceVisibility?: "mask-only" | "content-and-mask";
      };
      children: RemotionPaintTreeNode[];
    }
  | {
      kind: "group";
      key: string;
      layerId: string;
      transform?: PaintTransformState;
      children: RemotionPaintTreeNode[];
    }
  | {
      kind: "drawable";
      key: string;
      transform: PaintTransformState;
      draw: PaintDrawCommand;
    };

export type RemotionPaintTree = {
  version: number;
  width: number;
  height: number;
  background?: string;
  graphId: string;
  frame: number;
  time: number;
  roots: RemotionPaintTreeNode[];
  diagnostics: PaintDisplayList["diagnostics"];
};

function mapNode(node: PaintDisplayNode): RemotionPaintTreeNode {
  if (node.kind === "layer") {
    return {
      kind: "layer",
      key: node.key,
      isolation: node.isolation,
      offscreen: node.offscreen,
      ...(node.mask ? { mask: node.mask } : {}),
      children: node.children.map(mapNode),
    };
  }
  if (node.kind === "group") {
    return {
      kind: "group",
      key: node.key,
      layerId: node.layerId,
      ...(node.transform ? { transform: node.transform } : {}),
      children: node.children.map(mapNode),
    };
  }
  return {
    kind: "drawable",
    key: node.key,
    transform: node.transform,
    draw: node.draw,
  };
}

/** Decode buffer → structural Remotion paint tree. */
export function buildRemotionPaintTree(
  paint: PaintCommandBuffer,
): RemotionPaintTree {
  const list = decodePaintCommandBuffer(paint);
  return {
    version: list.version,
    width: list.width,
    height: list.height,
    background: list.background,
    graphId: list.graphId,
    frame: list.frame,
    time: list.time,
    roots: list.roots.map(mapNode),
    diagnostics: list.diagnostics,
  };
}

/** Flatten drawables in paint order (world-space draws). */
export function flattenRemotionDrawables(
  tree: RemotionPaintTree,
): Array<{ key: string; transform: PaintTransformState; draw: PaintDrawCommand }> {
  const out: Array<{
    key: string;
    transform: PaintTransformState;
    draw: PaintDrawCommand;
  }> = [];

  const walk = (layers: RemotionPaintTreeNode[]) => {
    for (const node of layers) {
      if (node.kind === "drawable") {
        out.push({
          key: node.key,
          transform: node.transform,
          draw: node.draw,
        });
        continue;
      }
      walk(node.children);
    }
  };
  walk(tree.roots);
  return out;
}

/** Convert path contours to an SVG path `d` attribute. */
export function contoursToSvgPathD(
  contours: Extract<PaintDrawCommand, { op: "drawPath" }>["contours"],
): string {
  const parts: string[] = [];
  for (const contour of contours) {
    parts.push(`M ${contour.start.x} ${contour.start.y}`);
    for (const segment of contour.segments) {
      if (segment.kind === "line") {
        parts.push(`L ${segment.to.x} ${segment.to.y}`);
      } else {
        parts.push(
          `C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.to.x} ${segment.to.y}`,
        );
      }
    }
    if (contour.closed) parts.push("Z");
  }
  return parts.join(" ");
}

/** Exhaustive helper for draw ops used by the React painter. */
export function assertRemotionDrawOp(draw: PaintDrawCommand): PaintDrawCommand {
  switch (draw.op) {
    case "drawText":
    case "drawShape":
    case "drawSolid":
    case "drawImage":
    case "drawPath":
    case "drawVideo":
    case "unsupported":
      return draw;
    default:
      return assertNeverPaintOp(draw);
  }
}
