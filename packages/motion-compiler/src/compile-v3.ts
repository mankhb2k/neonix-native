/**
 * Phase 5 — Compiler V3 entry point.
 *
 * `compileMotionProjectV3()` compiles a `MotionProjectV3` authoring project
 * into the runtime IR (`MotionRuntimeProject`). The v2 runtime shape
 * is the only serialized runtime contract today (the vNext runtime IR is
 * introduced in Phase 6), so the v3 authoring model is down-migrated onto
 * the proven v2 compile pipeline:
 *
 *   composition            → runtime metadata (aspectRatio derived from
 *                            dimensions, fps, background as brand color)
 *   timeline.visualTracks  → sceneOrder (one scene instance per visual
 *                            clip, in track order; overlay tracks append)
 *   scene clips            → runtime tracks (v2 clip pipeline)
 *   variables / bindings   → resolved by the v2 pipeline
 *   component-source clips → synthesized scenes from the embedded
 *                            component definition
 *   caption tracks         → copied through
 *
 * Semantic problems are reported with the `CMP_*` diagnostic family so
 * callers can surface structured errors instead of string exceptions.
 *
 * Note on options: `textMeasurementProvider` / `assetMetadataProvider`
 * are reserved for Phase 7 (runtime evaluator) — the v2 pipeline uses its
 * own built-in text measurement, so these are accepted but not consumed.
 */

import { createHash } from "node:crypto";
import {
  canonicalJson,
  computeRuntimeHash,
  MotionRuntimeProjectSchema,
  MOTION_RUNTIME_VERSION,
  buildCapabilityFingerprint,
  type MotionProject,
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
import { _compileScenePipeline } from "./index";

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
 * Compiler version for v3 compilation. Distinct from the v2
 * `COMPILER_VERSION` so cache keys never collide across pipelines.
 */
export const COMPILER_VERSION_V3 = "3.0.0-phase5";

// ── Small helpers ─────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

// ── V3 → V2 shape down-migration ──────────────────────────────────────

function downMigrateMetadata(project: V3.MotionProjectV3): JsonRecord {
  const composition = project.composition;
  const brand: JsonRecord = { name: project.metadata.name ?? "Default" };
  if (composition.background !== "#ffffff") {
    brand.primaryColor = composition.background;
  }
  const metadata: JsonRecord = {
    id: project.metadata.id,
    name: project.metadata.name,
    aspectRatio: deriveAspectRatio(composition.width, composition.height),
    fps: composition.fps,
    // v2 metadata pins locale to "vi-VN"; v3 locale is preserved in the
    // project and re-enters the runtime IR in Phase 6.
    locale: "vi-VN",
    brand,
  };
  if (project.metadata.industry) metadata.industry = project.metadata.industry;
  if (project.metadata.description)
    metadata.description = project.metadata.description;
  if (project.metadata.createdAt)
    metadata.createdAt = project.metadata.createdAt;
  if (project.metadata.updatedAt)
    metadata.updatedAt = project.metadata.updatedAt;
  if (composition.safeArea) {
    // v2 safe area requires a `platform` discriminator; v3 is platform
    // agnostic — default to "generic".
    metadata.safeArea = { platform: "generic", ...composition.safeArea };
  }
  return metadata;
}

function downMigrateAsset(asset: V3.AssetV3): JsonRecord {
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

function downMigrateVariable(variable: V3.ProjectVariableV3): JsonRecord {
  const base: JsonRecord = { id: variable.id, name: variable.name };
  switch (variable.type) {
    case "string":
      return { ...base, type: "string", value: variable.value };
    case "color":
      return { ...base, type: "color", value: variable.value };
    case "number":
      return {
        ...base,
        type: "number",
        value: variable.value,
        ...(variable.min !== undefined ? { min: variable.min } : {}),
        ...(variable.max !== undefined ? { max: variable.max } : {}),
      };
    case "boolean":
      return { ...base, type: "boolean", value: variable.value };
    case "asset":
      return {
        ...base,
        type: "asset",
        assetKind: variable.assetKind,
        value: variable.value,
      };
    case "enum":
      return {
        ...base,
        type: "enum",
        value: variable.value,
        options: variable.options,
      };
    case "list": {
      // v2 list fields only carry `type`; strip v3-only metadata.
      const fields: JsonRecord = {};
      for (const [key, field] of Object.entries(variable.itemSchema.fields)) {
        fields[key] = { type: field.type };
      }
      return {
        ...base,
        type: "list",
        itemSchema: { type: "object", fields },
        value: clone(variable.value),
      };
    }
  }
}

function downMigrateNode(node: V3.NodeV3): JsonRecord {
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
      // v2 group payload is empty; `compositing` is not representable.
      return { ...base, payload: {} };
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
  }
}

type V3SceneClip = NonNullable<V3.SceneDefinitionV3["clips"]>[number];

function downMigrateClip(clip: V3SceneClip): JsonRecord {
  return clone(clip);
}

function downMigrateScene(scene: V3.SceneDefinitionV3): JsonRecord {
  const result: JsonRecord = {
    id: scene.id,
    duration: scene.duration,
    nodes: scene.nodes.map((node) => downMigrateNode(node)),
    clips: (scene.clips ?? []).map((clip) => downMigrateClip(clip)),
  };
  if (scene.name) result.name = scene.name;
  if (scene.semantic) result.semantic = scene.semantic;
  if (scene.space) result.space = scene.space;
  if (scene.markers) result.markers = clone(scene.markers);
  if (scene.motionBlur) result.motionBlur = clone(scene.motionBlur);
  if (scene.drivers && scene.drivers.length > 0)
    result.drivers = clone(scene.drivers);
  if (scene.activeCameraId) result.activeCameraId = scene.activeCameraId;
  return result;
}

function downMigrateAudioTrack(track: V3.AudioTrackV3): JsonRecord {
  return {
    id: track.id,
    role: track.role,
    assetId: track.assetId,
    start: track.start,
    trimStart: track.trimStart,
    volume: track.volume,
    loop: track.loop,
    fadeIn: track.fadeIn,
    fadeOut: track.fadeOut,
  };
}

// ── Visual plan ───────────────────────────────────────────────────────

type VisualPlanEntry = {
  clipId: string;
  sceneId: string;
};

/**
 * Flatten `timeline.visualTracks` into an ordered list of runtime scene
 * instances. A scene used by multiple clips is cloned (id suffixed with
 * the clip id); component-source clips synthesize a scene from the
 * embedded component definition.
 */
function buildVisualPlan(
  project: V3.MotionProjectV3,
  collector: DiagnosticCollector,
): { entries: VisualPlanEntry[]; sceneOverrides: Map<string, JsonRecord> } {
  const scenes = new Map(
    project.scenes.map((scene) => [scene.id, scene] as const),
  );
  const components = new Map(
    project.components.map((component) => [component.id, component] as const),
  );
  const sceneUsage = new Map<string, number>();
  const entries: VisualPlanEntry[] = [];
  const sceneOverrides = new Map<string, JsonRecord>();

  const tracks = [...project.timeline.visualTracks].sort(
    (a, b) => a.order - b.order,
  );
  const hasVisualClips = tracks.some((track) => track.clips.length > 0);
  if (!hasVisualClips) {
    // No visual clips → compile every authored scene in declaration order
    // so nothing silently disappears from the runtime IR.
    for (const scene of project.scenes) {
      const entry: VisualPlanEntry = { clipId: scene.id, sceneId: scene.id };
      sceneOverrides.set(scene.id, {
        ...downMigrateScene(scene),
        sourceRef: { projectPath: ["scenes", scene.id] },
      });
      entries.push(entry);
    }
    return { entries, sceneOverrides };
  }
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.source.kind === "scene") {
        const source = scenes.get(clip.source.sceneId);
        if (!source) {
          collector.error(
            "CMP_CLIP_TARGET_MISSING",
            `Visual clip "${clip.id}" references unknown scene "${clip.source.sceneId}"`,
            {
              path: ["timeline", "visualTracks", track.id, "clips", clip.id],
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
        const scene = downMigrateScene(source);
        if (reuse) {
          scene.id = sceneId;
          scene.duration = clip.duration;
        }
        scene.sourceRef = reuse
          ? {
              projectPath: ["scenes", source.id],
              sourceModule: clip.id,
            }
          : { projectPath: ["scenes", source.id] };
        sceneOverrides.set(sceneId, scene);
        entries.push({ clipId: clip.id, sceneId });
        continue;
      }
      // Component-source clip → synthesize a scene from the component.
      const component = components.get(clip.source.componentId);
      if (!component) {
        collector.error(
          "CMP_UNRESOLVED_COMPONENT",
          `Visual clip "${clip.id}" references unknown component "${clip.source.componentId}"`,
          {
            path: ["timeline", "visualTracks", track.id, "clips", clip.id],
            details: { clipId: clip.id, componentId: clip.source.componentId },
          },
        );
        continue;
      }
      const scene: JsonRecord = {
        id: clip.id,
        name: component.id,
        duration: clip.duration,
        nodes: component.nodes.map((node) => downMigrateNode(node)),
        clips: [],
        sourceRef: {
          projectPath: ["components", component.id],
          sourceModule: `${component.id}@${component.version}`,
        },
      };
      sceneOverrides.set(clip.id, scene);
      entries.push({ clipId: clip.id, sceneId: clip.id });
    }
  }
  return { entries, sceneOverrides };
}

// ── Semantic validation (CMP_* diagnostics) ───────────────────────────

function expectedVariableTypeForProperty(property: string): string | undefined {
  const prop = property.toLowerCase();
  if (
    prop.endsWith(".text") ||
    prop.endsWith(".label") ||
    prop.endsWith(".name")
  )
    return "string";
  if (prop.includes("color")) return "color";
  if (
    prop.endsWith(".visible") ||
    prop.endsWith(".enabled") ||
    prop.endsWith(".muted") ||
    prop.endsWith(".loop")
  )
    return "boolean";
  if (
    /(?:opacity|width|height|scale|rotation|x|y|z|fontsize|letterspacing|lineheight|rate|volume|duration|start|end|progress|radius|length|fov|zoom|near|far)$/.test(
      prop,
    )
  )
    return "number";
  if (prop.endsWith("assetid")) return "asset";
  return undefined;
}

function validateV3Semantics(
  project: V3.MotionProjectV3,
  collector: DiagnosticCollector,
): void {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const variableIds = new Set(project.variables.map((variable) => variable.id));

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
    const expected = expectedVariableTypeForProperty(binding.target.property);
    if (expected && variable.type !== expected) {
      collector.error(
        "CMP_BINDING_TYPE_MISMATCH",
        `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to "${binding.target.property}" which expects ${expected}`,
        {
          path: ["bindings", binding.id],
          details: {
            bindingId: binding.id,
            variableType: variable.type,
            property: binding.target.property,
            expected,
          },
        },
      );
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
  const componentIds = new Set(
    project.components.map((component) => component.id),
  );
  for (const track of project.timeline.visualTracks) {
    for (const clip of track.clips) {
      if (clip.source.kind === "scene" && !sceneIds.has(clip.source.sceneId)) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Visual clip "${clip.id}" references unknown scene "${clip.source.sceneId}"`,
          {
            path: ["timeline", "visualTracks", track.id, "clips", clip.id],
            details: { clipId: clip.id, sceneId: clip.source.sceneId },
          },
        );
      }
      if (
        clip.source.kind === "component" &&
        !componentIds.has(clip.source.componentId)
      ) {
        collector.error(
          "CMP_UNRESOLVED_COMPONENT",
          `Visual clip "${clip.id}" references unknown component "${clip.source.componentId}"`,
          {
            path: ["timeline", "visualTracks", track.id, "clips", clip.id],
            details: { clipId: clip.id, componentId: clip.source.componentId },
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

// ── Down-migrate to v2 project shape ──────────────────────────────────

function downMigrateProject(
  project: V3.MotionProjectV3,
  collector: DiagnosticCollector,
): MotionProject {
  const { entries, sceneOverrides } = buildVisualPlan(project, collector);

  const scenes: JsonRecord[] = [];
  const sceneIdSet = new Set<string>();
  for (const entry of entries) {
    const scene = sceneOverrides.get(entry.sceneId);
    if (!scene || sceneIdSet.has(entry.sceneId)) continue;
    sceneIdSet.add(entry.sceneId);
    scenes.push(scene);
  }

  // Remap bindings: component-target bindings resolve to the synthesized
  // scene id (the clip that instantiates the component).
  const clipIdForComponent = new Map<string, string>();
  for (const track of project.timeline.visualTracks) {
    for (const clip of track.clips) {
      if (clip.source.kind === "component") {
        clipIdForComponent.set(clip.source.componentId, clip.id);
      }
    }
  }

  const bindings: JsonRecord[] = [];
  for (const binding of project.bindings) {
    if (binding.target.kind === "scene") {
      // v2 text normalization deletes `payload.text` when `content` is
      // present, so text bindings target `payload.content.text` instead.
      const property =
        binding.target.property === "payload.text"
          ? "payload.content.text"
          : binding.target.property;
      bindings.push({
        id: binding.id,
        source: { kind: "variable", variableId: binding.source.variableId },
        target: {
          sceneId: binding.target.sceneId,
          nodeId: binding.target.nodeId,
          property,
        },
      });
      continue;
    }
    const sceneId = clipIdForComponent.get(binding.target.componentId);
    if (!sceneId) {
      collector.warn(
        "CMP_UNRESOLVED_COMPONENT",
        `Binding "${binding.id}" targets component "${binding.target.componentId}" but no visual clip instantiates it`,
        {
          path: ["bindings", binding.id],
          details: {
            bindingId: binding.id,
            componentId: binding.target.componentId,
          },
        },
      );
      continue;
    }
    bindings.push({
      id: binding.id,
      source: { kind: "variable", variableId: binding.source.variableId },
      target: {
        sceneId,
        nodeId: binding.target.nodeId,
        property: binding.target.property,
      },
    });
  }

  const timeline: JsonRecord = {
    sceneOrder: entries.map((entry) => entry.sceneId),
    audioTracks: project.timeline.audioTracks.map((track) =>
      downMigrateAudioTrack(track),
    ),
    captionTracks: clone(project.timeline.captionTracks),
  };

  const extensions: JsonRecord = { constraints: [], events: [] };
  const v2Extensions = project.extensions;
  if (v2Extensions && typeof v2Extensions === "object") {
    const constraints = (v2Extensions as JsonRecord)[
      "com.moticlip.constraints"
    ];
    const events = (v2Extensions as JsonRecord)["com.moticlip.events"];
    if (Array.isArray(constraints)) extensions.constraints = constraints;
    if (Array.isArray(events)) extensions.events = events;
  }

  return {
    format: "motion-project",
    formatVersion: 2,
    metadata: downMigrateMetadata(project),
    dependencies: {
      components: project.dependencies.components.map((dep) => ({
        componentId: dep.componentId,
        version: dep.version,
        source: dep.source ?? "embedded",
        integrity: dep.integrity,
      })),
    },
    // Phase 6 — carry v3 composition settings through to the runtime IR
    // (colorSpace / audioSampleRate / background fidelity).
    composition: {
      width: project.composition.width,
      height: project.composition.height,
      fps: project.composition.fps,
      background: project.composition.background,
      colorSpace: project.composition.colorSpace,
      audioSampleRate: project.composition.audioSampleRate,
      ...(project.composition.safeArea
        ? {
            safeArea: {
              platform: "generic",
              ...project.composition.safeArea,
            },
          }
        : {}),
    },
    assets: project.assets.map((asset) => downMigrateAsset(asset)),
    variables: project.variables.map((variable) =>
      downMigrateVariable(variable),
    ),
    timeline,
    scenes,
    bindings,
    extensions,
  } as unknown as MotionProject;
}

// ── Public entry ──────────────────────────────────────────────────────

/**
 * Compile a `MotionProjectV3` into the runtime IR with structured
 * diagnostics.
 *
 * Returns `{ ok: true, project }` on success or `{ ok: false, diagnostics }`
 * when the project fails semantic validation (CMP_* codes) or the runtime
 * IR cannot be produced.
 */
export function compileMotionProjectV3(
  project: V3.MotionProjectV3,
  options: CompileV3Options = {},
): CompileResult<MotionRuntimeProject> {
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
  const normalized = parsed.data;

  // Semantic validation → CMP_* diagnostics.
  validateV3Semantics(normalized, collector);
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  // Build V2-shaped project data from the V3 project.
  const v2Shape = downMigrateProject(normalized, collector);
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  const warnings = [...collector.diagnostics].filter(
    (diagnostic) => diagnostic.severity !== "error",
  );

  // ── Compile each scene directly (Phase 4: no compileMotionProjectV2) ──

  try {
    const projectVariables = new Map<string, unknown>(
      v2Shape.variables.map(
        (v: { id: string; value: unknown }) => [v.id, clone(v.value)] as const,
      ),
    );
    const sceneOrder: string[] = (
      v2Shape.timeline as { sceneOrder: string[] }
    ).sceneOrder;
    const sceneById = new Map(
      v2Shape.scenes.map((s: Record<string, unknown>) => [s.id as string, s]),
    );

    const compiledScenes = sceneOrder.map((id) => {
      const scene = sceneById.get(id);
      if (!scene) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Scene "${id}" referenced in sceneOrder but not found in scenes array`,
          { path: ["timeline", "sceneOrder"], details: { sceneId: id } },
        );
        throw new Error(`Missing scene: ${id}`);
      }
      const variables = new Map(projectVariables);

      // Apply project bindings for this scene (Phase 4: bindings are in
      // the down-migrated project shape, injected before pipeline).
      const sceneBindings = (
        v2Shape.bindings as Array<{
          target: { sceneId: string; nodeId: string; property: string };
          source: { variableId: string };
        }>
      ).filter((b) => b.target.sceneId === id);
      for (const binding of sceneBindings) {
        const nodes = (scene.nodes ?? []) as Array<Record<string, unknown>>;
        const target = nodes.find(
          (n: Record<string, unknown>) => n.id === binding.target.nodeId,
        );
        if (target && variables.has(binding.source.variableId)) {
          // Mimic setPath: walk dotted path, set last segment.
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

      return _compileScenePipeline({
        id: scene.id as string,
        duration: scene.duration as number,
        nodes: (scene.nodes ?? []) as Parameters<
          typeof _compileScenePipeline
        >[0]["nodes"],
        clips: (scene.clips ?? []) as Parameters<
          typeof _compileScenePipeline
        >[0]["clips"],
        variables,
        markers: scene.markers as
          | Array<{ id: string; t: number }>
          | undefined,
        space: scene.space as string | undefined,
        motionBlur: scene.motionBlur,
        drivers: scene.drivers as unknown[] | undefined,
        activeCameraId: scene.activeCameraId as string | undefined,
        transition: scene.transition,
        sourceRef: scene.sourceRef as
          | NonNullable<
              Parameters<typeof _compileScenePipeline>[0]["sourceRef"]
            >
          | undefined,
      });
    });

    const sourceRefIndex: Record<string, string> = {};
    for (const scene of compiledScenes) {
      const srcRef = scene.sourceRef;
      sourceRefIndex[scene.id] =
        srcRef.sourceModule
          ? `${srcRef.projectPath.join(":")}#${srcRef.sourceModule}`
          : srcRef.projectPath.join(":");
    }

    const ir = {
      format: "motion-runtime" as const,
      formatVersion: 2 as const,
      runtimeVersion: MOTION_RUNTIME_VERSION,
      metadata: v2Shape.metadata,
      assets: v2Shape.assets,
      composition: v2Shape.composition,
      compilerVersion: COMPILER_VERSION_V3,
      capabilityFingerprint: buildCapabilityFingerprint(),
      timeline: v2Shape.timeline,
      sourceRef: { scenes: sourceRefIndex },
      scenes: compiledScenes,
    };

    const validated = MotionRuntimeProjectSchema.parse({
      ...ir,
      runtimeHash: computeRuntimeHash(
        ir as unknown as Record<string, unknown>,
      ),
    });

    return compileSuccess(validated, warnings);
  } catch (err: unknown) {
    // Convert errors to structured diagnostics (same pattern as compileMotionProjectV2).
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
 */
export function buildCompileCacheKeyV3(
  project: V3.MotionProjectV3,
  options: CompileV3Options = {},
): string {
  const parsed = V3.MotionProjectV3Schema.safeParse(project);
  const normalized = parsed.success ? parsed.data : project;

  const projectHash = createHash("sha256")
    .update(canonicalJson(normalized))
    .digest("hex")
    .slice(0, 16);

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
    `protocol:3`,
    `caps:${capabilitiesHash}`,
    `deps:${componentHash}`,
    `profile:${profile}`,
  ].join("|");
}
