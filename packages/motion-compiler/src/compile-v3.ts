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
 *                            clip, in track order; overlay tracks append)
 *   scene clips            → runtime tracks (compiled directly)
 *   variables / bindings   → resolved inline before scene compilation
 *   component-source clips → synthesized scenes from the embedded
 *                            component definition
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

/**
 * Expand `type: "component"` scene nodes into a wrapper group plus the
 * component's internal nodes, with deterministic ids:
 *   - wrapper:          `<componentNodeId>__instance`
 *   - internal node n:  `<componentNodeId>__<n.id>`
 * Consumer `publicProps` are applied through the component's declared
 * `publicTargets` (targetId -> nodeId.property).
 */
function expandComponentNodesV3(
  nodes: V3.NodeV3[],
  components: Map<string, V3.EmbeddedComponentV3>,
  runtimeSceneId: string,
  componentInstances: Map<string, ComponentInstanceRef>,
): { nodes: V3.NodeV3[]; wrapperByNodeId: Map<string, string> } {
  const out: V3.NodeV3[] = [];
  const wrapperByNodeId = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== "component") {
      out.push(node);
      continue;
    }
    componentInstances.set(node.id, {
      componentNodeId: node.id,
      componentId: node.payload.componentId,
      runtimeSceneId,
    });
    const component = components.get(node.payload.componentId);
    if (!component) {
      // Semantic validation flags the missing component; keep the node
      // passthrough so compilation can surface a diagnostic instead of
      // dropping content.
      out.push(node);
      continue;
    }

    const wrapperId = `${node.id}__instance`;
    wrapperByNodeId.set(node.id, wrapperId);
    const internalNodes: V3.NodeV3[] = component.nodes.map((internal) => {
      const cloned = clone(internal) as V3.NodeV3;
      cloned.id = `${node.id}__${internal.id}`;
      cloned.parentId =
        internal.parentId === null || internal.parentId === undefined
          ? wrapperId
          : `${node.id}__${internal.parentId}`;
      return cloned;
    });

    // Apply variant overrides, then consumer publicProps, through the
    // declared public targets. Precedence: component defaults < variant
    // overrides < consumer publicProps.
    const variant = node.payload.variantId
      ? component.variants.find((v) => v.id === node.payload.variantId)
      : undefined;
    const overrides: Record<string, unknown> = {
      ...(variant?.overrides ?? {}),
      ...(node.payload.publicProps ?? {}),
    };
    for (const [targetId, value] of Object.entries(overrides)) {
      const publicTarget = component.publicTargets.find(
        (t) => t.id === targetId,
      );
      if (!publicTarget) continue;
      const targetNode = internalNodes.find(
        (n) => n.id === `${node.id}__${publicTarget.nodeId}`,
      );
      if (!targetNode) continue;
      setPropertyPath(
        targetNode as unknown as Record<string, unknown>,
        publicTarget.property,
        value,
      );
    }

    // The wrapper group inherits the component node's transform, timing,
    // and layout traits so the instance can be placed/animated like a node.
    const wrapper = {
      id: wrapperId,
      type: "group" as const,
      parentId: node.parentId,
      transform: clone(node.transform),
      visible: node.visible,
      payload: { compositing: { mode: "pass-through" as const } },
      ...(node.name ? { name: node.name } : {}),
      ...(node.zIndex !== undefined ? { zIndex: node.zIndex } : {}),
      ...(node.timing ? { timing: clone(node.timing) } : {}),
      ...(node.semantic ? { semantic: node.semantic } : {}),
      ...(node.effects ? { effects: clone(node.effects) } : {}),
      ...(node.blendMode ? { blendMode: node.blendMode } : {}),
      ...(node.mask ? { mask: clone(node.mask) } : {}),
      ...(node.inheritFlags ? { inheritFlags: clone(node.inheritFlags) } : {}),
      ...(node.modifiers ? { modifiers: clone(node.modifiers) } : {}),
    } as V3.NodeV3;
    out.push(wrapper, ...internalNodes);
  }
  return { nodes: out, wrapperByNodeId };
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
  components: Map<string, V3.EmbeddedComponentV3>,
  componentInstances: Map<string, ComponentInstanceRef>,
  runtimeSceneId: string,
): JsonRecord {
  const { nodes: expandedNodes, wrapperByNodeId } = expandComponentNodesV3(
    scene.nodes,
    components,
    runtimeSceneId,
    componentInstances,
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
    clips: (scene.clips ?? []).map((clip) =>
      remapSceneClipTargets(clip, wrapperByNodeId),
    ),
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
    role: track.role,
    assetId: track.assetId,
    start: track.start,
    duration: track.duration,
    trimStart: track.trimStart,
    ...(track.trimEnd !== undefined ? { trimEnd: track.trimEnd } : {}),
    playbackRate: track.playbackRate,
    volume: track.volume,
    loop: track.loop,
    fadeIn: track.fadeIn,
    fadeOut: track.fadeOut,
    muted: track.muted,
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
  transitionIn?: V3.TransitionV3;
  transitionOut?: V3.TransitionV3;
};

type VisualPlanTrack = {
  trackId: string;
  /** V3 "main" → runtime "primary", "overlay" → "overlay". */
  role: "primary" | "overlay";
  order: number;
  muted?: boolean;
  entries: VisualPlanEntry[];
};

/**
 * Convert `timeline.visualTracks` into a track-preserving visual plan.
 *
 * Each V3 track becomes one runtime track.  Clip ordering within a track
 * is preserved; track ordering is controlled by `track.order`.
 *
 * A scene used by multiple clips is cloned (id suffixed with the clip id).
 * Component instances are `type: "component"` scene nodes, expanded into
 * sealed wrapper-group subgraphs during scene preparation.
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
    // Timeline is the source of truth — never synthesize clips from scenes.
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
    // V3 "main" role maps to runtime "primary"
    const runtimeRole = v3Track.role === "main" ? "primary" : v3Track.role;
    for (const clip of v3Track.clips) {
      const source = scenes.get(clip.source.sceneId);
      if (!source) {
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
      const usage = sceneUsage.get(source.id) ?? 0;
      sceneUsage.set(source.id, usage + 1);
      const reuse =
        usage > 0 ||
        Math.abs(source.duration - clip.duration) > 1e-9 ||
        clip.trimStart !== undefined;
      const sceneId = reuse ? `${source.id}@${clip.id}` : source.id;
      const scene = prepareRuntimeScene(
        source,
        components,
        componentInstances,
        sceneId,
      );
      if (reuse) {
        scene.duration = clip.duration;
      }
      scene.sourceRef = reuse
        ? {
            projectPath: ["scenes", source.id],
            sourceModule: clip.id,
          }
        : { projectPath: ["scenes", source.id] };
      sceneOverrides.set(sceneId, scene);
      trackEntries.push({
        clipId: clip.id,
        sceneId,
        start: clip.start,
        trimStart: clip.trimStart,
        playbackRate: clip.playbackRate,
        loop: clip.loop,
        opacity: clip.opacity,
        transitionIn: clip.transitionIn,
        transitionOut: clip.transitionOut,
      });
    }
    if (trackEntries.length > 0) {
      tracks.push({
        trackId: v3Track.id,
        role: runtimeRole as "primary" | "overlay",
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
      if (!component) continue; // already handled by reference validation
      const publicTarget = component.publicTargets.find(
        (pt) => pt.id === target.targetId,
      );
      if (!publicTarget) continue; // already handled by reference validation
      const expected = expectedVariableTypeForProperty(publicTarget.property);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to component "${target.componentId}" publicTarget "${target.targetId}" (property "${publicTarget.property}") which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              componentId: target.componentId,
              targetId: target.targetId,
              property: publicTarget.property,
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
      const publicTarget = component?.publicTargets.find(
        (pt) => pt.id === target.targetId,
      );
      if (!publicTarget) continue; // already handled by reference validation
      const expected = expectedVariableTypeForProperty(publicTarget.property);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to component node "${target.nodeId}" publicTarget "${target.targetId}" (property "${publicTarget.property}") which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              componentId: component?.id,
              targetId: target.targetId,
              property: publicTarget.property,
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

  // ── Audio tracks: asset refs ──
  for (const track of project.timeline.audioTracks) {
    if (!assetIds.has(track.assetId)) {
      collector.error(
        "CMP_UNRESOLVED_ASSET",
        `Audio track "${track.id}" references unknown asset "${track.assetId}"`,
        {
          path: ["timeline", "audioTracks", track.id],
          details: { trackId: track.id, assetId: track.assetId },
        },
      );
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
        const publicTarget = component?.publicTargets.find(
          (pt) => pt.id === target.targetId,
        );
        if (!publicTarget) {
          collector.error(
            "CMP_PRIVATE_COMPONENT_ACCESS",
            `Binding "${binding.id}" targets component node "${target.nodeId}" target "${target.targetId}" which is not declared in publicTargets`,
            {
              path: ["bindings", binding.id],
              details: {
                bindingId: binding.id,
                componentId: instance.componentId,
                targetId: target.targetId,
              },
            },
          );
          continue;
        }
        runtimeBindings.push({
          id: binding.id,
          source: { variableId: binding.source.variableId },
          target: {
            sceneId: instance.runtimeSceneId,
            nodeId: `${instance.componentNodeId}__${publicTarget.nodeId}`,
            property: toRuntimeProperty(publicTarget.property),
          },
        });
        continue;
      }
      // Global component binding — apply to every instance of the component.
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
      const publicTarget = component?.publicTargets.find(
        (pt) => pt.id === target.targetId,
      );
      if (!publicTarget) {
        collector.error(
          "CMP_PRIVATE_COMPONENT_ACCESS",
          `Binding "${binding.id}" targets component "${target.componentId}" target "${target.targetId}" which is not declared in publicTargets`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              componentId: target.componentId,
              targetId: target.targetId,
            },
          },
        );
        continue;
      }
      instances.forEach((instance, index) => {
        runtimeBindings.push({
          id: instances.length > 1 ? `${binding.id}__${index}` : binding.id,
          source: { variableId: binding.source.variableId },
          target: {
            sceneId: instance.runtimeSceneId,
            nodeId: `${instance.componentNodeId}__${publicTarget.nodeId}`,
            property: toRuntimeProperty(publicTarget.property),
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
        if (entry.transitionIn) clip.transitionIn = entry.transitionIn;
        if (entry.transitionOut) clip.transitionOut = entry.transitionOut;
        return clip;
      });
      return {
        id: planTrack.trackId,
        role: planTrack.role as "primary" | "overlay",
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
