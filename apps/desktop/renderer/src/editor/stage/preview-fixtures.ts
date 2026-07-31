/**
 * Large-fixture builders for preview profiling (N7).
 * DOM StageRendererPort remains the default; Pixi swaps in behind the same port.
 */

export const PREVIEW_FIXTURE_SIZES = [100, 500, 2000] as const;

export type PreviewFixtureSize = (typeof PREVIEW_FIXTURE_SIZES)[number];

export function buildSyntheticClipCount(size: number): number {
  return Math.max(1, size);
}

/** Lightweight scene stubs for stress painting (not full MotionProject). */
export type SyntheticPreviewNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function buildSyntheticPreviewNodes(
  size: number,
): SyntheticPreviewNode[] {
  const count = buildSyntheticClipCount(size);
  const nodes: SyntheticPreviewNode[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({
      id: `syn_${i}`,
      label: `N${i}`,
      x: col * 24,
      y: row * 16,
      w: 20,
      h: 12,
    });
  }
  return nodes;
}

/** Dropped-frame gate target (ms) for a 60fps paint loop under fixture load. */
export const PREVIEW_FRAME_BUDGET_MS = 1000 / 60;
