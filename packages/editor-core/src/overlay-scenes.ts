/**
 * LEGACY / COMPAT surface.
 *
 * Overlay clips above the "main timeline track" (UI + persistence side-car).
 * This vocabulary predates the lane/layer model: `layerIndex` means overlay
 * lane order and "main timeline track" means the base lane. Kept only for
 * reading old persisted documents; new code should use lanes + clips.
 *
 * @deprecated Use the lane/clip model instead of this legacy side-car shape.
 */

/** @deprecated Use `TimelineClip` + lanes. */
export type OverlaySceneItem = {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  /** Legacy: 0 = just above the base lane. */
  layerIndex: number;
};

/** @deprecated Parse-only helper for legacy persisted overlay data. */
export function parseOverlayScenes(input: unknown): OverlaySceneItem[] {
  if (!Array.isArray(input)) return [];
  const out: OverlaySceneItem[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") continue;
    if (typeof row.duration !== "number" || typeof row.startTime !== "number") {
      continue;
    }
    if (typeof row.layerIndex !== "number") continue;
    out.push({
      id: row.id,
      name: row.name,
      duration: row.duration,
      startTime: row.startTime,
      layerIndex: row.layerIndex,
    });
  }
  return out;
}
