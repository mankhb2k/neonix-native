/**
 * V2 → V3 migration.
 *
 * Deterministically converts a parsed `MotionProjectV2` into a
 * `MotionProjectV3`, emitting structured diagnostics for data loss or
 * ambiguous mappings. The returned project is always parse-valid.
 *
 * Key mappings:
 *  - aspectRatio → composition dimensions (preset map, overridable)
 *  - sceneOrder   → visualTracks[0].clips (sequential starts)
 *  - scene.transition → visual clip transitionOut
 *  - brand/designTokens → tokens (+ asset variable for brand logo)
 *  - audio tracks get `duration` from asset metadata or resolver
 *  - extensions.constraints/events → namespaced extensions
 */
import type { MotionProjectV2, MotionScene, MotionNode } from "../../v2";
import type { AudioTrackV2 } from "./types";
import { MotionProjectV3Schema } from "../index";
import type { MotionProjectV3 } from "../index";
import { createDiagnostic, type MigrationDiagnostic } from "./diagnostics";

export interface AssetMetadata {
  duration?: number;
  width?: number;
  height?: number;
}

export type AssetMetadataResolver = (
  assetId: string,
) => AssetMetadata | undefined;

export interface MigrateV2ToV3Options {
  assetMetadataResolver?: AssetMetadataResolver;
  /** Overrides aspect-ratio derived dimensions / fps. */
  defaultComposition?: Partial<{
    width: number;
    height: number;
    fps: number;
    background: string;
  }>;
  /** Overrides v2 metadata.locale (locked to vi-VN). */
  locale?: string;
}

export interface MigrateV2ToV3Result {
  project: MotionProjectV3;
  diagnostics: MigrationDiagnostic[];
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function toHexColorOrNull(value: string | undefined): string | null {
  if (!value) return null;
  return HEX_COLOR.test(value) ? value : null;
}

/** Only literal hex colors migrate; gradients fall back to null. */
function fillToHexOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return toHexColorOrNull(value);
}

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export function migrateMotionProjectV2ToV3(
  project: MotionProjectV2,
  options: MigrateV2ToV3Options = {},
): MigrateV2ToV3Result {
  const diagnostics: MigrationDiagnostic[] = [];
  const resolver = options.assetMetadataResolver;

  // ── composition ─────────────────────────────────────────────────────
  const preset = ASPECT_DIMENSIONS[project.metadata.aspectRatio] ?? {
    width: 1920,
    height: 1080,
  };
  if (options.defaultComposition?.width || options.defaultComposition?.height) {
    diagnostics.push(
      createDiagnostic(
        "MIG_ASPECT_PRESET_AMBIGUOUS",
        "info",
        "Aspect-ratio preset dimensions overridden by defaultComposition",
        "composition",
      ),
    );
  }
  const composition = {
    width: options.defaultComposition?.width ?? preset.width,
    height: options.defaultComposition?.height ?? preset.height,
    fps: options.defaultComposition?.fps ?? project.metadata.fps ?? 30,
    background:
      toHexColorOrNull(project.metadata.brand?.primaryColor) ??
      options.defaultComposition?.background ??
      "#ffffff",
    ...(project.metadata.safeArea
      ? {
          safeArea: {
            top: project.metadata.safeArea.top ?? 0,
            right: project.metadata.safeArea.right ?? 0,
            bottom: project.metadata.safeArea.bottom ?? 0,
            left: project.metadata.safeArea.left ?? 0,
          },
        }
      : {}),
  };

  // ── tokens ──────────────────────────────────────────────────────────
  const tokens: Record<string, unknown> = {};
  if (project.metadata.designTokens) {
    const dt = project.metadata.designTokens;
    if (dt.colors && Object.keys(dt.colors).length > 0)
      tokens.colors = { ...dt.colors };
    if (dt.fonts && Object.keys(dt.fonts).length > 0)
      tokens.fonts = { ...dt.fonts };
    if (dt.spacing && Object.keys(dt.spacing).length > 0)
      tokens.spacing = { ...dt.spacing };
  }
  const brand = project.metadata.brand;
  if (brand) {
    const primary = toHexColorOrNull(brand.primaryColor);
    const secondary = toHexColorOrNull(brand.secondaryColor);
    tokens.colors = {
      ...((tokens.colors as Record<string, string> | undefined) ?? {}),
      ...(primary ? { primary } : {}),
      ...(secondary ? { secondary } : {}),
    };
    if (Object.keys(tokens.colors as Record<string, string>).length === 0) {
      delete tokens.colors;
    }
    if (brand.fontFamily) {
      const fontAsset = project.assets.find(
        (a) => a.assetType === "font" && a.family === brand.fontFamily,
      );
      if (fontAsset) {
        tokens.fonts = {
          ...((tokens.fonts as Record<string, string> | undefined) ?? {}),
          [brand.fontFamily]: fontAsset.id,
        };
      } else {
        diagnostics.push(
          createDiagnostic(
            "MIG_BRAND_FONT_UNRESOLVED",
            "warning",
            `Brand font "${brand.fontFamily}" does not match any font asset`,
            "metadata.brand.fontFamily",
          ),
        );
      }
    }
  }

  // ── variables (adds brand-logo asset variable when needed) ───────────
  const variables: unknown[] = project.variables.map((v) => ({ ...v }));
  if (brand?.logoAssetId) {
    const asset = project.assets.find((a) => a.id === brand.logoAssetId);
    const assetKind = asset
      ? asset.assetType === "font"
        ? "font"
        : asset.assetType
      : undefined;
    if (assetKind && assetKind !== "audio" && assetKind !== "video") {
      variables.push({
        id: "brand-logo",
        name: "Brand logo",
        type: "asset",
        assetKind,
        value: brand.logoAssetId,
      });
    }
  }

  // ── assets ───────────────────────────────────────────────────────────
  const assets = project.assets.map((asset) => mapAsset(asset, diagnostics));

  // ── scenes ───────────────────────────────────────────────────────────
  const scenes = project.scenes.map((scene) =>
    mapScene(scene, diagnostics, project),
  );

  // ── timeline ─────────────────────────────────────────────────────────
  const orderedSceneIds =
    project.timeline.sceneOrder.length > 0
      ? project.timeline.sceneOrder
      : (() => {
          diagnostics.push(
            createDiagnostic(
              "MIG_SCENE_ORDER_EMPTY",
              "info",
              "sceneOrder is empty; falling back to scene declaration order",
              "timeline.sceneOrder",
            ),
          );
          return project.scenes.map((scene) => scene.id);
        })();

  let cursor = 0;
  const visualClips: unknown[] = [];
  for (const sceneId of orderedSceneIds) {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) continue;
    const transition = scene.transition;
    if (
      transition &&
      transition.type !== "cut" &&
      transition.duration > scene.duration
    ) {
      diagnostics.push(
        createDiagnostic(
          "MIG_TRANSITION_OVERFLOW",
          "warning",
          `Transition on scene "${sceneId}" (${transition.duration}s) exceeds scene duration (${scene.duration}s)`,
          `scenes[${sceneId}].transition`,
        ),
      );
    }
    visualClips.push({
      id: `clip-${sceneId}`,
      source: { kind: "scene", sceneId },
      start: cursor,
      duration: scene.duration,
      ...(transition ? { transitionOut: transition } : {}),
    });
    cursor += scene.duration;
  }

  const audioTracks = project.timeline.audioTracks.map((track) =>
    mapAudioTrack(track, project, resolver, diagnostics),
  );

  // ── extensions ───────────────────────────────────────────────────────
  const extensions: Record<string, unknown> = {};
  if (project.extensions.constraints.length > 0) {
    extensions["com.moticlip.constraints"] = project.extensions.constraints;
  }
  if (project.extensions.events.length > 0) {
    extensions["com.moticlip.events"] = project.extensions.events;
  }

  // ── bindings ─────────────────────────────────────────────────────────
  const bindings = project.bindings.map((binding) => ({
    id: binding.id,
    source: binding.source,
    target: {
      kind: "scene" as const,
      sceneId: binding.target.sceneId,
      nodeId: binding.target.nodeId,
      property: binding.target.property,
    },
  }));

  const built = {
    format: "motion-project" as const,
    formatVersion: 3 as const,
    metadata: {
      id: project.metadata.id,
      name: project.metadata.name,
      description: project.metadata.description,
      locale: options.locale ?? project.metadata.locale,
      industry: project.metadata.industry,
      createdAt: project.metadata.createdAt,
      updatedAt: project.metadata.updatedAt,
    },
    composition,
    capabilities: {},
    dependencies: {
      compiler: { range: ">=1.0.0" },
      components: project.dependencies.components.map((dep) => ({
        componentId: dep.componentId,
        version: dep.version,
        source: dep.source,
        integrity: dep.integrity,
      })),
    },
    tokens: Object.keys(tokens).length > 0 ? tokens : {},
    variables,
    assets,
    components: [],
    scenes,
    timeline: {
      visualTracks:
        visualClips.length > 0
          ? [
              {
                id: "main-track",
                role: "main" as const,
                order: 0,
                clips: visualClips,
              },
            ]
          : [],
      audioTracks,
      captionTracks: project.timeline.captionTracks.map((track) => ({
        ...track,
      })),
    },
    bindings,
    extensions,
  };

  const projectV3 = MotionProjectV3Schema.parse(built);
  return { project: projectV3, diagnostics };
}

// ── per-kind mappers ──────────────────────────────────────────────────

function mapAsset(
  asset: MotionProjectV2["assets"][number],
  diagnostics: MigrationDiagnostic[],
): unknown {
  switch (asset.assetType) {
    case "image":
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "image",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        pixelFormat: asset.pixelFormat,
        hasAlpha: asset.hasAlpha,
      };
    case "svg":
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "svg",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        viewBox: asset.viewBox,
        sanitized: asset.sanitized,
      };
    case "video":
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
        codec: asset.videoCodec,
        pixelFormat: asset.pixelFormat,
        audioCodec: asset.audioCodec,
        audioSampleRate: asset.sampleRate,
        audioChannels: asset.channels,
      };
    case "audio":
      return {
        id: asset.id,
        uri: asset.uri,
        integrity: asset.integrity,
        assetType: "audio",
        mimeType: asset.mimeType,
        duration: asset.duration,
        codec: asset.codec,
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
        localeCoverage: asset.localeCoverage,
      };
  }
}

function mapScene(
  scene: MotionScene,
  diagnostics: MigrationDiagnostic[],
  project: MotionProjectV2,
): unknown {
  const nodes: unknown[] = [];
  for (const node of scene.nodes) {
    const migrated = mapNode(node, scene, diagnostics, project);
    if (migrated) nodes.push(migrated);
  }
  return {
    id: scene.id,
    name: scene.name,
    duration: scene.duration,
    semantic: scene.semantic,
    space: scene.space ?? "flat-2d",
    markers: scene.markers,
    motionBlur: scene.motionBlur,
    drivers: scene.drivers,
    nodes,
    clips: scene.clips
      .map((clip) => mapClip(clip, diagnostics))
      .filter((clip): clip is unknown => clip !== null),
    activeCameraId: scene.activeCameraId,
  };
}

function mapNode(
  node: MotionNode,
  scene: MotionScene,
  diagnostics: MigrationDiagnostic[],
  project: MotionProjectV2,
): unknown | null {
  if (node.type === "component") {
    diagnostics.push(
      createDiagnostic(
        "MIG_UNSUPPORTED_COMPONENT",
        "error",
        `Component node "${node.id}" (${node.payload.componentId}@${node.payload.componentVersion}) has no v3 node equivalent; node dropped from scene "${scene.id}"`,
        `scenes[${scene.id}].nodes[${node.id}]`,
      ),
    );
    return null;
  }

  const base = {
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    zIndex: node.zIndex,
    transform: node.transform,
    timing: node.timing,
    semantic: node.semantic,
    effects: node.effects,
    blendMode: node.blendMode,
    mask: node.mask,
    inheritFlags: {
      position: node.inheritPosition ?? true,
      rotation: node.inheritRotation ?? true,
      scale: node.inheritScale ?? true,
      opacity: node.inheritOpacity ?? true,
    },
    visible: node.transform.visible,
  };

  switch (node.type) {
    case "group":
      return { ...base, type: "group", payload: node.payload };
    case "bone":
      return { ...base, type: "bone", payload: node.payload };
    case "text":
      return {
        ...base,
        type: "text",
        payload: {
          content: node.payload.content,
          fontAssetId: node.payload.fontAssetId,
          fontSize: node.payload.fontSize,
          color: fillToHexOrNull(node.style?.fill) ?? "#000000",
          alignment: node.payload.align ?? "left",
          wrap: node.payload.wrap ?? "word",
          lineHeight: node.payload.lineHeight,
          letterSpacing: node.payload.letterSpacing,
          maxLines: node.payload.maxLines,
          overflow: node.payload.overflow ?? "visible",
        },
      };
    case "image":
      return { ...base, type: "image", payload: node.payload };
    case "svg":
      return {
        ...base,
        type: "svg",
        payload: node.payload,
        style: node.style,
      };
    case "video":
      return { ...base, type: "video", payload: node.payload };
    case "camera":
      return {
        ...base,
        type: "camera",
        payload: {
          projection: node.payload.projection ?? "orthographic",
          zoom: node.payload.zoom,
          parallaxStrength: node.payload.parallaxStrength,
          fieldOfView: node.payload.fov,
          near: node.payload.near,
          far: node.payload.far,
        },
      };
    case "solid":
      return {
        ...base,
        type: "solid",
        payload: {
          width: node.payload.width,
          height: node.payload.height,
          color: toHexColorOrNull(node.payload.color) ?? "#000000",
        },
      };
    case "adjustment":
      return { ...base, type: "adjustment", payload: node.payload };
    case "shape":
      return {
        ...base,
        type: "shape",
        payload: node.payload,
        style: node.style,
      };
    case "path":
      return {
        ...base,
        type: "path",
        payload: node.payload,
        style: node.style,
      };
  }
}

function mapClip(
  clip: MotionScene["clips"][number],
  diagnostics: MigrationDiagnostic[],
): unknown | null {
  if (clip.source.kind === "component-action") {
    diagnostics.push(
      createDiagnostic(
        "MIG_UNSUPPORTED_COMPONENT",
        "error",
        `Clip "${clip.id}" uses component-action source which has no v3 equivalent; clip dropped`,
        `clips[${clip.id}]`,
      ),
    );
    return null;
  }
  return {
    id: clip.id,
    targetId: clip.targetId,
    schedule: clip.schedule,
    duration: clip.duration,
    playback: clip.playback,
    source:
      clip.source.kind === "preset"
        ? {
            kind: "preset",
            presetId: clip.source.presetId,
            params: clip.source.params,
          }
        : clip.source,
  };
}

function mapAudioTrack(
  track: AudioTrackV2,
  project: MotionProjectV2,
  resolver: AssetMetadataResolver | undefined,
  diagnostics: MigrationDiagnostic[],
): unknown {
  let duration: number | undefined;
  const asset = project.assets.find((a) => a.id === track.assetId);
  if (asset && asset.assetType === "audio") {
    duration = asset.duration;
  }
  if (duration === undefined && resolver) {
    duration = resolver(track.assetId)?.duration;
  }
  if (duration === undefined) {
    diagnostics.push(
      createDiagnostic(
        "MIG_MISSING_AUDIO_DURATION",
        "warning",
        `Audio track "${track.id}" has no resolvable duration; using 1s fallback`,
        `timeline.audioTracks[${track.id}]`,
      ),
    );
    duration = 1;
  }
  return {
    id: track.id,
    role: track.role,
    assetId: track.assetId,
    start: track.start,
    duration,
    trimStart: track.trimStart,
    playbackRate: 1,
    volume: track.volume,
    loop: track.loop,
    fadeIn: track.fadeIn,
    fadeOut: track.fadeOut,
    muted: false,
  };
}
