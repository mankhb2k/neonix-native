/**
 * Ánh xạ tọa độ stage viewport ↔ composition.
 */

import type { Point } from "../common/point";

export type StagePoint = { x: number; y: number };

export type StageViewportMetrics = {
  /** Rect content overlay/player theo client px (content box đã letterbox). */
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  contentHeight: number;
  compositionWidth: number;
  compositionHeight: number;
  /** Camera editor tùy chọn trên stage (identity = 1,0,0). */
  zoom?: number;
  panX?: number;
  panY?: number;
};

export function clientToComposition(
  client: Point,
  m: StageViewportMetrics,
): StagePoint | null {
  if (m.contentWidth <= 0 || m.contentHeight <= 0) return null;
  if (m.compositionWidth <= 0 || m.compositionHeight <= 0) return null;

  const localX = client.x - m.contentLeft;
  const localY = client.y - m.contentTop;
  if (
    localX < 0 ||
    localY < 0 ||
    localX > m.contentWidth ||
    localY > m.contentHeight
  ) {
    return null;
  }

  const zoom = m.zoom ?? 1;
  const panX = m.panX ?? 0;
  const panY = m.panY ?? 0;
  const scaleX = m.compositionWidth / m.contentWidth;
  const scaleY = m.compositionHeight / m.contentHeight;

  return {
    x: (localX * scaleX - panX) / zoom,
    y: (localY * scaleY - panY) / zoom,
  };
}

export function compositionToClient(
  p: StagePoint,
  m: StageViewportMetrics,
): Point {
  const zoom = m.zoom ?? 1;
  const panX = m.panX ?? 0;
  const panY = m.panY ?? 0;
  const scaleX = m.contentWidth > 0 ? m.contentWidth / m.compositionWidth : 1;
  const scaleY =
    m.contentHeight > 0 ? m.contentHeight / m.compositionHeight : 1;

  return {
    x: m.contentLeft + (p.x * zoom + panX) * scaleX,
    y: m.contentTop + (p.y * zoom + panY) * scaleY,
  };
}
