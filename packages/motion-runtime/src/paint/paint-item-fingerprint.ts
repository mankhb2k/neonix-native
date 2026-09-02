/**
 * Paint item fingerprint — deterministic hash of per-frame paint properties.
 *
 * Each drawable in the paint buffer gets a fingerprint that painters can
 * compare frame-to-frame. When a fingerprint matches, the painter can skip
 * property updates entirely (foundation for Phase 8 dirty diff).
 *
 * The fingerprint intentionally excludes static resources (text, image URI,
 * path contours) so that only frame-varying data drives the diff.
 *
 * §4 in core-engine-tasks.md, Task 4.2
 */

import type { PaintDrawCommand } from "./paint-command";

/**
 * Compute a deterministic fingerprint for a paint draw command.
 * Only includes per-frame properties that can change across frames:
 *   - transform (setTransform)
 *   - alpha
 *   - width/height
 *   - fill
 *   - blend mode
 *   - order/render order
 *
 * Static resources (text content, image URI, path data, shape type) are
 * intentionally excluded — they change only on structural edit, not frame.
 */
export function computePaintItemFingerprint(
  drawCmd: PaintDrawCommand,
  transform: {
    matrix4: readonly number[];
    alpha: number;
    visible: boolean;
    order: number;
    blendMode?: string;
  },
): string {
  const parts: string[] = [];

  // Transform
  parts.push(`m4:${transform.matrix4.map(round3).join(",")}`);
  parts.push(`a:${round3(transform.alpha)}`);
  parts.push(`v:${transform.visible ? 1 : 0}`);
  parts.push(`o:${transform.order}`);
  if (transform.blendMode) parts.push(`bm:${transform.blendMode}`);

  // Draw-specific properties
  switch (drawCmd.op) {
    case "drawText":
      if (drawCmd.glyphs) {
        parts.push(`glyphs:${drawCmd.glyphs.map((glyph) => `${glyph.fontIntegrity ?? ""}:${glyph.fontAssetId ?? ""}:${glyph.glyphId}:${round3(glyph.x)}:${round3(glyph.y)}:${glyph.mesh?.vertices.length ?? 0}:${glyph.strokeMesh?.vertices.length ?? 0}:${glyph.renderMode ?? "vector"}:${glyph.variationKey ?? ""}:${glyph.fill ?? ""}`).join(";")}`);
      }
      if (drawCmd.decorations) parts.push(`decorations:${drawCmd.decorations.map((item) => `${round3(item.x)},${round3(item.y)},${round3(item.width)},${round3(item.height)},${item.fill},${round3(item.opacity ?? 1)}`).join(";")}`);
      if (drawCmd.paintOrder) parts.push(`po:${drawCmd.paintOrder.join(",")}`);
      break;
    case "drawShape":
    case "drawSolid":
    case "drawImage":
    case "drawVideo": {
      const d = drawCmd as { width: number; height: number };
      parts.push(`wh:${round3(d.width)},${round3(d.height)}`);
      break;
    }
    case "drawPath": {
      break; // Path width/height not tracked separately
    }
    default:
      break;
  }

  // Fill (dynamic)
  if ("fill" in drawCmd && typeof drawCmd.fill === "string") {
    parts.push(`f:${drawCmd.fill}`);
  }
  if (drawCmd.op === "drawShape") {
    if (drawCmd.fillOpacity != null) parts.push(`fo:${round3(drawCmd.fillOpacity)}`);
    if (drawCmd.stroke) parts.push(`s:${drawCmd.stroke}`);
    if (drawCmd.strokeWidth != null) parts.push(`sw:${round3(drawCmd.strokeWidth)}`);
    if (drawCmd.strokeOpacity != null) parts.push(`so:${round3(drawCmd.strokeOpacity)}`);
    if (drawCmd.paintOrder) parts.push(`po:${drawCmd.paintOrder.join(",")}`);
  }
  if (drawCmd.op === "drawPath") {
    if (drawCmd.stroke) parts.push(`s:${drawCmd.stroke}`);
    if (drawCmd.strokeWidth != null) parts.push(`sw:${round3(drawCmd.strokeWidth)}`);
    if (drawCmd.strokeOpacity != null) parts.push(`so:${round3(drawCmd.strokeOpacity)}`);
    if (drawCmd.strokeMesh) parts.push(`sm:${drawCmd.strokeMesh.vertices.length}:${drawCmd.strokeMesh.indices.length}`);
    if (drawCmd.strokeJoin) parts.push(`sj:${drawCmd.strokeJoin}`);
    if (drawCmd.strokeCap) parts.push(`sc:${drawCmd.strokeCap}`);
    if (drawCmd.strokeDash) parts.push(`sd:${drawCmd.strokeDash.array.map(round3).join(",")}:${round3(drawCmd.strokeDash.offset)}`);
    if (drawCmd.paintOrder) parts.push(`po:${drawCmd.paintOrder.join(",")}`);
  }

  if (drawCmd.op === "drawImage" || drawCmd.op === "drawVideo") {
    if (drawCmd.op === "drawVideo" && drawCmd.fit) parts.push(`fit:${drawCmd.fit}`);
    if (drawCmd.op === "drawImage") {
      parts.push(`xy:${round3(drawCmd.x)},${round3(drawCmd.y)}`);
      if (drawCmd.preserveAspectRatio) parts.push(`par:${JSON.stringify(drawCmd.preserveAspectRatio)}`);
      if (drawCmd.imageRendering) parts.push(`ir:${drawCmd.imageRendering}`);
    }
  }

  if (drawCmd.op === "drawVideo") {
    parts.push(`mt:${round3(drawCmd.mediaTime)}`);
    parts.push(`mv:${drawCmd.mediaVisible === false ? 0 : 1}`);
  }

  return parts.join("|");
}

/**
 * Fingerprint for a structural (static) paint resource.
 * Used to determine when a resource needs re-upload (Phase 8).
 */
export function computePaintResourceFingerprint(
  resource: Record<string, unknown>,
): string {
  // Simple: JSON.stringify of sorted keys
  const sorted = Object.keys(resource)
    .sort()
    .reduce(
      (acc, k) => {
        acc[k] = resource[k];
        return acc;
      },
      {} as Record<string, unknown>,
    );
  return JSON.stringify(sorted);
}

function round3(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
