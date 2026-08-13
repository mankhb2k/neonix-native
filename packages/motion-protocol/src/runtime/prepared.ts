/**
 * PreparedRuntimeProject — compiled runtime IR with precomputed indexes.
 *
 * This is the output of a compiler phase: a MotionRuntimeProject
 * wrapped with O(1) lookup indexes that the evaluator, painter, and
 * renderer consume directly.
 *
 * Architecture: this type lives in motion-protocol so both compiler and
 * runtime can reference it without circular deps. It is an in-memory
 * type (Maps, not serialized) — the underlying MotionRuntimeProject
 * remains the serialization format.
 */

import type { MotionRuntimeProject } from "./project";

// ── Per-scene index ───────────────────────────────────────────────────

/** A runtime node as it appears in MotionRuntimeProject.scenes[].layers */
export type RuntimeSceneNode =
  MotionRuntimeProject["scenes"][number]["layers"][number];

/** A runtime track as it appears in MotionRuntimeProject.scenes[].tracks */
export type RuntimeSceneTrack =
  MotionRuntimeProject["scenes"][number]["tracks"][number];

export type RuntimeScene = MotionRuntimeProject["scenes"][number];

// ── Static geometry descriptor ───────────────────────────────────────

/**
 * Pre-computed static geometry for a node.
 * Derived from transform + type-specific bounds at compile time.
 * Animated properties have this as their "at-rest" baseline.
 */
export type StaticGeometry = {
  /** Axis-aligned bounding box in local space */
  bounds: { x: number; y: number; width: number; height: number };
  /** Affine transform matrix (row-major: a,b,c,d,e,f) */
  localMatrix: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  };
  /** Node type for type-specific paint decisions */
  nodeType: RuntimeSceneNode["type"];
};

// ── Text layout input ─────────────────────────────────────────────────

/**
 * Pre-computed text layout input for text layers.
 * The text layout solver consumes these to produce glyph positions.
 */
export type TextLayoutInput = {
  layerId: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  maxWidth?: number;
  maxHeight?: number;
};

// ── Compositing scope ─────────────────────────────────────────────────

/**
 * A compositing scope defines a region of the node tree that needs
 * offscreen isolation (for masks, effects, or blend operations).
 */
export type CompositingScope = {
  scopeId: string;
  layerIds: string[];
  /** Why isolation is needed */
  reason: "mask" | "effect" | "blend" | "adjustment";
  /** Source node for mask/matte */
  sourceLayerId?: string;
};

// ── Dependency graph ──────────────────────────────────────────────────

/**
 * A minimal dependency graph node for invalidation tracking.
 */
export type DepGraphNode = {
  layerId: string;
  /** Nodes that this node depends on (parent, mask source, constraint target...) */
  dependsOn: string[];
  /** Nodes that depend on this node */
  dependedOnBy: string[];
};

// ── Top-level PreparedRuntimeProject ──────────────────────────────────

/**
 * PreparedRuntimeProject — compiled project with all indexes pre-built.
 *
 * Created by the compiler. Consumed by:
 *   - evaluator (O(1) node/track lookups)
 *   - painter (static geometry, compositing scopes)
 *   - renderer (capability fingerprint, asset URIs)
 */
export type PreparedRuntimeProject = {
  /** The underlying normalized project (serializable) */
  normalized: MotionRuntimeProject;

  /** Compiler version that produced this artifact */
  compilerVersion: string;

  /** Capability manifest version at compile time */
  capabilityFingerprint: string;

  // ── Global indexes ──

  /** Scene lookup by ID (across all scenes) */
  sceneById: Map<string, RuntimeScene>;

  /** Asset URI by asset ID */
  assetUriMap: Map<string, string>;

  // ── Per-scene indexes ──

  /**
   * Per-scene node lookup.
   * sceneNodeById.get(sceneId).get(layerId) → node
   */
  sceneNodeById: Map<string, Map<string, RuntimeSceneNode>>;

  /**
   * Per-scene track index by target node ID.
   * sceneTracksByTarget.get(sceneId).get(layerId) → tracks[]
   */
  sceneTracksByTarget: Map<string, Map<string, RuntimeSceneTrack[]>>;

  /**
   * Per-scene topological order of layers (parent before children).
   * sceneTopoOrder.get(sceneId) → nodeId[]
   */
  sceneTopoOrder: Map<string, string[]>;

  /**
   * Per-scene static geometry for each node.
   * sceneStaticGeometry.get(sceneId).get(layerId) → geometry
   */
  sceneStaticGeometry: Map<string, Map<string, StaticGeometry>>;

  /**
   * Per-scene text layout inputs for text layers only.
   * sceneTextLayout.get(sceneId) → TextLayoutInput[]
   */
  sceneTextLayout: Map<string, TextLayoutInput[]>;

  /**
   * Per-scene compositing scopes (masks, effects, blends).
   * sceneCompositingScopes.get(sceneId) → CompositingScope[]
   */
  sceneCompositingScopes: Map<string, CompositingScope[]>;

  /**
   * Per-scene dependency graph for invalidation.
   * sceneDepGraph.get(sceneId) → DepGraphNode[]
   */
  sceneDepGraph: Map<string, DepGraphNode[]>;
};
