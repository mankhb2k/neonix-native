/**
 * Phase 6 — Compiler V3 entry point.
 *
 * `compileMotionProjectV3()` compiles a `MotionProjectV3` authoring project
 * directly into the runtime IR (`MotionRuntimeProject`) — no intermediate
 * project shape is built:
 *
 *   composition            → runtime metadata (aspectRatio derived from
 *                            dimensions, fps, background as brand color)
 *   timeline.visualTracks  → visual plan (one scene instance per visual
 *                            clip, sorted by unique track `order`)
 *   scene clips            → runtime tracks (compiled directly)
 *   variables / bindings   → resolved inline before scene compilation
 *   component nodes        → sealed wrapper-group expansion in the scene
 *                            graph (not a timeline clip source)
 *   caption tracks         → copied through
 *
 * Semantic problems are reported with the `CMP_*` diagnostic family so
 * callers can surface structured errors instead of string exceptions.
 *
 * Note on options: `textMeasurementProvider` / `assetMetadataProvider`
 * are reserved for the runtime evaluator — the compiler uses built-in
 * text measurement, so these are accepted but not consumed.
 */

import { createHash } from "node:crypto";
import {
  canonicalJson,
  computeRuntimeHash,
  computeProjectHash,
  MotionRuntimeProjectSchema,
  MOTION_RUNTIME_VERSION,
  buildCapabilityFingerprint,
  preflightProjectCapabilities,
  canonicalizeTimelineDurationV3,
  CAPABILITY_MANIFEST_VERSION_V3,
  type MotionRuntimeProject,
  V3,
} from "@motionvideo/motion-protocol";
import { isCompiledPreset } from "./preset-registry";
import {
  DiagnosticCollector,
  compileSuccess,
  compileFailure,
  type CompileResult,
} from "./compile-result";
import { compileSceneToRuntime } from "./index";

// ── Public types ──────────────────────────────────────────────────────

export type CompileV3Profile = "embedded-components" | "flattened-components";

export type CompileV3Options = {
  /**
   * Component compile strategy.
   * - `embedded-components` (default): component definitions are expanded
   *   into runtime scenes at compile time.
   * - `flattened-components`: reserved — flattens component assets into
   *   the runtime asset list (Phase 7).
   */
  profile?: CompileV3Profile;
  /** Reserved for Phase 7 — text measurement override. */
  textMeasurementProvider?: unknown;
  /** Reserved for Phase 7 — asset metadata (duration/dimensions) resolver. */
  assetMetadataProvider?: (
    assetId: string,
  ) => { duration?: number; width?: number; height?: number } | undefined;
};

/**
 * Compiler version for v3 compilation. Separate from the legacy
 * `COMPILER_VERSION` so cache keys never collide across pipelines.
 */
export const COMPILER_VERSION_V3 = "3.0.0-phase11";

// ── Small helpers ─────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Set a dotted property path on a plain object, creating intermediate objects. */
function setPropertyPath(
  target: Record<string, unknown>,
  property: string,
  value: unknown,
): void {
  const parts = property.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!cursor[part] || typeof cursor[part] !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

/** Map a V3 authoring property path to its runtime IR equivalent. */
function toRuntimeProperty(property: string): string {
  return property === "payload.text" ? "payload.content.text" : property;
}

function pixelFormatHasAlpha(pixelFormat: string): boolean {
  return /(?:rgba|bgra|argb|abgr|yuva|graya)/i.test(pixelFormat);
}

function deriveAspectRatio(
  width: number,
  height: number,
): "9:16" | "16:9" | "1:1" {
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.01) return "9:16";
  if (Math.abs(ratio - 16 / 9) < 0.01) return "16:9";
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return "16:9";
}

/**
 * Detect cycles in clip schedules (after/with chains).
 * Returns the ids of clips participating in a cycle.
 */
export function detectScheduleCycles(
  clips: Array<{ id: string; schedule: { kind: string; clipId?: string } }>,
): string[] {
  const graph = new Map<string, string[]>();
  for (const clip of clips) {
    const deps: string[] = [];
    if (
      (clip.schedule.kind === "after" || clip.schedule.kind === "with") &&
      clip.schedule.clipId
    ) {
      deps.push(clip.schedule.clipId);
    }
    graph.set(clip.id, deps);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];
  const dfs = (id: string): void => {
    if (visiting.has(id)) {
      cycles.push(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) ?? []) {
      if (graph.has(dep)) dfs(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) dfs(id);
  return [...new Set(cycles)];
}

// ── Runtime shape preparation ─────────────────────────────────────────

function prepareRuntimeNode(node: V3.NodeV3): JsonRecord {
  const flags: {
    position?: boolean;
    rotation?: boolean;
    scale?: boolean;
    opacity?: boolean;
  } = node.inheritFlags ?? {};
  const transform = clone(node.transform) as JsonRecord;
  // Node-level `visible` is the authoring source of truth in v3.
  transform.visible = node.visible;
  const base: JsonRecord = {
    id: node.id,
    type: node.type,
    parentId: node.parentId,
    transform,
  };
  if (node.name) base.name = node.name;
  if (node.zIndex !== undefined) base.zIndex = node.zIndex;
  if (node.timing) base.timing = clone(node.timing);
  if (node.semantic) base.semantic = node.semantic;
  if (node.effects && node.effects.length > 0)
    base.effects = clone(node.effects);
  if (node.blendMode) base.blendMode = node.blendMode;
  if (node.mask) base.mask = clone(node.mask);
  if (flags.position !== undefined) base.inheritPosition = flags.position;
  if (flags.rotation !== undefined) base.inheritRotation = flags.rotation;
  if (flags.scale !== undefined) base.inheritScale = flags.scale;
  if (flags.opacity !== undefined) base.inheritOpacity = flags.opacity;

  const payload = (node.payload ?? {}) as JsonRecord;
  switch (node.type) {
    case "text":
      return {
        ...base,
        payload: {
          content: clone(payload.content),
          ...(payload.fontAssetId !== undefined
            ? { fontAssetId: payload.fontAssetId }
            : {}),
          fontSize: payload.fontSize,
          align: payload.alignment,
          wrap: payload.wrap,
          ...(payload.lineHeight !== undefined
            ? { lineHeight: payload.lineHeight }
            : {}),
          ...(payload.letterSpacing !== undefined
            ? { letterSpacing: payload.letterSpacing }
            : {}),
          ...(payload.maxLines !== undefined
            ? { maxLines: payload.maxLines }
            : {}),
          overflow: payload.overflow,
        },
        style: { fill: payload.color },
      };
    case "image":
    case "svg":
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          ...(payload.fit !== undefined ? { fit: payload.fit } : {}),
          ...(payload.crop !== undefined ? { crop: clone(payload.crop) } : {}),
        },
      };
    case "video":
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          ...(payload.fit !== undefined ? { fit: payload.fit } : {}),
          ...(payload.trimStart !== undefined
            ? { trimStart: payload.trimStart }
            : {}),
          ...(payload.trimEnd !== undefined
            ? { trimEnd: payload.trimEnd }
            : {}),
          ...(payload.loop !== undefined ? { loop: payload.loop } : {}),
          ...(payload.muted !== undefined ? { muted: payload.muted } : {}),
          ...(payload.framePolicy !== undefined
            ? { framePolicy: payload.framePolicy }
            : {}),
        },
      };
    case "camera":
      return {
        ...base,
        payload: {
          zoom: (payload.zoom as number | undefined) ?? 1,
          ...(payload.projection !== undefined
            ? { projection: payload.projection }
            : {}),
          ...(payload.parallaxStrength !== undefined
            ? { parallaxStrength: payload.parallaxStrength }
            : {}),
          ...(payload.fieldOfView !== undefined
            ? { fov: payload.fieldOfView }
            : {}),
          ...(payload.near !== undefined ? { near: payload.near } : {}),
          ...(payload.far !== undefined ? { far: payload.far } : {}),
        },
      };
    case "solid":
      return {
        ...base,
        payload: {
          width: payload.width,
          height: payload.height,
          color: payload.color,
        },
      };
    case "group":
      return {
        ...base,
        payload: {
          ...(payload.compositing
            ? { compositing: clone(payload.compositing) }
            : {}),
        },
      };
    case "bone":
      return {
        ...base,
        payload: clone(node.payload),
      };
    case "adjustment":
      return {
        ...base,
        payload: {
          ...(payload.brightness !== undefined
            ? { brightness: payload.brightness }
            : {}),
          ...(payload.contrast !== undefined
            ? { contrast: payload.contrast }
            : {}),
          ...(payload.saturation !== undefined
            ? { saturation: payload.saturation }
            : {}),
        },
      };
    case "shape":
      return {
        ...base,
        payload: clone(node.payload),
        ...(node.style ? { style: clone(node.style) } : {}),
      };
    case "path":
      return {
        ...base,
        payload: clone(node.payload),
        ...(node.style ? { style: clone(node.style) } : {}),
      };
    case "component":
      // Component nodes are expanded before runtime preparation; this
      // fallback keeps a missing-component node from producing undefined.
      return {
        ...base,
        payload: clone(node.payload),
      };
  }
}

type V3SceneClip = NonNullable<V3.SceneDefinitionV3["clips"]>[number];

function prepareRuntimeClip(clip: V3SceneClip): JsonRecord {
  return clone(clip);
}

type ComponentInstanceRef = {
  componentNodeId: string;
  componentId: string;
  runtimeSceneId: string;
};

function expectedVariableTypeForPropKind(
  kind: string,
): string | undefined {
  switch (kind) {
    case "text":
    case "choice":
      return "string";
    case "color":
      return "color";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "asset":
      return "asset";
    default:
      return undefined;
  }
}

type ResolvedLayerTarget = {
  instancePrefix: string;
  layerId: string;
  property: string;
};

function resolvePropTargets(
  components: Map<string, V3.ComponentDefinitionV3>,
  component: V3.ComponentDefinitionV3,
  propId: string,
  instancePrefix: string,
  stack: Set<string> = new Set(),
): ResolvedLayerTarget[] {
  const cycleKey = `${component.id}::${propId}`;
  if (stack.has(cycleKey)) return [];
  const nextStack = new Set(stack);
  nextStack.add(cycleKey);

  const out: ResolvedLayerTarget[] = [];
  for (const binding of component.propBindings) {
    if (binding.propId !== propId) continue;
    const target = binding.target;
    if (target.kind === "layerProperty") {
      out.push({
        instancePrefix,
        layerId: target.layerId,
        property: target.property,
      });
      continue;
    }
    const childNode = component.nodes.find(
      (node) => node.id === target.childId,
    );
    if (!childNode || childNode.type !== "component") continue;
    const childDef = components.get(childNode.payload.componentId);
    if (!childDef) continue;
    out.push(
      ...resolvePropTargets(
        components,
        childDef,
        target.propId,
        `${instancePrefix}__${childNode.id}`,
        nextStack,
      ),
    );
  }
  return out;
}

function isKeyframesPropValue(
  value: unknown,
): value is {
  kind: "keyframes";
  keys: Array<{ t: number; value: unknown; easing?: unknown }>;
  interpolation?: string;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "keyframes" &&
    Array.isArray((value as { keys?: unknown }).keys)
  );
}

function resolveComponentPropValues(
  component: V3.ComponentDefinitionV3,
  payload: V3.ComponentNodeV3["payload"],
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const prop of component.props) {
    resolved[prop.id] = prop.default;
  }
  const variant = payload.variantId
    ? component.variants.find((v) => v.id === payload.variantId)
    : undefined;
  if (variant) {
    Object.assign(resolved, variant.props);
  }
  Object.assign(resolved, payload.props ?? {});
  return resolved;
}

function applyComponentPropForwards(
  component: V3.ComponentDefinitionV3,
  internalNodes: V3.NodeV3[],
  resolvedProps: Record<string, unknown>,
): V3.NodeV3[] {
  return internalNodes.map((node) => {
    if (node.type !== "component") return node;
    const forwarded: Record<string, unknown> = {
      ...(node.payload.props ?? {}),
    };
    for (const binding of component.propBindings) {
      if (
        binding.target.kind === "childProp" &&
        binding.target.childId === node.id &&
        binding.propId in resolvedProps
      ) {
        forwarded[binding.target.propId] = resolvedProps[binding.propId];
      }
    }
    return {
      ...node,
      payload: {
        ...node.payload,
        props: forwarded as V3.ComponentNodeV3["payload"]["props"],
      },
    };
  });
}

function buildPropKeyframeClip(
  instanceId: string,
  propId: string,
  layer: Extract<
    V3.ComponentPropBindingV3["target"],
    { kind: "layerProperty" }
  >,
  keyframes: {
    keys: Array<{ t: number; value: unknown; easing?: unknown }>;
    interpolation?: string;
  },
  propKind: string,
): JsonRecord {
  const targetId = `${instanceId}__${layer.layerId}`;
  const valueKind =
    propKind === "number"
      ? "number"
      : propKind === "color"
        ? "color"
        : propKind === "boolean"
          ? "boolean"
          : "string";
  return {
    id: `${instanceId}__prop__${propId}__${layer.layerId}`,
    targetId,
    schedule: { kind: "absolute", at: 0 },
    duration: Math.max(
      ...keyframes.keys.map((k) => k.t),
      0,
    ),
    playback: { rate: 1, iterations: 1, direction: "normal" },
    source: {
      kind: "tracks",
      tracks: [
        {
          targetId,
          property: layer.property,
          valueKind,
          keys: keyframes.keys.map((k) => ({
            t: k.t,
            v: k.value,
            ...(k.easing !== undefined ? { easing: k.easing } : {}),
          })),
        },
      ],
    },
  };
}

type ExpandComponentResult = {
  nodes: V3.NodeV3[];
  wrapperId: string;
  propClips: JsonRecord[];
};

function expandOneComponentInstance(
  instanceNode: V3.ComponentNodeV3,
  instanceId: string,
  parentId: string | null,
  components: Map<string, V3.ComponentDefinitionV3>,
  runtimeSceneId: string | null,
  componentInstances: Map<string, ComponentInstanceRef> | null,
): ExpandComponentResult {
  const component = components.get(instanceNode.payload.componentId);
  if (!component) {
    return { nodes: [instanceNode], wrapperId: instanceId, propClips: [] };
  }

  if (componentInstances && runtimeSceneId) {
    componentInstances.set(instanceId, {
      componentNodeId: instanceId,
      componentId: instanceNode.payload.componentId,
      runtimeSceneId,
    });
  }

  const resolvedProps = resolveComponentPropValues(
    component,
    instanceNode.payload,
  );
  const wrapperId = `${instanceId}__instance`;
  const processedInternals = applyComponentPropForwards(
    component,
    component.nodes,
    resolvedProps,
  );

  const propClips: JsonRecord[] = [];
  const expandedInternals: V3.NodeV3[] = [];
  for (const internal of processedInternals) {
    if (internal.type === "component") {
      const nestedInstanceId = `${instanceId}__${internal.id}`;
      const nestedParentId =
        internal.parentId === null || internal.parentId === undefined
          ? wrapperId
          : `${instanceId}__${internal.parentId}`;
      const nested = expandOneComponentInstance(
        internal,
        nestedInstanceId,
        nestedParentId,
        components,
        null,
        null, // nested instances are not scene-level; skip global bindings
      );
      const nestedWrapper = nested.nodes.find((n) => n.id === nested.wrapperId);
      if (nestedWrapper && nestedWrapper.type === "group") {
        nestedWrapper.parentId = nestedParentId;
      }
      expandedInternals.push(...nested.nodes);
      propClips.push(...nested.propClips);
      continue;
    }

    const cloned = clone(internal) as V3.NodeV3;
    cloned.id = `${instanceId}__${internal.id}`;
    cloned.parentId =
      internal.parentId === null || internal.parentId === undefined
        ? wrapperId
        : `${instanceId}__${internal.parentId}`;
    for (const binding of component.propBindings) {
      if (
        binding.target.kind !== "layerProperty" ||
        binding.target.layerId !== internal.id ||
        !(binding.propId in resolvedProps)
      ) {
        continue;
      }
      const value = resolvedProps[binding.propId];
      if (isKeyframesPropValue(value)) {
        const prop = component.props.find((p) => p.id === binding.propId);
        propClips.push(
          buildPropKeyframeClip(
            instanceId,
            binding.propId,
            binding.target,
            value,
            prop?.kind ?? "number",
          ),
        );
        // Apply first key value as initial static so frame 0 is defined.
        const first = value.keys[0];
        if (first) {
          setPropertyPath(
            cloned as unknown as Record<string, unknown>,
            binding.target.property,
            first.value,
          );
        }
      } else {
        setPropertyPath(
          cloned as unknown as Record<string, unknown>,
          binding.target.property,
          value,
        );
      }
    }
    expandedInternals.push(cloned);
  }

  const wrapper = {
    id: wrapperId,
    type: "group" as const,
    parentId,
    transform: clone(instanceNode.transform),
    visible: instanceNode.visible,
    payload: { compositing: { mode: "pass-through" as const } },
    ...(instanceNode.name ? { name: instanceNode.name } : {}),
    ...(instanceNode.zIndex !== undefined ? { zIndex: instanceNode.zIndex } : {}),
    ...(instanceNode.timing ? { timing: clone(instanceNode.timing) } : {}),
    ...(instanceNode.semantic ? { semantic: clone(instanceNode.semantic) } : {}),
    ...(instanceNode.effects ? { effects: clone(instanceNode.effects) } : {}),
    ...(instanceNode.blendMode ? { blendMode: instanceNode.blendMode } : {}),
    ...(instanceNode.mask ? { mask: clone(instanceNode.mask) } : {}),
    ...(instanceNode.inheritFlags
      ? { inheritFlags: clone(instanceNode.inheritFlags) }
      : {}),
    ...(instanceNode.modifiers ? { modifiers: clone(instanceNode.modifiers) } : {}),
  } as V3.NodeV3;

  return { nodes: [wrapper, ...expandedInternals], wrapperId, propClips };
}

/**
 * Remap scene tracks that animate `payload.props.<propId>` on a component
 * instance into tracks targeting the internal layerProperty node.
 */
function remapPayloadPropTracks(
  clip: V3SceneClip,
  components: Map<string, V3.ComponentDefinitionV3>,
  sceneNodes: V3.NodeV3[],
): JsonRecord {
  const cloned = clone(clip) as JsonRecord;
  const source = cloned.source as
    | { kind: string; tracks?: Array<Record<string, unknown>> }
    | undefined;
  if (!source || source.kind !== "tracks" || !Array.isArray(source.tracks)) {
    return cloned;
  }
  const targetId =
    typeof cloned.targetId === "string" ? cloned.targetId : undefined;
  const componentNode = sceneNodes.find(
    (n) => n.id === targetId && n.type === "component",
  ) as V3.ComponentNodeV3 | undefined;
  if (!componentNode) return cloned;

  const component = components.get(componentNode.payload.componentId);
  if (!component) return cloned;

  const remappedTracks: Array<Record<string, unknown>> = [];
  for (const track of source.tracks) {
    if (typeof track.property !== "string") {
      remappedTracks.push(track);
      continue;
    }
    const match = /^payload\.props\.(.+)$/.exec(track.property);
    if (!match) {
      remappedTracks.push(track);
      continue;
    }
    const propId = match[1]!;
    const inline = componentNode.payload.props?.[propId];
    if (isKeyframesPropValue(inline)) continue;
    const leaves = resolvePropTargets(
      components,
      component,
      propId,
      componentNode.id,
    );
    if (leaves.length === 0) {
      remappedTracks.push(track);
      continue;
    }
    for (const leaf of leaves) {
      remappedTracks.push({
        ...clone(track),
        targetId: `${leaf.instancePrefix}__${leaf.layerId}`,
        property: leaf.property,
      });
    }
  }
  source.tracks = remappedTracks;
  if (
    remappedTracks.length === 1 &&
    typeof remappedTracks[0]?.targetId === "string"
  ) {
    cloned.targetId = remappedTracks[0].targetId;
  }
  return cloned;
}

/**
 * Expand `type: "component"` scene nodes into a wrapper group plus the
 * component's internal nodes, with deterministic ids:
 *   - wrapper:          `<componentNodeId>__instance`
 *   - internal node n:  `<componentNodeId>__<n.id>`
 * Consumer `payload.props` resolve through prop defaults, variant.props,
 * then instance overrides, then apply via owner `propBindings`.
 */
function expandComponentNodesV3(
  nodes: V3.NodeV3[],
  components: Map<string, V3.ComponentDefinitionV3>,
  runtimeSceneId: string,
  componentInstances: Map<string, ComponentInstanceRef>,
): {
  nodes: V3.NodeV3[];
  wrapperByNodeId: Map<string, string>;
  propClips: JsonRecord[];
} {
  const out: V3.NodeV3[] = [];
  const wrapperByNodeId = new Map<string, string>();
  const propClips: JsonRecord[] = [];
  for (const node of nodes) {
    if (node.type !== "component") {
      out.push(node);
      continue;
    }
    const expanded = expandOneComponentInstance(
      node,
      node.id,
      node.parentId,
      components,
      runtimeSceneId,
      componentInstances,
    );
    wrapperByNodeId.set(node.id, expanded.wrapperId);
    out.push(...expanded.nodes);
    propClips.push(...expanded.propClips);
  }
  return { nodes: out, wrapperByNodeId, propClips };
}

/** Remap component-node ids to wrapper ids in a scene-local motion clip. */
function remapSceneClipTargets(
  clip: V3SceneClip,
  wrapperByNodeId: Map<string, string>,
): JsonRecord {
  const cloned = clone(clip) as JsonRecord;
  if (
    typeof cloned.targetId === "string" &&
    wrapperByNodeId.has(cloned.targetId)
  ) {
    cloned.targetId = wrapperByNodeId.get(cloned.targetId)!;
  }
  const source = cloned.source as
    | { kind: string; tracks?: Array<Record<string, unknown>> }
    | undefined;
  if (source && source.kind === "tracks" && Array.isArray(source.tracks)) {
    for (const track of source.tracks) {
      if (
        typeof track.targetId === "string" &&
        wrapperByNodeId.has(track.targetId)
      ) {
        track.targetId = wrapperByNodeId.get(track.targetId)!;
      }
    }
  }
  return cloned;
}

function prepareRuntimeScene(
  scene: V3.SceneDefinitionV3,
  components: Map<string, V3.ComponentDefinitionV3>,
  componentInstances: Map<string, ComponentInstanceRef>,
  runtimeSceneId: string,
): JsonRecord {
  const {
    nodes: expandedNodes,
    wrapperByNodeId,
    propClips,
  } = expandComponentNodesV3(
    scene.nodes,
    components,
    runtimeSceneId,
    componentInstances,
  );
  const remappedClips = (scene.clips ?? []).map((clip) =>
    remapSceneClipTargets(
      remapPayloadPropTracks(clip, components, scene.nodes) as V3SceneClip,
      wrapperByNodeId,
    ),
  );
  const result: JsonRecord = {
    id: runtimeSceneId,
    duration: scene.duration,
    nodes: expandedNodes.map((node) => {
      const prepared = prepareRuntimeNode(node);
      // Remap mask sources that reference a component node to its wrapper.
      const mask = (prepared as { mask?: { sourceNodeId?: string } }).mask;
      if (
        mask &&
        typeof mask.sourceNodeId === "string" &&
        wrapperByNodeId.has(mask.sourceNodeId)
      ) {
        mask.sourceNodeId = wrapperByNodeId.get(mask.sourceNodeId)!;
      }
      return prepared;
    }),
    clips: [...remappedClips, ...propClips],
  };
  if (scene.name) result.name = scene.name;
  if (scene.semantic) result.semantic = scene.semantic;
  if (scene.space) result.space = scene.space;
  if (scene.markers) result.markers = clone(scene.markers);
  if (scene.motionBlur) result.motionBlur = clone(scene.motionBlur);
  if (scene.drivers && scene.drivers.length > 0) {
    result.drivers = scene.drivers.map((driver) => {
      const cloned = clone(driver) as JsonRecord;
      if (
        typeof cloned.targetNodeId === "string" &&
        wrapperByNodeId.has(cloned.targetNodeId)
      ) {
        cloned.targetNodeId = wrapperByNodeId.get(cloned.targetNodeId)!;
      }
      return cloned;
    });
  }
  if (scene.activeCameraId) result.activeCameraId = scene.activeCameraId;
  return result;
}

function prepareRuntimeAudioTrack(track: V3.AudioTrackV3): JsonRecord {
  return {
    id: track.id,
    order: track.order,
    ...(track.muted ? { muted: track.muted } : {}),
    clips: track.clips.map((clip) => ({
      id: clip.id,
      assetId: clip.assetId,
      start: clip.start,
      duration: clip.duration,
      trimStart: clip.trimStart,
      ...(clip.trimEnd !== undefined ? { trimEnd: clip.trimEnd } : {}),
      playbackRate: clip.playbackRate,
      volume: clip.volume,
      loop: clip.loop,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
      muted: clip.muted,
    })),
  };
}

function prepareRuntimeAsset(asset: V3.AssetV3): JsonRecord {
  switch (asset.assetType) {
    case "image": {
      const pixelFormat = asset.pixelFormat ?? "rgba";
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "image",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        pixelFormat,
        hasAlpha: asset.hasAlpha ?? pixelFormatHasAlpha(pixelFormat),
      };
    }
    case "svg":
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "svg",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        viewBox: asset.viewBox ?? `0 0 ${asset.width} ${asset.height}`,
        sanitized: true,
      };
    case "video": {
      const hasAudio = Boolean(
        asset.audioCodec || asset.audioSampleRate || asset.audioChannels,
      );
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "video",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        fps: asset.fps,
        videoCodec: asset.codec ?? "h264",
        pixelFormat: asset.pixelFormat ?? "yuv420p",
        hasAudio,
        ...(hasAudio
          ? {
              audioCodec: asset.audioCodec ?? "aac",
              sampleRate: asset.audioSampleRate ?? 48000,
              channels: asset.audioChannels ?? 2,
            }
          : {}),
      };
    }
    case "audio":
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "audio",
        mimeType: asset.mimeType,
        duration: asset.duration,
        codec: asset.codec ?? "mp3",
        sampleRate: asset.sampleRate,
        channels: asset.channels,
      };
    case "font":
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "font",
        mimeType: asset.mimeType,
        family: asset.family,
        weight: asset.weight,
        style: asset.style,
        localeCoverage: asset.localeCoverage ?? ["vi"],
      };
  }
}

// ── Visual plan ───────────────────────────────────────────────────────

type VisualPlanEntry = {
  clipId: string;
  sceneId: string;
  /** Authoring clip start carried into runtime (timeline time). */
  start: number;
  /** V3 clip fields propagated to runtime. */
  trimStart?: number;
  playbackRate?: number;
  loop: boolean;
  opacity: number;
};

type VisualPlanTrack = {
  trackId: string;
  order: number;
  muted?: boolean;
  entries: VisualPlanEntry[];
};

/**
 * Convert `timeline.visualTracks` into a track-preserving visual plan.
 *
 * Each V3 track becomes one runtime track. Track stacking is `order` only.
 * Visual clips are scene-only; component instances live as scene nodes and
 * expand into sealed wrapper-group subgraphs during scene preparation.
 */
function buildVisualPlan(
  project: V3.MotionProjectV3,
  collector: DiagnosticCollector,
): {
  tracks: VisualPlanTrack[];
  sceneOverrides: Map<string, JsonRecord>;
  componentInstances: Map<string, ComponentInstanceRef>;
} {
  const scenes = new Map(
    project.scenes.map((scene) => [scene.id, scene] as const),
  );
  const components = new Map(
    project.components.map((component) => [component.id, component] as const),
  );
  const sceneUsage = new Map<string, number>();
  const componentInstances = new Map<string, ComponentInstanceRef>();
  const sceneOverrides = new Map<string, JsonRecord>();
  const tracks: VisualPlanTrack[] = [];

  const v3Tracks = [...project.timeline.visualTracks].sort(
    (a, b) => a.order - b.order,
  );
  const hasVisualClips = v3Tracks.some((track) => track.clips.length > 0);
  if (!hasVisualClips) {
    collector.error(
      "CMP_TIMELINE_VISUAL_EMPTY",
      "Timeline has no visual clips; add at least one visual clip or remove scenes that should not render",
      {
        path: ["timeline", "visualTracks"],
      },
    );
    return { tracks, sceneOverrides, componentInstances };
  }
  for (const v3Track of v3Tracks) {
    const trackEntries: VisualPlanEntry[] = [];
    for (const clip of v3Track.clips) {
      const sourceScene = scenes.get(clip.source.sceneId);
      if (!sourceScene) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Visual clip "${clip.id}" references unknown scene "${clip.source.sceneId}"`,
          {
            path: ["timeline", "visualTracks", v3Track.id, "clips", clip.id],
            details: { clipId: clip.id, sceneId: clip.source.sceneId },
          },
        );
        continue;
      }
      const sourceRefPath = ["scenes", sourceScene.id];

      const usage = sceneUsage.get(sourceScene.id) ?? 0;
      sceneUsage.set(sourceScene.id, usage + 1);
      const reuse =
        usage > 0 ||
        Math.abs(sourceScene.duration - clip.duration) > 1e-9 ||
        clip.trimStart !== undefined;
      const sceneId = reuse ? `${sourceScene.id}@${clip.id}` : sourceScene.id;
      const scene = prepareRuntimeScene(
        sourceScene,
        components,
        componentInstances,
        sceneId,
      );
      if (reuse) {
        scene.duration = clip.duration;
      }
      scene.sourceRef = reuse
        ? {
            projectPath: sourceRefPath,
            sourceModule: clip.id,
          }
        : { projectPath: sourceRefPath };
      sceneOverrides.set(sceneId, scene);
      trackEntries.push({
        clipId: clip.id,
        sceneId,
        start: clip.start,
        trimStart: clip.trimStart,
        playbackRate: clip.playbackRate,
        loop: clip.loop,
        opacity: clip.opacity,
      });
    }
    if (trackEntries.length > 0) {
      tracks.push({
        trackId: v3Track.id,
        order: v3Track.order,
        muted: v3Track.muted,
        entries: trackEntries,
      });
    }
  }
  return { tracks, sceneOverrides, componentInstances };
}

// ── Semantic validation (CMP_* diagnostics) ───────────────────────────

function expectedVariableTypeForProperty(property: string): string | undefined {
  // Exact segment matching — avoid false positives from substring matches.
  const segments = property.toLowerCase().split(".");
  const last = segments[segments.length - 1];
  if (!last) return undefined;
  if (last === "text" || last === "label" || last === "name") return "string";
  if (last.includes("color")) return "color";
  if (
    last === "visible" ||
    last === "enabled" ||
    last === "muted" ||
    last === "loop"
  )
    return "boolean";
  if (
    /^(?:opacity|width|height|scalex|scaley|rotation|x|y|z|fontsize|letterspacing|lineheight|rate|volume|duration|start|end|progress|radius|length|fov|zoom|near|far)$/.test(
      last,
    ) ||
    segments.some((s) =>
      /^(?:opacity|width|height|scale|rotation|fontsize)$/.test(s),
    )
  )
    return "number";
  if (last === "assetid") return "asset";
  return undefined;
}

function validateV3Semantics(
  project: V3.MotionProjectV3,
  collector: DiagnosticCollector,
): void {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const variableIds = new Set(project.variables.map((variable) => variable.id));
  const componentById = new Map(
    project.components.map((component) => [component.id, component] as const),
  );

  // ── Bindings ──
  for (const binding of project.bindings) {
    if (!variableIds.has(binding.source.variableId)) {
      collector.error(
        "CMP_UNRESOLVED_VARIABLE",
        `Binding "${binding.id}" references unknown variable "${binding.source.variableId}"`,
        {
          path: ["bindings", binding.id],
          details: {
            bindingId: binding.id,
            variableId: binding.source.variableId,
          },
        },
      );
      continue;
    }
    const variable = project.variables.find(
      (candidate) => candidate.id === binding.source.variableId,
    )!;
    // Resolve the property path a binding targets, then type-check the
    // bound variable against it.
    const target = binding.target;
    if (target.kind === "component") {
      const component = project.components.find(
        (c) => c.id === target.componentId,
      );
      if (!component) continue;
      const prop = component.props.find((p) => p.id === target.propId);
      if (!prop) continue;
      const expected = expectedVariableTypeForPropKind(prop.kind);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to component "${target.componentId}" prop "${target.propId}" which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              componentId: target.componentId,
              propId: target.propId,
              expected,
            },
          },
        );
      }
    } else if (target.kind === "componentNode") {
      const scene = project.scenes.find(
        (candidate) => candidate.id === target.sceneId,
      );
      const node = scene?.nodes.find(
        (candidate) => candidate.id === target.nodeId,
      );
      const component =
        node?.type === "component"
          ? project.components.find(
              (candidate) => candidate.id === node.payload.componentId,
            )
          : undefined;
      const prop = component?.props.find((p) => p.id === target.propId);
      if (!prop) continue;
      const expected = expectedVariableTypeForPropKind(prop.kind);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to component node "${target.nodeId}" prop "${target.propId}" which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              componentId: component?.id,
              propId: target.propId,
              expected,
            },
          },
        );
      }
    } else {
      const expected = expectedVariableTypeForProperty(target.property);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to "${target.property}" which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              property: target.property,
              expected,
            },
          },
        );
      }
    }
  }

  // ── Scenes: clip targets, presets, asset refs, schedule cycles ──
  for (const scene of project.scenes) {
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    const assetRefs: Array<{ nodeId: string; assetId: string }> = [];
    for (const node of scene.nodes) {
      const payload = node.payload as JsonRecord;
      if (
        (node.type === "image" ||
          node.type === "svg" ||
          node.type === "video") &&
        typeof payload.assetId === "string"
      ) {
        assetRefs.push({ nodeId: node.id, assetId: payload.assetId });
      }
      if (node.type === "text" && node.payload.fontAssetId) {
        assetRefs.push({ nodeId: node.id, assetId: node.payload.fontAssetId });
      }
      if (node.type === "component") {
        const component = componentById.get(node.payload.componentId);
        if (!component) {
          collector.error(
            "CMP_UNRESOLVED_COMPONENT",
            `Scene "${scene.id}" node "${node.id}" references unknown component "${node.payload.componentId}"`,
            {
              path: ["scenes", scene.id, "nodes", node.id],
              details: {
                sceneId: scene.id,
                nodeId: node.id,
                componentId: node.payload.componentId,
              },
            },
          );
        } else if (
          node.payload.variantId &&
          !component.variants.some((v) => v.id === node.payload.variantId)
        ) {
          collector.error(
            "CMP_UNRESOLVED_COMPONENT_VARIANT",
            `Scene "${scene.id}" node "${node.id}" references unknown variant "${node.payload.variantId}" on component "${component.id}"`,
            {
              path: ["scenes", scene.id, "nodes", node.id],
              details: {
                sceneId: scene.id,
                nodeId: node.id,
                componentId: component.id,
                variantId: node.payload.variantId,
              },
            },
          );
        }
      }
    }
    for (const ref of assetRefs) {
      if (!assetIds.has(ref.assetId)) {
        collector.error(
          "CMP_UNRESOLVED_ASSET",
          `Scene "${scene.id}" node "${ref.nodeId}" references unknown asset "${ref.assetId}"`,
          {
            path: ["scenes", scene.id, "nodes", ref.nodeId],
            details: {
              sceneId: scene.id,
              nodeId: ref.nodeId,
              assetId: ref.assetId,
            },
          },
        );
      }
    }
    for (const clip of scene.clips ?? []) {
      if (clip.targetId && !nodeIds.has(clip.targetId)) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Scene "${scene.id}" clip "${clip.id}" references unknown node "${clip.targetId}"`,
          {
            path: ["scenes", scene.id, "clips", clip.id],
            details: {
              sceneId: scene.id,
              clipId: clip.id,
              targetId: clip.targetId,
            },
          },
        );
      }
      if (
        clip.source.kind === "preset" &&
        !isCompiledPreset(clip.source.presetId)
      ) {
        collector.error(
          "CMP_UNRESOLVED_PRESET",
          `Scene "${scene.id}" clip "${clip.id}" references unknown preset "${clip.source.presetId}"`,
          {
            path: ["scenes", scene.id, "clips", clip.id],
            details: {
              sceneId: scene.id,
              clipId: clip.id,
              presetId: clip.source.presetId,
            },
          },
        );
      }
    }
    const cycles = detectScheduleCycles(scene.clips ?? []);
    for (const clipId of cycles) {
      collector.error(
        "CMP_CYCLE_DETECTED",
        `Scene "${scene.id}" clip schedule contains a cycle involving "${clipId}"`,
        {
          path: ["scenes", scene.id, "clips", clipId],
          details: { sceneId: scene.id, clipId },
        },
      );
    }
  }

  // ── Visual tracks ──
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  for (const track of project.timeline.visualTracks) {
    for (const clip of track.clips) {
      if (!sceneIds.has(clip.source.sceneId)) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Visual clip "${clip.id}" references unknown scene "${clip.source.sceneId}"`,
          {
            path: ["timeline", "visualTracks", track.id, "clips", clip.id],
            details: { clipId: clip.id, sceneId: clip.source.sceneId },
          },
        );
      }
    }
  }

  // ── Audio clips: asset refs ──
  for (const track of project.timeline.audioTracks) {
    for (const clip of track.clips) {
      if (!assetIds.has(clip.assetId)) {
        collector.error(
          "CMP_UNRESOLVED_ASSET",
          `Audio clip "${clip.id}" on track "${track.id}" references unknown asset "${clip.assetId}"`,
          {
            path: ["timeline", "audioTracks", track.id, "clips", clip.id],
            details: {
              trackId: track.id,
              clipId: clip.id,
              assetId: clip.assetId,
            },
          },
        );
      }
    }
  }

  // ── Component dependency integrity ──
  const embeddedByKey = new Map(
    project.components.map(
      (component) =>
        [`${component.id}@${component.version}`, component] as const,
    ),
  );
  for (const dep of project.dependencies.components) {
    const embedded = embeddedByKey.get(`${dep.componentId}@${dep.version}`);
    if (!embedded) {
      // Dependency without an embedded definition — only a problem when a
      // visual clip actually instantiates it (checked above). If the dep is
      // unused, the compiler can still proceed.
      continue;
    }
    if (
      dep.integrity &&
      embedded.integrity &&
      dep.integrity !== embedded.integrity
    ) {
      collector.error(
        "CMP_COMPONENT_INTEGRITY_MISMATCH",
        `Component "${dep.componentId}@${dep.version}" integrity mismatch: dependency declares "${dep.integrity}", embedded definition has "${embedded.integrity}"`,
        {
          path: ["dependencies", "components", dep.componentId],
          details: {
            componentId: dep.componentId,
            version: dep.version,
            declaredIntegrity: dep.integrity,
            embeddedIntegrity: embedded.integrity,
          },
        },
      );
    }
  }
}

// ── Compile directly from V3 visual tracks ────────────────────────────

/**
 * Compile a `MotionProjectV3` into the runtime IR with structured
 * diagnostics.
 *
 * Compiles scenes directly from `timeline.visualTracks` — no intermediate
 * project shape is built. Scene ordering is driven by visual track clip
 * order; component clips synthesize runtime scenes from embedded definitions.
 *
 * Returns `{ ok: true, project }` on success or `{ ok: false, diagnostics }`
 * when the project fails semantic validation (CMP_* codes) or the runtime
 * IR cannot be produced.
 */
export function compileMotionProjectV3(
  project: V3.MotionProjectV3,
  options: CompileV3Options = {},
): CompileResult<MotionRuntimeProject> {
  void options;
  const collector = new DiagnosticCollector();

  // Materialize defaults + reject structurally invalid v3 projects.
  const parsed = V3.MotionProjectV3Schema.safeParse(project);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      collector.error("RUNTIME_VALIDATION_ERROR", issue.message, {
        path: issue.path,
        details: { zodCode: issue.code },
      });
    }
    return compileFailure([...collector.diagnostics]);
  }
  let normalized = parsed.data;

  // ── Timeline duration derivation ─────────────────────────────────
  // Authoring input may omit `timeline.duration`. Derive it from the last
  // timeline content end before semantic validation and runtime emit so the
  // emitted runtime IR always carries an explicit duration.
  const durationCanonical = canonicalizeTimelineDurationV3(normalized);
  for (const issue of durationCanonical.issues) {
    collector.warn("CMP_TIMELINE_DURATION_DERIVED", issue.message, {
      path: [issue.path],
    });
  }
  normalized = durationCanonical.project;

  // ── Capability preflight (Phase 11) ──────────────────────────────
  const capabilityCheck = preflightProjectCapabilities(normalized);
  for (const capId of capabilityCheck.undeclared) {
    collector.warn(
      "CAP_UNDECLARED_CAPABILITY",
      `Project uses capability "${capId}" but it is not declared in capabilities.required`,
      {
        path: ["capabilities", "required"],
        details: { capabilityId: capId },
      },
    );
  }
  for (const capId of capabilityCheck.experimentalInUse) {
    collector.error(
      "CAP_EXPERIMENTAL_IN_USE",
      `Project uses experimental capability "${capId}". Opt in via capabilities.experimental or a feature flag.`,
      {
        path: ["capabilities", "experimental"],
        details: { capabilityId: capId },
      },
    );
  }
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  // Semantic validation → CMP_* diagnostics.
  validateV3Semantics(normalized, collector);
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  // Build the visual plan from timeline.visualTracks.
  const { tracks, sceneOverrides, componentInstances } = buildVisualPlan(
    normalized,
    collector,
  );
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  const warnings = [...collector.diagnostics].filter(
    (diagnostic) => diagnostic.severity !== "error",
  );

  try {
    // ── Build runtime shapes directly from V3 project ──

    const comp = normalized.composition;
    const brand: JsonRecord = { name: normalized.metadata.name ?? "Default" };
    if (comp.background !== "#ffffff") {
      brand.primaryColor = comp.background;
    }
    const metadata: JsonRecord = {
      id: normalized.metadata.id,
      name: normalized.metadata.name,
      aspectRatio: deriveAspectRatio(comp.width, comp.height),
      fps: comp.fps,
      locale: "vi-VN",
      brand,
    };
    if (normalized.metadata.industry)
      metadata.industry = normalized.metadata.industry;
    if (normalized.metadata.description)
      metadata.description = normalized.metadata.description;
    if (normalized.metadata.createdAt)
      metadata.createdAt = normalized.metadata.createdAt;
    if (normalized.metadata.updatedAt)
      metadata.updatedAt = normalized.metadata.updatedAt;
    if (comp.safeArea) {
      metadata.safeArea = { platform: "generic", ...comp.safeArea };
    }

    const composition: JsonRecord = {
      width: comp.width,
      height: comp.height,
      fps: comp.fps,
      background: comp.background,
      colorSpace: comp.colorSpace,
      audioSampleRate: comp.audioSampleRate,
      ...(comp.safeArea
        ? { safeArea: { platform: "generic", ...comp.safeArea } }
        : {}),
    };

    const runtimeAssets = normalized.assets.map(prepareRuntimeAsset);

    // Project variables for binding injection
    const projectVariables = new Map<string, unknown>(
      normalized.variables.map((v) => [v.id, clone(v.value)] as const),
    );

    // Component instances tracked during buildVisualPlan: componentNodeId →
    // { componentId, runtimeSceneId }. Bindings resolve through these to the
    // expanded internal node ids (`<componentNodeId>__<internalNodeId>`).
    const components = new Map(
      normalized.components.map((c) => [c.id, c] as const),
    );

    const runtimeBindings: Array<{
      id: string;
      source: { variableId: string };
      target: { sceneId: string; nodeId: string; property: string };
    }> = [];
    for (const binding of normalized.bindings) {
      const target = binding.target;
      if (target.kind === "scene") {
        runtimeBindings.push({
          id: binding.id,
          source: { variableId: binding.source.variableId },
          target: {
            sceneId: target.sceneId,
            nodeId: target.nodeId,
            property: toRuntimeProperty(target.property),
          },
        });
        continue;
      }
      if (target.kind === "componentNode") {
        const instance = componentInstances.get(target.nodeId);
        if (!instance) {
          collector.warn(
            "CMP_UNRESOLVED_COMPONENT",
            `Binding "${binding.id}" targets component node "${target.nodeId}" but no component instance exists at that node`,
            {
              path: ["bindings", binding.id],
              details: { bindingId: binding.id, nodeId: target.nodeId },
            },
          );
          continue;
        }
        const component = components.get(instance.componentId);
        const leaves = component
          ? resolvePropTargets(
              components,
              component,
              target.propId,
              instance.componentNodeId,
            )
          : [];
        if (leaves.length === 0) {
          collector.error(
            "CMP_PRIVATE_COMPONENT_ACCESS",
            `Binding "${binding.id}" targets component node "${target.nodeId}" prop "${target.propId}" which has no layerProperty binding`,
            {
              path: ["bindings", binding.id],
              details: {
                bindingId: binding.id,
                componentId: instance.componentId,
                propId: target.propId,
              },
            },
          );
          continue;
        }
        leaves.forEach((leaf, index) => {
          runtimeBindings.push({
            id: leaves.length > 1 ? `${binding.id}__${index}` : binding.id,
            source: { variableId: binding.source.variableId },
            target: {
              sceneId: instance.runtimeSceneId,
              nodeId: `${leaf.instancePrefix}__${leaf.layerId}`,
              property: toRuntimeProperty(leaf.property),
            },
          });
        });
        continue;
      }
      // Global component binding — scene-level instances only.
      // Nested instances are not registered in componentInstances; they
      // receive values only via parent childProp forwards.
      const instances = [...componentInstances.values()].filter(
        (instance) => instance.componentId === target.componentId,
      );
      if (instances.length === 0) {
        collector.warn(
          "CMP_UNRESOLVED_COMPONENT",
          `Binding "${binding.id}" targets component "${target.componentId}" but no component node instantiates it`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              componentId: target.componentId,
            },
          },
        );
        continue;
      }
      const component = components.get(target.componentId);
      const instanceLeaves = instances.map((instance) => ({
        instance,
        leaves: component
          ? resolvePropTargets(
              components,
              component,
              target.propId,
              instance.componentNodeId,
            )
          : [],
      }));
      if (instanceLeaves.every((entry) => entry.leaves.length === 0)) {
        collector.error(
          "CMP_PRIVATE_COMPONENT_ACCESS",
          `Binding "${binding.id}" targets component "${target.componentId}" prop "${target.propId}" which has no layerProperty binding`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              componentId: target.componentId,
              propId: target.propId,
            },
          },
        );
        continue;
      }
      const flat = instanceLeaves.flatMap(({ instance, leaves }) =>
        leaves.map((leaf) => ({ instance, leaf })),
      );
      flat.forEach((entry, index) => {
        runtimeBindings.push({
          id: flat.length > 1 ? `${binding.id}__${index}` : binding.id,
          source: { variableId: binding.source.variableId },
          target: {
            sceneId: entry.instance.runtimeSceneId,
            nodeId: `${entry.leaf.instancePrefix}__${entry.leaf.layerId}`,
            property: toRuntimeProperty(entry.leaf.property),
          },
        });
      });
    }

    // Fail early if binding resolution produced errors.
    if (collector.hasErrors) {
      return compileFailure([...collector.diagnostics]);
    }

    // Compile each scene from the visual plan (flat across all tracks).
    const allEntries = tracks.flatMap((t) => t.entries);
    const compiledScenes = allEntries.map((entry) => {
      const scene = sceneOverrides.get(entry.sceneId);
      if (!scene) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Scene "${entry.sceneId}" in visual plan but missing from overrides`,
          {
            path: ["timeline", "visualTracks"],
            details: { sceneId: entry.sceneId },
          },
        );
        throw new Error(`Missing scene: ${entry.sceneId}`);
      }
      const variables = new Map(projectVariables);

      const sceneBindings = runtimeBindings.filter(
        (b) => b.target.sceneId === entry.sceneId,
      );
      for (const binding of sceneBindings) {
        const nodes = (scene.nodes ?? []) as Array<Record<string, unknown>>;
        const target = nodes.find(
          (n: Record<string, unknown>) => n.id === binding.target.nodeId,
        );
        if (target && variables.has(binding.source.variableId)) {
          const parts = binding.target.property.split(".");
          let cursor: Record<string, unknown> = target;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]!;
            if (!cursor[part] || typeof cursor[part] !== "object") {
              cursor[part] = {};
            }
            cursor = cursor[part] as Record<string, unknown>;
          }
          const last = parts[parts.length - 1]!;
          cursor[last] = variables.get(binding.source.variableId);
        }
      }

      return compileSceneToRuntime({
        id: scene.id as string,
        duration: scene.duration as number,
        nodes: (scene.nodes ?? []) as Parameters<
          typeof compileSceneToRuntime
        >[0]["nodes"],
        clips: (scene.clips ?? []) as Parameters<
          typeof compileSceneToRuntime
        >[0]["clips"],
        variables,
        markers: scene.markers as Array<{ id: string; t: number }> | undefined,
        space: scene.space as
          | Parameters<typeof compileSceneToRuntime>[0]["space"]
          | undefined,
        motionBlur: scene.motionBlur as
          | Parameters<typeof compileSceneToRuntime>[0]["motionBlur"]
          | undefined,
        drivers: scene.drivers as
          | Parameters<typeof compileSceneToRuntime>[0]["drivers"]
          | undefined,
        activeCameraId: scene.activeCameraId as string | undefined,
        sourceRef: scene.sourceRef as
          | NonNullable<
              Parameters<typeof compileSceneToRuntime>[0]["sourceRef"]
            >
          | undefined,
      });
    });

    // Build visualTracks runtime model — one runtime track per V3 track.
    const visualTracks = tracks.map((planTrack) => {
      const clips = planTrack.entries.map((entry) => {
        const scene = sceneOverrides.get(entry.sceneId)!;
        const duration = scene.duration as number;
        const clip: Record<string, unknown> = {
          id: entry.clipId,
          source: { kind: "scene" as const, sceneId: entry.sceneId },
          start: entry.start,
          duration,
        };
        if (entry.trimStart !== undefined) clip.trimStart = entry.trimStart;
        if (entry.playbackRate !== undefined)
          clip.playbackRate = entry.playbackRate;
        if (entry.loop !== false) clip.loop = entry.loop;
        if (entry.opacity !== 1) clip.opacity = entry.opacity;
        return clip;
      });
      return {
        id: planTrack.trackId,
        order: planTrack.order,
        ...(planTrack.muted !== undefined && planTrack.muted !== false
          ? { muted: planTrack.muted }
          : {}),
        clips,
      };
    });

    const sourceRefIndex: Record<string, string> = {};
    for (const scene of compiledScenes) {
      const srcRef = scene.sourceRef;
      if (!srcRef) continue;
      sourceRefIndex[scene.id] = srcRef.sourceModule
        ? `${srcRef.projectPath.join(":")}#${srcRef.sourceModule}`
        : srcRef.projectPath.join(":");
    }

    const ir = {
      format: "motion-runtime" as const,
      formatVersion: 3 as const,
      runtimeVersion: MOTION_RUNTIME_VERSION,
      metadata,
      assets: runtimeAssets,
      composition,
      compilerVersion: COMPILER_VERSION_V3,
      capabilityFingerprint: buildCapabilityFingerprint(
        CAPABILITY_MANIFEST_VERSION_V3,
      ),
      timeline: {
        duration: normalized.timeline.duration,
        audioTracks: normalized.timeline.audioTracks.map(
          prepareRuntimeAudioTrack,
        ),
        captionTracks: clone(normalized.timeline.captionTracks),
        visualTracks,
      },
      sourceRef: { scenes: sourceRefIndex },
      scenes: compiledScenes,
    };

    const validated = MotionRuntimeProjectSchema.parse({
      ...ir,
      runtimeHash: computeRuntimeHash(ir as unknown as Record<string, unknown>),
    });

    return compileSuccess(validated, warnings);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const zodErr = err as {
        issues: Array<{
          path: (string | number)[];
          message: string;
          code: string;
        }>;
      };
      for (const issue of zodErr.issues) {
        collector.error("RUNTIME_VALIDATION_ERROR", issue.message, {
          path: issue.path,
          details: { zodCode: issue.code },
        });
      }
    } else if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("Unknown variable reference")) {
        collector.error("UNKNOWN_VARIABLE", msg);
      } else if (msg.includes("Unknown clip target")) {
        collector.error("UNKNOWN_CLIP_TARGET", msg);
      } else if (msg.includes("Unknown scene marker")) {
        collector.error("UNKNOWN_MARKER", msg);
      } else {
        collector.error("COMPILE_ERROR", msg);
      }
    }
    return compileFailure([...collector.diagnostics]);
  }
}

// ── Cache key ─────────────────────────────────────────────────────────

// Phase 11: canonicalJson imported from motion-protocol

/**
 * Deterministic cache key for a v3 compile.
 *
 * Key = projectHash | compilerVersion | protocolVersion | capabilities |
 *       componentDependencyHashes.
 *
 * Phase 12: Uses computeProjectHash (strips provenance/extensions/timestamps)
 * and MOTION_PROJECT_V3_FORMAT_VERSION instead of hardcoded "3".
 */
export function buildCompileCacheKeyV3(
  project: V3.MotionProjectV3,
  options: CompileV3Options = {},
): string {
  const parsed = V3.MotionProjectV3Schema.safeParse(project);
  const normalized = parsed.success ? parsed.data : project;

  const projectHash = computeProjectHash(
    normalized as unknown as Record<string, unknown>,
  ).slice(0, 16);

  const capabilitiesHash = createHash("sha256")
    .update(
      canonicalJson({
        required: normalized.capabilities.required ?? [],
        optional: normalized.capabilities.optional ?? [],
        experimental: normalized.capabilities.experimental ?? [],
      }),
    )
    .digest("hex")
    .slice(0, 8);

  const componentDeps = normalized.dependencies.components
    .map((dep) => `${dep.componentId}@${dep.version}:${dep.integrity ?? ""}`)
    .sort()
    .join(",");
  const componentHash = createHash("sha256")
    .update(componentDeps)
    .digest("hex")
    .slice(0, 8);

  const profile = options.profile ?? "embedded-components";
  return [
    `proj:${projectHash}`,
    `compiler:${COMPILER_VERSION_V3}`,
    `protocol:${V3.MOTION_PROJECT_V3_FORMAT_VERSION}`,
    `caps:${capabilitiesHash}`,
    `deps:${componentHash}`,
    `profile:${profile}`,
  ].join("|");
}
