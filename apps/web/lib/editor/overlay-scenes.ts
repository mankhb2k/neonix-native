/** Overlay clips above the main timeline track (UI + persistence side-car). */

export type OverlaySceneItem = {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  /** 0 = just above Main Track */
  layerIndex: number;
};

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
