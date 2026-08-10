/**
 * EvaluatedCompositionFrame — the canonical frame contract that combines
 * scene-local evaluation with composition-level metadata.
 *
 * This is the SINGLE frame type that Pixi, Remotion, export worker, and
 * parity harness consume. It replaces the ad-hoc "compositionLayers hung
 * off EvaluatedFrame" pattern from Phase 2.
 *
 * Contract versioning: bump CONTRACT_VERSION when this type's shape changes.
 *
 * §4 in core-engine-roadmap.md
 */

import type { RenderSnapshot } from "./render-snapshot";
import type { PaintCommandBuffer, RenderDiagnostic } from "./paint";
import type { CompositionLayerPlan } from "./composition/evaluate-composition-layers";

// ── Contract version ──────────────────────────────────────────────────

/** Bump when EvaluatedCompositionFrame fields change. */
export const COMPOSITION_FRAME_CONTRACT_VERSION = "3.0.0";

// ── Projection ────────────────────────────────────────────────────────

export type ProjectionKind =
  | "orthographic-2d"
  | "layered-2.5d"
  | "perspective-3d";

export type OrthographicProjection = {
  kind: "orthographic-2d";
  /** World→Screen 3x3 affine matrix */
  viewMatrix: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  };
};

export type Layered25DProjection = {
  kind: "layered-2.5d";
  viewMatrix: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  };
  depthPolicy: "painter-order" | "depth-sort";
};

export type Perspective3DProjection = {
  kind: "perspective-3d";
  viewMatrix: number[]; // 4x4
  projectionMatrix: number[]; // 4x4
  near: number;
  far: number;
  focalLengthPx: number;
};

export type ProjectionSnapshot =
  | OrthographicProjection
  | Layered25DProjection
  | Perspective3DProjection;

// ── Media state ───────────────────────────────────────────────────────

export type EvaluatedMediaState = {
  /** Node ID of the media node (video/image) */
  nodeId: string;
  /** Scene-local time for this media element */
  mediaTime: number;
  /** Source frame index (for video texture seeking) */
  sourceFrame: number;
  /** Asset ID */
  assetId: string;
  /** Resolved URI */
  uri?: string;
  /** Trim range on source */
  trimStart?: number;
  trimEnd?: number;
  /** Playback rate */
  playbackRate: number;
  /** Whether the media is active (within timeline) */
  active: boolean;
};

// ── Audio state ───────────────────────────────────────────────────────

export type EvaluatedAudioState = {
  /** AudioRenderPlans for active audio tracks at this composition time */
  tracks: Array<{
    trackId: string;
    assetId: string;
    /** Source time in the audio asset */
    mediaTime: number;
    /** Volume envelope value at this time (0..1) */
    volume: number;
    /** Muted state */
    muted: boolean;
    /** Fade in/out active */
    fadeActive: boolean;
  }>;
};

// ── Stable layer key ──────────────────────────────────────────────────

/**
 * Stable drawable key — survives playback, edit patches, and scene iterations.
 * Format: `sceneId:nodeId` for unique nodes; `sceneId:nodeId::iter<N>` for repeats.
 */
export type StableLayerKey = string;

/**
 * Build a stable layer key from scene and node IDs.
 * Deterministic — same inputs always produce the same key.
 */
export function stableLayerKey(
  sceneId: string,
  nodeId: string,
  iteration?: number,
): StableLayerKey {
  return iteration != null
    ? `${sceneId}:${nodeId}::iter${iteration}`
    : `${sceneId}:${nodeId}`;
}

/**
 * Parse a stable layer key back to its components.
 */
export function parseStableLayerKey(key: StableLayerKey): {
  sceneId: string;
  nodeId: string;
  iteration?: number;
} | null {
  const match = /^(.+?):(.+?)(?:::iter(\d+))?$/.exec(key);
  if (!match) return null;
  return {
    sceneId: match[1]!,
    nodeId: match[2]!,
    iteration: match[3] ? Number(match[3]) : undefined,
  };
}

// ── Evaluated layer ───────────────────────────────────────────────────

export type EvaluatedLayer = {
  /** Stable layer key — deterministic across playback and patches */
  layerKey: StableLayerKey;
  /** Owning scene ID */
  sceneId: string;
  /** Owning node ID */
  nodeId: string;
  /** Composition layer plan entry (position, opacity, transition state) */
  composition: CompositionLayerPlan;
  /** Interaction snapshot for this layer */
  interaction: RenderSnapshot;
  /** Paint commands for this layer */
  paint: PaintCommandBuffer;
};

// ── Top-level frame ───────────────────────────────────────────────────

export type EvaluatedCompositionFrame = {
  /** Contract version — bump when this type changes */
  contractVersion: string;
  /** Composition frame number (global timeline) */
  compositionFrame: number;
  /** Composition time in seconds (global timeline) */
  compositionTime: number;
  /** Frame rate */
  fps: number;
  /** Composition viewport */
  viewport: { width: number; height: number };
  /** All active layers at this frame (ordered back→front) */
  layers: EvaluatedLayer[];
  /** Combined interaction snapshot (union of all layers) */
  interaction: RenderSnapshot;
  /** Combined paint buffer (all layers merged) */
  paint: PaintCommandBuffer;
  /** Active audio state at this frame */
  audio: EvaluatedAudioState;
  /** Media element states at this frame */
  media: EvaluatedMediaState[];
  /** Projection metadata for this frame */
  projection: ProjectionSnapshot;
  /** Diagnostics collected during evaluation */
  diagnostics: RenderDiagnostic[];
};
