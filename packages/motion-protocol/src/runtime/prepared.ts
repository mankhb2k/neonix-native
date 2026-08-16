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

/** A runtime visual layer as it appears in MotionRuntimeProject.layers */
export type RuntimeVisualLayer = Exclude<
  MotionRuntimeProject["layers"][number],
  { type: "audio" }
>;

/** A runtime property animation as it appears in MotionRuntimeProject.propertyAnimations */
export type RuntimePropertyAnimation =
  MotionRuntimeProject["propertyAnimations"][number];

// ── Static geometry descriptor ───────────────────────────────────────

/**
 * Pre-computed static geometry for a layer.
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
  /** Layer type for type-specific paint decisions */
  nodeType: RuntimeVisualLayer["type"];
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
 * A compositing scope defines a region of the layer tree that needs
 * offscreen isolation (for masks, effects, or blend operations).
 */
export type CompositingScope = {
  scopeId: string;
  layerIds: string[];
  /** Why isolation is needed */
  reason: "mask" | "effect" | "blend" | "adjustment";
  /** Source layer for mask/matte */
  sourceLayerId?: string;
};

// ── Dependency graph ──────────────────────────────────────────────────

/**
 * A minimal dependency graph node for invalidation.
 */
export type DepGraphNode = {
  layerId: string;
  /** Layers that this layer depends on (parent, mask source, constraint target...) */
  dependsOn: string[];
  /** Layers that depend on this layer */
  dependedOnBy: string[];
};

// ── Top-level PreparedRuntimeProject ──────────────────────────────────

/**
 * PreparedRuntimeProject — compiled project with all indexes pre-built.
 *
 * Created by the compiler. Consumed by:
 *   - evaluator (O(1) layer / propertyAnimation lookups)
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

  /** Asset URI by asset ID */
  assetUriMap: Map<string, string>;

  /** Visual layer lookup by id (one graph). */
  layerById: Map<string, RuntimeVisualLayer>;

  /** Property animations indexed by target layer id. */
  propertyAnimationsByLayerId: Map<string, RuntimePropertyAnimation[]>;

  /** Topological order of layers (parent before children). */
  topoOrder: string[];

  /** Static geometry for each visual layer. */
  staticGeometry: Map<string, StaticGeometry>;

  /** Text layout inputs for text layers only. */
  textLayout: TextLayoutInput[];

  /** Compositing scopes (masks, effects, blends). */
  compositingScopes: CompositingScope[];

  /** Dependency graph for invalidation. */
  depGraph: DepGraphNode[];
};
