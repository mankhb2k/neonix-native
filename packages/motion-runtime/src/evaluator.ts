import {
  motionPropertyCapability,
  ratioFromPercent,
} from "@motionvideo/motion-protocol";
import {
  type MotionRuntimeProject,
  type RuntimeLayerGraph,
} from "@motionvideo/motion-protocol/runtime";
import {
  IDENTITY_MATRIX,
  applyMatrix,
  decomposeMatrix,
  inheritedParentMatrix,
  localTransformMatrix,
  multiplyMatrix,
  translationMatrix,
  type Matrix2D,
  type Transform2D,
} from "./matrix";
import {
  type Matrix4,
  IDENTITY_MATRIX4,
  localTransformMatrix3D,
  multiplyMatrix4,
} from "./matrix4";
import { invertMatrix, transformBounds, type Bounds2D } from "./spatial";

function readNestedNumber(root: Record<string, unknown>, path: string): number {
  let cursor: unknown = root;
  for (const part of path.split(".")) {
    if (!cursor || typeof cursor !== "object") return 0;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "number" && Number.isFinite(cursor) ? cursor : 0;
}
import {
  bendPathContours,
  localNodeBounds,
  pathMorphContours,
  samplePathContour,
  trimPathContours,
} from "./geometry";
import { solveSecondaryMotionChain } from "./secondary-motion";
import {
  interpolateAngle,
  interpolateVec2,
  isVec2,
  sampleEasing,
  type KeyframeEasing,
} from "./curve-sampler";
import { evaluateDriverGraph } from "./procedural-driver";
import { RuntimeDiagnosticCollector } from "./diagnostics";
import {
  resolveEffectiveTiming,
  isNodeTimeActive,
  nodeLocalTime,
} from "./composition/effective-timing";

export type RuntimeScene = RuntimeLayerGraph;
export type RuntimeNode = RuntimeScene["layers"][number];
export type RuntimeTrack = MotionRuntimeProject["tracks"][number];
export type RuntimeEffect = NonNullable<RuntimeNode["effects"]>[number];
type PathNodeContours = Extract<
  RuntimeNode,
  { type: "path" }
>["payload"]["contours"];

export type EvaluatedNode = {
  layer: RuntimeNode;
  transform: Transform2D;
  worldMatrix: Matrix2D;
  /**
   * 4×4 world matrix (perspective-3d only).
   * When set, consumers should use this for projection instead of worldMatrix.
   * @since Phase 11
   */
  worldMatrix4?: Matrix4;
  worldOpacity: number;
  visible: boolean;
  worldBounds: Bounds2D;
  /** Scene-space depth used for layered-2.5d projection (0 when flat). */
  depth: number;
  /** Screen-space parallax offset applied after world matrix (R4). */
  projectedOffset: { x: number; y: number };
  /** Path contours after morph/bend/trim (paint consumers). */
  paintContours?: PathNodeContours;
  /** Effects resolved at this timestamp (authoring order). */
  effects?: RuntimeEffect[];
};

/** @deprecated Prefer sampleEasing from curve-sampler; kept for named-ease call sites. */
export function easingValue(
  progress: number,
  easing: KeyframeEasing | undefined = "linear",
): number {
  return sampleEasing(progress, easing);
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16);
    const g = parseInt(clean[1]! + clean[1]!, 16);
    const b = parseInt(clean[2]! + clean[2]!, 16);
    return [r, g, b];
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function interpolateColor(
  colorA: string,
  colorB: string,
  progress: number,
): string {
  if (!colorA.startsWith("#") || !colorB.startsWith("#"))
    return progress < 0.5 ? colorA : colorB;
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  const r = r1 + (r2 - r1) * progress;
  const g = g1 + (g2 - g1) * progress;
  const b = b1 + (b2 - b1) * progress;
  return rgbToHex(r, g, b);
}

function resolveValueKind(
  track: RuntimeTrack | undefined,
  property: string,
  left: unknown,
  right: unknown,
): string | undefined {
  if (track?.valueKind) return track.valueKind;
  if (property === "transform.rotate.z" || property.endsWith(".rotate.z"))
    return "angle";
  if (
    typeof left === "string" &&
    typeof right === "string" &&
    left.startsWith("#") &&
    right.startsWith("#")
  )
    return "color";
  if (isVec2(left) && isVec2(right)) return "vec2";
  return undefined;
}

export function sampleTrackValue(
  keys: RuntimeTrack["keys"],
  time: number,
  valueKind?: string,
): unknown {
  if (keys.length === 0) return undefined;
  if (time <= keys[0]!.t) return keys[0]!.v;
  const last = keys[keys.length - 1]!;
  if (time >= last.t) return last.v;
  for (let index = 1; index < keys.length; index += 1) {
    const right = keys[index]!;
    const left = keys[index - 1]!;
    if (time > right.t) continue;
    const progress = sampleEasing(
      (time - left.t) / Math.max(0.000001, right.t - left.t),
      right.easing as KeyframeEasing | undefined,
    );
    const kind = valueKind ?? resolveValueKind(undefined, "", left.v, right.v);
    if (
      kind === "color" &&
      typeof left.v === "string" &&
      typeof right.v === "string"
    ) {
      return interpolateColor(left.v, right.v, progress);
    }
    if (
      kind === "angle" &&
      typeof left.v === "number" &&
      typeof right.v === "number"
    ) {
      return interpolateAngle(left.v, right.v, progress);
    }
    if (kind === "vec2" && isVec2(left.v) && isVec2(right.v)) {
      return interpolateVec2(left.v, right.v, progress);
    }
    if (
      typeof left.v === "string" &&
      typeof right.v === "string" &&
      left.v.startsWith("#") &&
      right.v.startsWith("#")
    ) {
      return interpolateColor(left.v, right.v, progress);
    }
    if (typeof left.v !== "number" || typeof right.v !== "number")
      return time < right.t ? left.v : right.v;
    return left.v + (right.v - left.v) * progress;
  }
  return last.v;
}

export function evaluateTrack(
  track: RuntimeTrack | undefined,
  time: number,
  fallback: unknown,
  propertyHint = "",
): unknown {
  if (!track || track.keys.length === 0) return fallback;
  const keys = track.keys;
  const t0 = keys[0]!.t;
  const tLast = keys[keys.length - 1]!.t;
  const duration = tLast - t0;
  const kind = resolveValueKind(
    track,
    propertyHint,
    keys[0]!.v,
    keys[keys.length - 1]!.v,
  );

  const cycleMode = (
    behavior: RuntimeTrack["preBehavior"],
  ): "repeat" | "pingpong" => {
    if (!behavior || behavior.type !== "cycle") return "repeat";
    return behavior.mode ?? "repeat";
  };

  if (time < t0) {
    const preBehavior = track.preBehavior;
    const pre = preBehavior?.type ?? "clamp";
    if (pre === "cycle" && duration > 0) {
      if (cycleMode(preBehavior) === "pingpong") {
        const count = Math.floor((t0 - time) / duration);
        const rem = (t0 - time) % duration;
        const wrapped = count % 2 === 0 ? t0 + rem : tLast - rem;
        return sampleTrackValue(keys, wrapped, kind);
      }
      const wrapped = tLast - ((t0 - time) % duration);
      return sampleTrackValue(keys, wrapped, kind);
    }
    if (
      pre === "continue" &&
      keys.length >= 2 &&
      typeof keys[0]!.v === "number" &&
      typeof keys[1]!.v === "number"
    ) {
      const dt = Math.max(0.000001, keys[1]!.t - keys[0]!.t);
      const slope = (keys[1]!.v - keys[0]!.v) / dt;
      return keys[0]!.v + slope * (time - t0);
    }
    return keys[0]!.v;
  }

  if (time > tLast) {
    const postBehavior = track.postBehavior;
    const post = postBehavior?.type ?? "clamp";
    if (post === "cycle" && duration > 0) {
      if (cycleMode(postBehavior) === "pingpong") {
        const count = Math.floor((time - tLast) / duration);
        const rem = (time - tLast) % duration;
        const wrapped = count % 2 === 0 ? tLast - rem : t0 + rem;
        return sampleTrackValue(keys, wrapped, kind);
      }
      const wrapped = t0 + ((time - tLast) % duration);
      return sampleTrackValue(keys, wrapped, kind);
    }
    if (
      post === "continue" &&
      keys.length >= 2 &&
      typeof keys[keys.length - 1]!.v === "number" &&
      typeof keys[keys.length - 2]!.v === "number"
    ) {
      const k1 = keys[keys.length - 2]!;
      const k2 = keys[keys.length - 1]!;
      const dt = Math.max(0.000001, k2.t - k1.t);
      const slope = ((k2.v as number) - (k1.v as number)) / dt;
      return (k2.v as number) + slope * (time - tLast);
    }
    return keys[keys.length - 1]!.v;
  }

  return sampleTrackValue(keys, time, kind);
}

export function sampleTrackCurve(
  track: RuntimeTrack,
  count = 100,
): Array<{ time: number; value: unknown }> {
  if (track.keys.length === 0) return [];
  const t0 = track.keys[0]!.t;
  const tLast = track.keys[track.keys.length - 1]!.t;
  const step = Math.max(0.01, (tLast - t0) / Math.max(1, count - 1));
  const samples: Array<{ time: number; value: unknown }> = [];
  for (let index = 0; index < count; index += 1) {
    const time = t0 + index * step;
    samples.push({ time, value: evaluateTrack(track, time, undefined) });
  }
  return samples;
}

const trackIndexCache = new WeakMap<RuntimeScene, Map<string, RuntimeTrack>>();

function getTrackIndex(scene: RuntimeScene): Map<string, RuntimeTrack> {
  let index = trackIndexCache.get(scene);
  if (!index) {
    index = new Map();
    for (const track of scene.tracks) {
      index.set(`${track.layerId}::${track.property}`, track);
    }
    trackIndexCache.set(scene, index);
  }
  return index;
}

export function evaluateProperty(
  scene: RuntimeScene,
  node: RuntimeNode,
  property: string,
  time: number,
  fallback: unknown,
): unknown {
  const index = getTrackIndex(scene);
  const value = evaluateTrack(
    index.get(`${node.id}::${property}`),
    time,
    fallback,
    property,
  );
  const capability = motionPropertyCapability(node.type, property);
  if (typeof value !== "number" || !capability) return value;
  let bounded = value;
  if (capability.min !== undefined) bounded = Math.max(capability.min, bounded);
  if (
    capability.minExclusive !== undefined &&
    bounded <= capability.minExclusive
  )
    bounded = capability.minExclusive + Number.EPSILON;
  if (capability.max !== undefined) bounded = Math.min(capability.max, bounded);
  return bounded;
}

function effectNumber(
  scene: RuntimeScene,
  node: RuntimeNode,
  effect: RuntimeEffect,
  field: string,
  time: number,
  fallback: number,
): number {
  const value = evaluateProperty(
    scene,
    node,
    `effects.${effect.id}.${field}`,
    time,
    fallback,
  );
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function effectString(
  scene: RuntimeScene,
  node: RuntimeNode,
  effect: RuntimeEffect,
  field: string,
  time: number,
  fallback: string,
): string {
  const value = evaluateProperty(
    scene,
    node,
    `effects.${effect.id}.${field}`,
    time,
    fallback,
  );
  return typeof value === "string" ? value : fallback;
}

/** Resolve one ordered effect at a deterministic frame timestamp. */
export function evaluateEffect(
  scene: RuntimeScene,
  node: RuntimeNode,
  effect: RuntimeEffect,
  time: number,
): RuntimeEffect {
  switch (effect.type) {
    case "blur":
      return {
        ...effect,
        radius: effectNumber(
          scene,
          node,
          effect,
          "radius",
          time,
          effect.radius,
        ),
      };
    case "shadow":
      return {
        ...effect,
        offset: {
          x: effectNumber(
            scene,
            node,
            effect,
            "offset.x",
            time,
            effect.offset.x,
          ),
          y: effectNumber(
            scene,
            node,
            effect,
            "offset.y",
            time,
            effect.offset.y,
          ),
        },
        blur: effectNumber(scene, node, effect, "blur", time, effect.blur),
        color: effectString(scene, node, effect, "color", time, effect.color),
        opacity: ratioFromPercent(
          effectNumber(scene, node, effect, "opacity", time, effect.opacity),
        ),
      };
    case "glow":
      return {
        ...effect,
        radius: effectNumber(
          scene,
          node,
          effect,
          "radius",
          time,
          effect.radius,
        ),
        intensity: ratioFromPercent(
          effectNumber(
            scene,
            node,
            effect,
            "intensity",
            time,
            effect.intensity,
          ),
        ),
        color: effectString(scene, node, effect, "color", time, effect.color),
        opacity: ratioFromPercent(
          effectNumber(scene, node, effect, "opacity", time, effect.opacity),
        ),
      };
    case "color-adjust":
      return {
        ...effect,
        brightness: ratioFromPercent(
          effectNumber(
            scene,
            node,
            effect,
            "brightness",
            time,
            effect.brightness,
          ),
        ),
        contrast: ratioFromPercent(
          effectNumber(scene, node, effect, "contrast", time, effect.contrast),
        ),
        saturation: ratioFromPercent(
          effectNumber(
            scene,
            node,
            effect,
            "saturation",
            time,
            effect.saturation,
          ),
        ),
        "hue-rotate": effectNumber(
          scene,
          node,
          effect,
          "hue-rotate",
          time,
          effect["hue-rotate"],
        ),
      };
  }
}

/** Resolve effects in authoring order; consumers must preserve this order. */
export function evaluateNodeEffects(
  scene: RuntimeScene,
  node: RuntimeNode,
  time: number,
): RuntimeEffect[] {
  return (node.effects ?? []).map((effect) =>
    evaluateEffect(scene, node, effect, time),
  );
}

function numberProperty(
  scene: RuntimeScene,
  node: RuntimeNode,
  property: string,
  time: number,
  fallback: number,
  driven?: Map<string, number>,
  collector?: RuntimeDiagnosticCollector,
): number {
  const drivenValue = driven?.get(`${node.id}::${property}`);
  if (drivenValue !== undefined && Number.isFinite(drivenValue))
    return drivenValue;
  if (drivenValue !== undefined && !Number.isFinite(drivenValue)) {
    collector?.warn("NON_FINITE_VALUE", {
      layerId: node.id,
      details: { property, value: String(drivenValue) },
    });
    return fallback;
  }
  const value = evaluateProperty(scene, node, property, time, fallback);
  const result =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  if (!Number.isFinite(result)) {
    collector?.warn("NON_FINITE_VALUE", {
      layerId: node.id,
      details: { property, value: String(value) },
    });
    return fallback;
  }
  return result;
}

function booleanProperty(
  scene: RuntimeScene,
  node: RuntimeNode,
  property: string,
  time: number,
  fallback: boolean,
): boolean {
  const value = evaluateProperty(scene, node, property, time, fallback);
  return typeof value === "boolean" ? value : fallback;
}

export function evaluateTransform(
  scene: RuntimeScene,
  node: RuntimeNode,
  time: number,
  driven?: Map<string, number>,
  collector?: RuntimeDiagnosticCollector,
): Transform2D {
  const t = node.transform;
  const appearance = node.appearance ?? { visible: true, opacity: 100 };
  const frame = node.frame ?? { width: 0, height: 0 };
  return {
    x: numberProperty(
      scene,
      node,
      "transform.translate.x",
      time,
      t.translate.x,
      driven,
      collector,
    ),
    y: numberProperty(
      scene,
      node,
      "transform.translate.y",
      time,
      t.translate.y,
      driven,
      collector,
    ),
    depth: numberProperty(
      scene,
      node,
      "transform.depth",
      time,
      t.depth,
      driven,
      collector,
    ),
    width: numberProperty(
      scene,
      node,
      "frame.width",
      time,
      frame.width,
      driven,
      collector,
    ),
    height: numberProperty(
      scene,
      node,
      "frame.height",
      time,
      frame.height,
      driven,
      collector,
    ),
    rotation: numberProperty(
      scene,
      node,
      "transform.rotate.z",
      time,
      t.rotate.z,
      driven,
      collector,
    ),
    scaleX: numberProperty(
      scene,
      node,
      "transform.scale.x",
      time,
      t.scale.x,
      driven,
      collector,
    ),
    scaleY: numberProperty(
      scene,
      node,
      "transform.scale.y",
      time,
      t.scale.y,
      driven,
      collector,
    ),
    anchorX: numberProperty(
      scene,
      node,
      "transform.origin.x",
      time,
      t.origin.x,
      driven,
      collector,
    ),
    anchorY: numberProperty(
      scene,
      node,
      "transform.origin.y",
      time,
      t.origin.y,
      driven,
      collector,
    ),
    opacity: ratioFromPercent(
      numberProperty(
        scene,
        node,
        "appearance.opacity",
        time,
        appearance.opacity,
        driven,
        collector,
      ),
    ),
    visible: booleanProperty(
      scene,
      node,
      "appearance.visible",
      time,
      appearance.visible,
    ),
    flipX: false,
    flipY: false,
  };
}

// ── Phase 11 — 3D transform evaluation ────────────────────────────────

/** Extended 3D transform fields (added to existing Transform2D fields). */
export type Transform3DFields = {
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  anchorZ: number;
};

/**
 * Evaluate 3D-specific transform properties from a node.
 * Returns all zeroes when the node has no 3D schema fields.
 */
export function evaluateTransform3DFields(
  scene: RuntimeScene,
  node: RuntimeNode,
  time: number,
  driven?: Map<string, number>,
  collector?: RuntimeDiagnosticCollector,
): Transform3DFields {
  const t = node.transform;
  return {
    z: numberProperty(
      scene,
      node,
      "transform.depth",
      time,
      t.depth,
      driven,
      collector,
    ),
    rotationX: numberProperty(
      scene,
      node,
      "transform.rotate.x",
      time,
      t.rotate.x,
      driven,
      collector,
    ),
    rotationY: numberProperty(
      scene,
      node,
      "transform.rotate.y",
      time,
      t.rotate.y,
      driven,
      collector,
    ),
    rotationZ: numberProperty(
      scene,
      node,
      "transform.rotate.z",
      time,
      t.rotate.z,
      driven,
      collector,
    ),
    anchorZ: numberProperty(
      scene,
      node,
      "transform.origin.z",
      time,
      t.origin.z,
      driven,
      collector,
    ),
  };
}

/**
 * Build a local 4×4 matrix from a node's 2D + 3D transform properties.
 */
export function buildEvaluatedMatrix4(
  transform: Transform2D,
  fields3D: Transform3DFields,
): Matrix4 {
  return localTransformMatrix3D({
    x: transform.x,
    y: transform.y,
    z: fields3D.z,
    width: transform.width,
    height: transform.height,
    rotation: transform.rotation,
    rotationX: fields3D.rotationX,
    rotationY: fields3D.rotationY,
    rotationZ: fields3D.rotationZ,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    anchorX: transform.anchorX,
    anchorY: transform.anchorY,
    anchorZ: fields3D.anchorZ,
    flipX: transform.flipX,
    flipY: transform.flipY,
  });
}

/**
 * Compute the 4×4 world matrix for a node by composing parentMatrix4 × localMatrix4.
 */
export function computeWorldMatrix4(
  parentMatrix4: Matrix4,
  localMatrix4: Matrix4,
): Matrix4 {
  return multiplyMatrix4(parentMatrix4, localMatrix4);
}

function topologicalNodes(scene: RuntimeScene): RuntimeNode[] {
  const byId = new Map(scene.layers.map((node) => [node.id, node]));
  const declarationIndex = new Map(
    scene.layers.map((node, index) => [node.id, index]),
  );
  const outgoing = new Map(
    scene.layers.map((node) => [node.id, new Set<string>()]),
  );
  const indegree = new Map(scene.layers.map((node) => [node.id, 0]));
  const addEdge = (from: string | null | undefined, to: string) => {
    if (!from || !byId.has(from) || outgoing.get(from)!.has(to)) return;
    outgoing.get(from)!.add(to);
    indegree.set(to, indegree.get(to)! + 1);
  };
  for (const node of scene.layers) {
    addEdge(node.parentLayerId, node.id);
    for (const modifier of node.modifiers ?? []) {
      if (modifier.type === "constraint")
        addEdge(modifier.targetLayerId, node.id);
    }
  }
  const ready = scene.layers.filter((node) => indegree.get(node.id) === 0);
  const ordered: RuntimeNode[] = [];
  while (ready.length > 0) {
    ready.sort(
      (left, right) =>
        declarationIndex.get(left.id)! - declarationIndex.get(right.id)!,
    );
    const node = ready.shift()!;
    ordered.push(node);
    for (const targetId of outgoing.get(node.id)!) {
      indegree.set(targetId, indegree.get(targetId)! - 1);
      if (indegree.get(targetId) === 0) ready.push(byId.get(targetId)!);
    }
  }
  return ordered.length === scene.layers.length ? ordered : scene.layers;
}

function blendAngle(from: number, to: number, weight: number): number {
  const delta = ((((to - from + 180) % 360) + 360) % 360) - 180;
  return from + delta * weight;
}

export function evaluateScene(
  scene: RuntimeScene,
  time: number,
  collector?: RuntimeDiagnosticCollector,
): EvaluatedNode[] {
  const byId = new Map(scene.layers.map((node) => [node.id, node]));
  const trackIndex = getTrackIndex(scene);
  const readBaseAt = (
    sampleTime: number,
    layerId: string,
    property: string,
  ): number => {
    const node = byId.get(layerId);
    if (!node) return 0;
    let fallback = 0;
    if (
      property.startsWith("transform.") ||
      property.startsWith("appearance.") ||
      property.startsWith("frame.")
    ) {
      fallback = readNestedNumber(node as unknown as Record<string, unknown>, property);
    }
    const value = evaluateTrack(
      trackIndex.get(`${layerId}::${property}`),
      sampleTime,
      fallback,
      property,
    );
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : fallback;
  };
  const driven =
    scene.drivers && scene.drivers.length > 0
      ? evaluateDriverGraph(scene.drivers, {
          time,
          readBase: (id, property, atTime) =>
            readBaseAt(atTime ?? time, id, property),
        })
      : undefined;

  const secondaryRotations = new Map<string, number>();
  for (const node of scene.layers) {
    for (const modifier of node.modifiers ?? []) {
      if (modifier.type !== "secondary-motion" || modifier.axis !== "rotation")
        continue;
      const driver = byId.get(modifier.driverNodeId);
      if (!driver) {
        collector?.warn("SECONDARY_MOTION_DRIVER_MISSING", {
          layerId: node.id,
          message: `Secondary motion driver missing: ${modifier.driverNodeId}`,
        });
        continue;
      }
      const rotations = solveSecondaryMotionChain(
        time,
        {
          chainLength: modifier.chainLayerIds.length,
          stiffness: modifier.stiffness,
          damping: modifier.damping,
          lag: modifier.lag,
          amplitude: modifier.amplitude,
        },
        (sampleTime) =>
          evaluateTransform(scene, driver, sampleTime, driven, collector)
            .rotation,
      );
      for (let index = 0; index < modifier.chainLayerIds.length; index += 1) {
        const chainNodeId = modifier.chainLayerIds[index]!;
        secondaryRotations.set(
          chainNodeId,
          (secondaryRotations.get(chainNodeId) ?? 0) + rotations[index]!,
        );
      }
    }
  }
  // Phase 3: Resolve effective timing for parent-relative time windows
  const effectiveTimings = resolveEffectiveTiming(
    topologicalNodes(scene),
    scene.duration,
  );
  const evaluated = new Map<string, EvaluatedNode>();
  const visiting = new Set<string>();

  const evaluate = (node: RuntimeNode): EvaluatedNode => {
    const cached = evaluated.get(node.id);
    if (cached) return cached;

    // Phase 3: Time-activity culling (parent-relative effective timing)
    const nodeTiming = effectiveTimings.get(node.id);
    if (nodeTiming && !isNodeTimeActive(nodeTiming, time)) {
      const culled: EvaluatedNode = {
        layer: node,
        transform: {
          x: 0,
          y: 0,
          depth: 0,
          width: node.frame?.width ?? 0,
          height: node.frame?.height ?? 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0,
          anchorY: 0,
          opacity: 0,
          visible: false,
          flipX: false,
          flipY: false,
        },
        worldMatrix: IDENTITY_MATRIX,
        worldOpacity: 0,
        visible: false,
        worldBounds: { x: 0, y: 0, width: 0, height: 0 },
        depth: 0,
        projectedOffset: { x: 0, y: 0 },
      };
      evaluated.set(node.id, culled);
      return culled;
    }

    // Phase 3: Node-local time for animation (0 = node effective start)
    const animTime = nodeTiming ? nodeLocalTime(nodeTiming, time) : time;

    if (visiting.has(node.id)) {
      collector?.error("PARENT_CYCLE", {
        layerId: node.id,
        message: `Parent cycle detected at node: ${node.id}`,
      });
      // Return a safe stub node to prevent infinite recursion
      const stub: EvaluatedNode = {
        layer: node,
        transform: {
          x: 0,
          y: 0,
          depth: 0,
          width: node.frame?.width ?? 0,
          height: node.frame?.height ?? 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0,
          anchorY: 0,
          opacity: 0,
          visible: false,
          flipX: false,
          flipY: false,
        },
        worldMatrix: IDENTITY_MATRIX,
        worldOpacity: 0,
        visible: false,
        worldBounds: { x: 0, y: 0, width: 0, height: 0 },
        depth: 0,
        projectedOffset: { x: 0, y: 0 },
      };
      evaluated.set(node.id, stub);
      return stub;
    }
    visiting.add(node.id);

    let transform = evaluateTransform(scene, node, animTime, driven, collector);
    const secondaryRotation = secondaryRotations.get(node.id);
    if (secondaryRotation !== undefined)
      transform = {
        ...transform,
        rotation: transform.rotation + secondaryRotation,
      };
    let parentMatrix = IDENTITY_MATRIX;
    let worldOpacity = transform.opacity;
    let visible = transform.visible;

    if (node.parentLayerId) {
      const parentNode = byId.get(node.parentLayerId);
      if (!parentNode) {
        collector?.warn("PARENT_MISSING", {
          layerId: node.id,
          message: `Parent node missing: ${node.parentLayerId}. Using identity parent.`,
        });
        // Fall through with identity parent
      } else {
        const parent = evaluate(parentNode);
        parentMatrix = inheritedParentMatrix(parent.worldMatrix, {
          position: node.inheritPosition !== false,
          rotation: node.inheritRotation !== false,
          scale: node.inheritScale !== false,
        });
        worldOpacity =
          (node.inheritOpacity !== false ? parent.worldOpacity : 1) *
          transform.opacity;
        visible = parent.visible && transform.visible;
      }
    }

    const motionPath = node.modifiers?.find(
      (modifier) => modifier.type === "motion-path",
    );
    if (motionPath) {
      const pathNode = byId.get(motionPath.pathNodeId);
      if (!pathNode || pathNode.type !== "path") {
        collector?.warn("MOTION_PATH_SOURCE_MISSING", {
          layerId: node.id,
          message: `Motion Path source missing: ${motionPath.pathNodeId}`,
        });
        // Skip motion path — continue with current transform
      } else {
        const path = evaluate(pathNode);
        const rawProgress = evaluateProperty(
          scene,
          node,
          `modifiers.${motionPath.id}.progress`,
          time,
          motionPath.progress,
        );
        const progress =
          typeof rawProgress === "number" ? rawProgress : motionPath.progress;
        const mappedProgress =
          motionPath.startOffset +
          (motionPath.endOffset - motionPath.startOffset) * progress;
        const sourceMorph = pathNode.modifiers?.find(
          (modifier) => modifier.type === "path-morph",
        );
        const sourceProgress = sourceMorph
          ? evaluateProperty(
              scene,
              pathNode,
              `modifiers.${sourceMorph.id}.progress`,
              time,
              sourceMorph.progress,
            )
          : undefined;
        const sourceContours = sourceMorph
          ? pathMorphContours(
              pathNode,
              typeof sourceProgress === "number" ? sourceProgress : 0,
            )
          : pathNode.payload.contours;
        const sample = samplePathContour(
          pathNode,
          motionPath.contourId,
          mappedProgress,
          sourceContours,
        );
        const worldPoint = applyMatrix(
          path.worldMatrix,
          sample.point.x,
          sample.point.y,
        );
        const worldTangentPoint = applyMatrix(
          path.worldMatrix,
          sample.point.x + sample.tangent.x,
          sample.point.y + sample.tangent.y,
        );
        const inverseParent = invertMatrix(parentMatrix);
        if (!inverseParent) {
          collector?.warn("MATRIX_NOT_INVERTIBLE", {
            layerId: node.id,
            message: `Motion Path parent matrix not invertible: ${node.id}. Skipping motion path.`,
          });
          // Skip motion path transform — keep current transform
        } else {
          const localPoint = applyMatrix(
            inverseParent,
            worldPoint.x,
            worldPoint.y,
          );
          const localTangentPoint = applyMatrix(
            inverseParent,
            worldTangentPoint.x,
            worldTangentPoint.y,
          );
          transform = {
            ...transform,
            x: localPoint.x,
            y: localPoint.y,
            rotation: motionPath.orientToPath
              ? (Math.atan2(
                  localTangentPoint.y - localPoint.y,
                  localTangentPoint.x - localPoint.x,
                ) *
                  180) /
                  Math.PI +
                motionPath.rotationOffset
              : transform.rotation,
          };
        } // else (inverseParent exists)
      } // else (pathNode exists)
    } // if (motionPath)

    for (const constraint of (node.modifiers ?? []).filter(
      (m) => m.type === "constraint",
    )) {
      const targetNode = byId.get(constraint.targetLayerId);
      if (!targetNode) {
        collector?.warn("CONSTRAINT_TARGET_MISSING", {
          layerId: node.id,
          message: `Constraint target missing: ${constraint.targetLayerId}. Skipping constraint.`,
        });
        continue;
      }
      const target = evaluated.get(targetNode.id) ?? evaluate(targetNode);
      const rawWeight = evaluateProperty(
        scene,
        node,
        `modifiers.${constraint.id}.weight`,
        time,
        constraint.weight,
      );
      const weight = Math.min(
        1,
        Math.max(
          0,
          typeof rawWeight === "number" ? rawWeight : constraint.weight,
        ),
      );
      const targetWorld = decomposeMatrix(target.worldMatrix);
      const parentWorld = decomposeMatrix(parentMatrix);
      if (constraint.kind === "copy-position") {
        const inverseParent = invertMatrix(parentMatrix);
        if (!inverseParent) {
          collector?.warn("MATRIX_NOT_INVERTIBLE", {
            layerId: node.id,
            message: `Constraint parent matrix not invertible: ${node.id}. Skipping position constraint.`,
          });
          continue;
        }
        const localTarget = applyMatrix(
          inverseParent,
          targetWorld.x,
          targetWorld.y,
        );
        transform = {
          ...transform,
          x: transform.x + (localTarget.x - transform.x) * weight,
          y: transform.y + (localTarget.y - transform.y) * weight,
        };
      } else if (constraint.kind === "copy-rotation") {
        transform = {
          ...transform,
          rotation: blendAngle(
            transform.rotation,
            targetWorld.rotation - parentWorld.rotation,
            weight,
          ),
        };
      } else {
        const baseWorld = multiplyMatrix(
          parentMatrix,
          localTransformMatrix(transform),
        );
        const worldAngle =
          (Math.atan2(
            targetWorld.y - baseWorld.f,
            targetWorld.x - baseWorld.e,
          ) *
            180) /
          Math.PI;
        transform = {
          ...transform,
          rotation: blendAngle(
            transform.rotation,
            worldAngle - parentWorld.rotation,
            weight,
          ),
        };
      }
    }

    const worldMatrix = multiplyMatrix(
      parentMatrix,
      localTransformMatrix(transform),
    );

    // ── Phase 11: 3D world matrix for perspective-3d scenes ─────────
    let worldMatrix4: Matrix4 | undefined;
    if (scene.space === "perspective-3d") {
      const fields3D = evaluateTransform3DFields(
        scene,
        node,
        time,
        driven,
        collector,
      );
      const localM4 = buildEvaluatedMatrix4(transform, fields3D);
      const parentM4 = node.parentLayerId
        ? (evaluated.get(node.parentLayerId)?.worldMatrix4 ?? IDENTITY_MATRIX4)
        : IDENTITY_MATRIX4;
      worldMatrix4 = multiplyMatrix4(parentM4, localM4);
    }

    let paintContours =
      node.type === "path" ? node.payload.contours : undefined;
    if (node.type === "path") {
      for (const modifier of node.modifiers ?? []) {
        if (modifier.type === "path-morph") {
          const progress = evaluateProperty(
            scene,
            node,
            `modifiers.${modifier.id}.progress`,
            time,
            modifier.progress,
          );
          paintContours = pathMorphContours(
            node,
            typeof progress === "number"
              ? progress
              : typeof modifier.progress === "number"
                ? modifier.progress
                : 0,
          );
        } else if (modifier.type === "path-bend") {
          const amount = evaluateProperty(
            scene,
            node,
            `modifiers.${modifier.id}.amount`,
            time,
            modifier.amount,
          );
          paintContours = bendPathContours(
            paintContours ?? node.payload.contours,
            typeof amount === "number" ? amount : modifier.amount,
          );
        } else if (modifier.type === "trim-path") {
          const start = evaluateProperty(
            scene,
            node,
            `modifiers.${modifier.id}.start`,
            time,
            modifier.start,
          );
          const end = evaluateProperty(
            scene,
            node,
            `modifiers.${modifier.id}.end`,
            time,
            modifier.end,
          );
          const offset = evaluateProperty(
            scene,
            node,
            `modifiers.${modifier.id}.offset`,
            time,
            modifier.offset,
          );
          paintContours = trimPathContours(
            paintContours ?? node.payload.contours,
            typeof start === "number" ? start : modifier.start,
            typeof end === "number" ? end : modifier.end,
            typeof offset === "number" ? offset : modifier.offset,
          );
        }
      }
    }

    const strokeWidth =
      (node.type === "shape" || node.type === "path") && node.style?.stroke
        ? numberProperty(
            scene,
            node,
            "style.strokeWidth",
            time,
            node.style.strokeWidth ?? 1,
          )
        : 0;
    const depth = transform.depth ?? 0;
    let projectedOffset = { x: 0, y: 0 };
    const layered = (scene.space ?? "flat-2d") === "layered-2.5d";
    if (layered) {
      const cameraNode = scene.activeCameraLayerId
        ? byId.get(scene.activeCameraLayerId)
        : undefined;
      const cameraEvaluated =
        cameraNode?.type === "camera"
          ? (evaluated.get(cameraNode.id) ??
            (cameraNode.id === node.id ? undefined : evaluate(cameraNode)))
          : undefined;
      const cameraX =
        cameraEvaluated?.transform.x ??
        (cameraNode?.type === "camera"
          ? numberProperty(
              scene,
              cameraNode,
              "transform.translate.x",
              time,
              cameraNode.transform.translate.x,
            )
          : 0);
      const cameraY =
        cameraEvaluated?.transform.y ??
        (cameraNode?.type === "camera"
          ? numberProperty(
              scene,
              cameraNode,
              "transform.translate.y",
              time,
              cameraNode.transform.translate.y,
            )
          : 0);
      const strength =
        cameraNode?.type === "camera"
          ? numberProperty(
              scene,
              cameraNode,
              "payload.parallaxStrength",
              time,
              cameraNode.payload.parallaxStrength ?? 1,
            )
          : 1;
      let factor = 1;
      for (const modifier of node.modifiers ?? []) {
        if (modifier.type === "parallax") factor = modifier.factor;
      }
      // Orthographic layered projection: screen shift ≈ (camera − origin) × depth × strength × factor
      projectedOffset = {
        x: -cameraX * depth * strength * factor * 0.01,
        y: -cameraY * depth * strength * factor * 0.01,
      };
    }
    const projectedMatrix =
      projectedOffset.x !== 0 || projectedOffset.y !== 0
        ? multiplyMatrix(
            translationMatrix(projectedOffset.x, projectedOffset.y),
            worldMatrix,
          )
        : worldMatrix;
    const worldBounds = transformBounds(
      projectedMatrix,
      localNodeBounds(node, transform, strokeWidth, paintContours),
    );
    const effects = evaluateNodeEffects(scene, node, time);
    const result: EvaluatedNode = {
      layer: node,
      transform,
      worldMatrix: projectedMatrix,
      worldMatrix4,
      worldOpacity,
      visible,
      worldBounds,
      depth,
      projectedOffset,
      ...(paintContours ? { paintContours } : {}),
      ...(effects.length ? { effects } : {}),
    };
    evaluated.set(node.id, result);
    visiting.delete(node.id);
    return result;
  };

  for (const node of topologicalNodes(scene)) evaluate(node);
  return scene.layers.map((node) => evaluated.get(node.id) ?? evaluate(node));
}

export { IDENTITY_MATRIX };
