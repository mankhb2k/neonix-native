/**
 * Snapshot pose từ atom layer V1 — không phải JSON transform.x / scaleX.
 *
 * x/y ← transform.translate.x/y
 * opacity ← appearance.opacity (0..100)
 * scaleX/Y ← transform.scale.x/y
 */
export type LayerPoseSnapshot = {
  x: number;
  y: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
};

export function layerPoseFromAtoms(node: {
  transform: {
    translate: { x: number; y: number };
    scale: { x: number; y: number };
  };
  appearance: { opacity: number };
}): LayerPoseSnapshot {
  return {
    x: node.transform.translate.x,
    y: node.transform.translate.y,
    opacity: node.appearance.opacity,
    scaleX: node.transform.scale.x,
    scaleY: node.transform.scale.y,
  };
}
