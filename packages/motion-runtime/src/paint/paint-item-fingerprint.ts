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
 *   - effects
 *   - blend mode
 *   - zIndex/render order
 *
 * Static resources (text content, image URI, path data, shape type) are
 * intentionally excluded — they change only on structural edit, not frame.
 */
export function computePaintItemFingerprint(
  drawCmd: PaintDrawCommand,
  transform: {
    matrix: {
      a: number;
      b: number;
      c: number;
      d: number;
      e: number;
      f: number;
    };
    alpha: number;
    visible: boolean;
    zIndex: number;
    blendMode?: string;
  },
): string {
  const parts: string[] = [];

  // Transform
  const m = transform.matrix;
  parts.push(
    `m:${round3(m.a)},${round3(m.b)},${round3(m.c)},${round3(m.d)},${round3(m.e)},${round3(m.f)}`,
  );
  parts.push(`a:${round3(transform.alpha)}`);
  parts.push(`v:${transform.visible ? 1 : 0}`);
  parts.push(`z:${transform.zIndex}`);
  if (transform.blendMode) parts.push(`bm:${transform.blendMode}`);

  // Draw-specific properties
  switch (drawCmd.op) {
    case "drawText":
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

  // Effects
  if ("effects" in drawCmd && drawCmd.effects?.length) {
    parts.push(
      `fx:${drawCmd.effects
        .map((e: { id: string; type: string }) => `${e.type}(${e.id})`)
        .sort()
        .join(",")}`,
    );
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
