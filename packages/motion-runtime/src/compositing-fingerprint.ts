/**
 * Compositing helpers shared by painter parity tests.
 */

import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { decodePaintCommandBuffer } from "@motionvideo/motion-runtime";

export type CompositingFingerprint = {
  layers: number;
  groups: number;
  drawables: number;
  masks: number;
  effectDrawables: number;
};

export function compositingFingerprint(
  buffer: PaintCommandBuffer,
): CompositingFingerprint {
  const list = decodePaintCommandBuffer(buffer);
  let layers = 0;
  let groups = 0;
  let drawables = 0;
  let masks = 0;
  let effectDrawables = 0;

  const walk = (items: typeof list.roots) => {
    for (const node of items) {
      if (node.kind === "layer") {
        layers += 1;
        if (node.mask) masks += 1;
        walk(node.children);
      } else if (node.kind === "group") {
        groups += 1;
        walk(node.children);
      } else {
        drawables += 1;
        if (node.effects?.length || ("effects" in node.draw && node.draw.effects?.length)) {
          effectDrawables += 1;
        }
      }
    }
  };
  walk(list.roots);
  return { layers, groups, drawables, masks, effectDrawables };
}
