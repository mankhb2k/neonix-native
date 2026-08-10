/**
 * Golden frame — deterministic re-render verification.
 *
 * §Phase 10 Task 10.5 in core-engine-tasks.md
 *
 * Golden frames are rendered at known sample points (before, start,
 * middle, end, after + transition overlaps) and their content hashes
 * are compared across re-renders to guarantee deterministic output.
 */

// ── Sample points ─────────────────────────────────────────────────────

export type GoldenFrameSamplePoint =
  | "before-start"
  | "start"
  | "first-quarter"
  | "middle"
  | "last-quarter"
  | "end"
  | "after-end"
  | "transition-overlap";

export const GOLDEN_SAMPLE_POINTS: readonly GoldenFrameSamplePoint[] = [
  "before-start",
  "start",
  "first-quarter",
  "middle",
  "last-quarter",
  "end",
  "after-end",
  "transition-overlap",
] as const;

/**
 * Map a sample point to a frame index within a composition.
 */
export function goldenSampleFrame(
  point: GoldenFrameSamplePoint,
  durationInFrames: number,
  fps: number,
): number {
  const last = Math.max(0, durationInFrames - 1);
  switch (point) {
    case "before-start":
      return 0;
    case "start":
      return 0;
    case "first-quarter":
      return Math.floor(durationInFrames * 0.25);
    case "middle":
      return Math.floor(durationInFrames / 2);
    case "last-quarter":
      return Math.floor(durationInFrames * 0.75);
    case "end":
      return last;
    case "after-end":
      return last;
    case "transition-overlap":
      // If only one scene, use middle; otherwise halfway through first transition
      return Math.floor(durationInFrames * 0.15);
  }
}

/**
 * Get the composition time (seconds) for a sample point.
 */
export function goldenSampleTime(
  point: GoldenFrameSamplePoint,
  durationInFrames: number,
  fps: number,
): number {
  return goldenSampleFrame(point, durationInFrames, fps) / fps;
}

// ── Golden frame entry ────────────────────────────────────────────────

export type GoldenFrameEntry = {
  /** Sample point label. */
  point: GoldenFrameSamplePoint;
  /** Frame index within composition. */
  frame: number;
  /** Composition time (seconds). */
  time: number;
  /** SHA-256 of serialized paint command buffer at this frame. */
  paintHash: string;
  /** SHA-256 of canvas pixels (if available). */
  pixelHash?: string;
  /** Compositing fingerprint (structural counts). */
  layers: number;
  groups: number;
  drawables: number;
};

/**
 * Golden file — persisted record of known-good frame hashes.
 * Stored alongside templates or committed to git for CI parity gates.
 */
export type GoldenFile = {
  /** Golden file format version. */
  version: 1;
  /** Content hash of the compiled runtime this golden file was produced from. */
  contentHash: string;
  /** Duration of the composition in frames. */
  durationInFrames: number;
  /** FPS. */
  fps: number;
  /** Dimensions. */
  width: number;
  height: number;
  /** Compiler version that produced this golden file. */
  compilerVersion: string;
  /** Per-sample-point golden entries. */
  frames: GoldenFrameEntry[];
  /** ISO timestamp of generation. */
  generatedAt: string;
};

// ── Comparison result ─────────────────────────────────────────────────

export type GoldenFrameComparison = {
  /** Which sample point was compared. */
  point: GoldenFrameSamplePoint;
  /** Whether the paint hash matches the golden. */
  paintMatch: boolean;
  /** Whether the pixel hash matches (if available). */
  pixelMatch: boolean | null;
  /** Whether structural fingerprint matches. */
  structuralMatch: boolean;
  /** Golden hash values. */
  golden: { paintHash: string; pixelHash?: string };
  /** Current hash values. */
  current: { paintHash: string; pixelHash?: string };
};

export type GoldenComparisonReport = {
  /** Content hash of the runtime being tested. */
  contentHash: string;
  /** Whether all frames matched. */
  allMatch: boolean;
  /** Per-frame comparison results. */
  results: GoldenFrameComparison[];
  /** Frames that did NOT match. */
  mismatches: GoldenFrameComparison[];
  /** Timestamp of comparison. */
  comparedAt: string;
};

// ── Comparison logic ──────────────────────────────────────────────────

/**
 * Compare current frame hashes against a golden file.
 */
export function compareGoldenFrames(
  golden: GoldenFile,
  currentFrames: Omit<GoldenFrameEntry, "point" | "frame" | "time">[],
  samplePoints: GoldenFrameSamplePoint[],
  durationInFrames: number,
  fps: number,
): GoldenComparisonReport {
  const results: GoldenFrameComparison[] = [];
  const mismatches: GoldenFrameComparison[] = [];

  for (let i = 0; i < samplePoints.length; i++) {
    const point = samplePoints[i]!;
    const goldenEntry = golden.frames.find((f) => f.point === point);
    const current = currentFrames[i]!;
    const frame = goldenSampleFrame(point, durationInFrames, fps);

    const paintMatch = goldenEntry?.paintHash === current.paintHash;
    const pixelMatch = goldenEntry?.pixelHash != null && current.pixelHash != null
      ? goldenEntry.pixelHash === current.pixelHash
      : null;
    const structuralMatch =
      goldenEntry != null &&
      goldenEntry.layers === current.layers &&
      goldenEntry.groups === current.groups &&
      goldenEntry.drawables === current.drawables;

    const result: GoldenFrameComparison = {
      point,
      paintMatch,
      pixelMatch,
      structuralMatch,
      golden: {
        paintHash: goldenEntry?.paintHash ?? "",
        pixelHash: goldenEntry?.pixelHash,
      },
      current: {
        paintHash: current.paintHash,
        pixelHash: current.pixelHash,
      },
    };

    results.push(result);

    if (!paintMatch || pixelMatch === false || !structuralMatch) {
      mismatches.push(result);
    }
  }

  return {
    contentHash: golden.contentHash,
    allMatch: mismatches.length === 0,
    results,
    mismatches,
    comparedAt: new Date().toISOString(),
  };
}
