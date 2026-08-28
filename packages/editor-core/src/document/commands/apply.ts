import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";
import type {
  V2AudioClip,
  V2AudioTrack,
  V2EmbeddedVideoAudio,
} from "@motionvideo/motion-protocol/v2";
import type { V2Asset } from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];

const DEFAULT_AUDIO_FADE = { duration: 0, curve: "linear" as const };

/** Recursive patch accepted by the V2 editor surface. */
export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? readonly DeepPartial<Item>[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type LayerPatch = DeepPartial<V2Layer>;
export type AudioClipPatch = DeepPartial<V2AudioClip>;
export type AudioTrackDocumentPatch = DeepPartial<V2AudioTrack>;

/**
 * Commands operate on the Protocol V2 document directly. Session/UI state
 * (selection, playhead, zoom) is deliberately excluded.
 */
export type EditorCommand =
  | { type: "add-asset"; asset: V2Asset }
  | { type: "remove-asset"; assetId: string }
  | { type: "add-audio-clip"; trackId: string; clip: V2AudioClip }
  | { type: "remove-audio-clip"; trackId: string; clipId: string }
  | { type: "add-layer"; layer: V2Layer }
  | { type: "remove-layer"; layerId: string }
  | { type: "patch-layer"; layerId: string; patch: LayerPatch }
  | { type: "replace-layer"; layerId: string; layer: V2Layer }
  | { type: "set-embedded-video-audio"; layerId: string; audio: V2EmbeddedVideoAudio | null }
  | { type: "detach-video-audio"; layerId: string; trackId?: string; clipId?: string }
  | { type: "extract-video-audio"; layerId: string; audioAsset: Extract<V2Asset, { kind: "audio" }>; trackId?: string; clipId?: string }
  | { type: "restore-document"; document: MotionProtocolV2 }
  | {
      type: "patch-layers";
      patches: Record<string, LayerPatch>;
    }
  | {
      type: "replace-layers";
      layers: Record<string, V2Layer>;
    }
  | {
      type: "reorder-layers";
      parentLayerId: string | null;
      orderedLayerIds: string[];
      patches?: Record<string, LayerPatch>;
    }
  | {
      type: "patch-audio-clip";
      trackId: string;
      clipId: string;
      patch: AudioClipPatch;
    }
  | {
      type: "replace-audio-clip";
      trackId: string;
      clipId: string;
      clip: V2AudioClip;
    }
  | {
      type: "patch-audio-track";
      trackId: string;
      patch: AudioTrackDocumentPatch;
    }
  | {
      type: "replace-audio-track";
      trackId: string;
      track: V2AudioTrack;
    };

export type EditorDiagnostic = {
  severity: "error" | "warning";
  code:
    | "document_invalid"
    | "command_invalid"
    | "layer_not_found"
    | "compile_invalid";
  message: string;
  path?: readonly (string | number)[];
};

export type EditorCommandResult =
  | {
      ok: true;
      document: MotionProtocolV2;
      inverse: EditorCommand;
      diagnostics: readonly EditorDiagnostic[];
    }
  | {
      ok: false;
      document: MotionProtocolV2;
      diagnostics: readonly EditorDiagnostic[];
    };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge nested object fields while replacing scalar and array values. */
function mergePatch<T>(value: T, patch: DeepPartial<T>): T {
  if (!isRecord(value) || !isRecord(patch)) return patch as T;
  const result: Record<string, unknown> = { ...value };
  for (const [key, nextValue] of Object.entries(patch)) {
    if (nextValue === undefined) continue;
    const previousValue = result[key];
    result[key] =
      isRecord(previousValue) && isRecord(nextValue)
        ? mergePatch(previousValue, nextValue)
        : nextValue;
  }
  return result as T;
}

function uniqueId(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function detachedAudioClip(
  layer: Extract<V2Layer, { type: "video" }>,
  audio: V2EmbeddedVideoAudio,
  assetId: string,
  clipId: string,
): V2AudioClip {
  return {
    id: clipId,
    assetId,
    timing: { ...layer.timing },
    trim: {
      start: layer.payload.trimStart ?? 0,
      ...(layer.payload.trimEnd !== undefined ? { end: layer.payload.trimEnd } : {}),
    },
    playbackRate: 1,
    gainDb: audio.gainDb,
    fadeIn: { ...(audio.fadeIn ?? DEFAULT_AUDIO_FADE) },
    fadeOut: { ...(audio.fadeOut ?? DEFAULT_AUDIO_FADE) },
  };
}

function diagnosticsFromSchema(error: {
  issues: Array<{ message: string; path: (string | number)[] }>;
}): EditorDiagnostic[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "document_invalid",
    message: issue.message,
    path: issue.path,
  }));
}

function reject(
  document: MotionProtocolV2,
  diagnostics: readonly EditorDiagnostic[],
): EditorCommandResult {
  return { ok: false, document, diagnostics };
}

/**
 * Apply one V2 document command atomically. The source document is never
 * mutated; invalid schema/compiler output is rejected before it reaches UI.
 */
export function applyEditorCommand(
  input: MotionProtocolV2,
  command: EditorCommand,
): EditorCommandResult {
  const original = clone(input);
  const parsedOriginal = MotionProtocolV2Schema.safeParse(original);
  if (!parsedOriginal.success) {
    return reject(original, diagnosticsFromSchema(parsedOriginal.error));
  }

  const commit = (
    next: MotionProtocolV2,
    inverse: EditorCommand,
  ): EditorCommandResult => {
    const parsedNext = MotionProtocolV2Schema.safeParse(next);
    if (!parsedNext.success) {
      return reject(original, diagnosticsFromSchema(parsedNext.error));
    }

    try {
      compileProtocolV2(parsedNext.data);
    } catch (error) {
      return reject(original, [
        {
          severity: "error",
          code: "compile_invalid",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }

    return { ok: true, document: parsedNext.data, inverse, diagnostics: [] };
  };

  if (command.type === "restore-document") {
    return commit(clone(command.document), {
      type: "restore-document",
      document: original,
    });
  }

  if (
    command.type === "set-embedded-video-audio" ||
    command.type === "detach-video-audio" ||
    command.type === "extract-video-audio"
  ) {
    const layerIndex = original.layers.findIndex((layer) => layer.id === command.layerId);
    const layer = layerIndex >= 0 ? original.layers[layerIndex] : undefined;
    if (!layer || layer.type !== "video") {
      return reject(original, [{ severity: "error", code: "layer_not_found", message: `Video layer not found: ${command.layerId}` }]);
    }
    if (command.type === "set-embedded-video-audio") {
      const next = clone(original);
      const nextLayer = next.layers[layerIndex]! as Extract<V2Layer, { type: "video" }>;
      const payload = { ...nextLayer.payload };
      if (command.audio === null) delete payload.audio;
      else {
        payload.audio = {
          ...clone(command.audio),
          fadeIn: { ...(command.audio.fadeIn ?? DEFAULT_AUDIO_FADE) },
          fadeOut: { ...(command.audio.fadeOut ?? DEFAULT_AUDIO_FADE) },
        };
      }
      next.layers[layerIndex] = { ...nextLayer, payload };
      return commit(next, { type: "replace-layer", layerId: layer.id, layer: clone(layer) });
    }
    const embedded = layer.payload.audio;
    if (!embedded) {
      return reject(original, [{ severity: "error", code: "command_invalid", message: `Video layer has no embedded audio: ${command.layerId}` }]);
    }
    const sourceAsset = original.assets.find((asset) => asset.id === layer.payload.assetId);
    if (!sourceAsset || sourceAsset.kind !== "video") {
      return reject(original, [{ severity: "error", code: "command_invalid", message: `Video layer references an invalid source asset: ${layer.payload.assetId}` }]);
    }
    let assetId = sourceAsset.id;
    const next = clone(original);
    if (command.type === "extract-video-audio") {
      const existing = original.assets.find((asset) => asset.id === command.audioAsset.id);
      if (existing && existing.kind !== "audio") {
        return reject(original, [{ severity: "error", code: "command_invalid", message: `Extracted audio asset id already belongs to a non-audio asset: ${command.audioAsset.id}` }]);
      }
      if (!existing) next.assets.push(clone(command.audioAsset));
      assetId = command.audioAsset.id;
    }
    const usedTrackIds = new Set(next.audio.tracks.map((track) => track.id));
    const trackId = uniqueId(command.trackId ?? `audio-detached:${layer.id}`, usedTrackIds);
    const usedClipIds = new Set(next.audio.tracks.flatMap((track) => track.clips.map((clip) => clip.id)));
    const clipId = uniqueId(command.clipId ?? `audio-detached:${layer.id}:clip`, usedClipIds);
    next.audio.tracks.push({
      id: trackId,
      gainDb: 0,
      pan: 0,
      muted: !embedded.enabled,
      clips: [detachedAudioClip(layer, embedded, assetId, clipId)],
    });
    const nextLayer = next.layers[layerIndex]! as Extract<V2Layer, { type: "video" }>;
    const payload = { ...nextLayer.payload };
    delete payload.audio;
    next.layers[layerIndex] = { ...nextLayer, payload };
    return commit(next, { type: "restore-document", document: original });
  }

  if (command.type === "add-layer") {
    if (original.layers.some((layer) => layer.id === command.layer.id)) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Layer id already exists: ${command.layer.id}`,
        },
      ]);
    }
    if (
      original.layers.some(
        (layer) =>
          layer.parentLayerId === command.layer.parentLayerId &&
          layer.order === command.layer.order,
      )
    ) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Duplicate order in sibling scope: ${command.layer.order}`,
        },
      ]);
    }
    if (command.layer.parentLayerId !== null) {
      const parent = original.layers.find(
        (layer) => layer.id === command.layer.parentLayerId,
      );
      if (!parent || parent.type !== "group") {
        return reject(original, [
          {
            severity: "error",
            code: "command_invalid",
            message: "A layer can only be added under an existing group.",
          },
        ]);
      }
    }
    const next = clone(original);
    next.layers.push(clone(command.layer));
    return commit(next, { type: "remove-layer", layerId: command.layer.id });
  }

  if (command.type === "add-asset") {
    if (original.assets.some((asset) => asset.id === command.asset.id)) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Asset id already exists: ${command.asset.id}`,
        },
      ]);
    }
    const next = clone(original);
    next.assets.push(clone(command.asset));
    return commit(next, { type: "remove-asset", assetId: command.asset.id });
  }

  if (command.type === "remove-asset") {
    const assetIndex = original.assets.findIndex((asset) => asset.id === command.assetId);
    if (assetIndex < 0) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Asset not found: ${command.assetId}`,
        },
      ]);
    }
    const referenced = original.layers.some((layer) =>
      "payload" in layer && "assetId" in layer.payload && layer.payload.assetId === command.assetId,
    ) || original.audio.tracks.some((track) =>
      track.clips.some((clip) => clip.assetId === command.assetId),
    );
    if (referenced) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Asset is still referenced: ${command.assetId}`,
        },
      ]);
    }
    const next = clone(original);
    const [asset] = next.assets.splice(assetIndex, 1);
    return commit(next, { type: "add-asset", asset: asset! });
  }

  if (command.type === "add-audio-clip") {
    const asset = original.assets.find((candidate) => candidate.id === command.clip.assetId);
    if (!asset || (asset.kind !== "audio" && asset.kind !== "video")) {
      return reject(original, [{ severity: "error", code: "command_invalid", message: `Audio clip references invalid asset: ${command.clip.assetId}` }]);
    }
    if (original.audio.tracks.some((track) => track.clips.some((clip) => clip.id === command.clip.id))) {
      return reject(original, [{ severity: "error", code: "command_invalid", message: `Audio clip id already exists: ${command.clip.id}` }]);
    }
    const next = clone(original);
    let track = next.audio.tracks.find((candidate) => candidate.id === command.trackId);
    if (!track) {
      const newTrack: V2AudioTrack = { id: command.trackId, gainDb: 0, pan: 0, muted: false, clips: [] };
      next.audio.tracks.push(newTrack);
      track = newTrack;
    }
    track.clips.push({
      ...clone(command.clip),
      fadeIn: { ...(command.clip.fadeIn ?? DEFAULT_AUDIO_FADE) },
      fadeOut: { ...(command.clip.fadeOut ?? DEFAULT_AUDIO_FADE) },
    });
    return commit(next, { type: "remove-audio-clip", trackId: command.trackId, clipId: command.clip.id });
  }

  if (command.type === "remove-audio-clip") {
    const track = original.audio.tracks.find((candidate) => candidate.id === command.trackId);
    const clipIndex = track?.clips.findIndex((clip) => clip.id === command.clipId) ?? -1;
    if (!track || clipIndex < 0) {
      return reject(original, [{ severity: "error", code: "command_invalid", message: `Audio clip not found: ${command.trackId}/${command.clipId}` }]);
    }
    const previousClip = clone(track.clips[clipIndex]!);
    const next = clone(original);
    next.audio.tracks.find((candidate) => candidate.id === command.trackId)!.clips.splice(clipIndex, 1);
    return commit(next, { type: "add-audio-clip", trackId: command.trackId, clip: previousClip });
  }

  if (
    command.type === "patch-audio-track" ||
    command.type === "replace-audio-track"
  ) {
    const trackIndex = original.audio.tracks.findIndex(
      (candidate) => candidate.id === command.trackId,
    );
    if (trackIndex < 0) {
      return reject(original, [
        {
          severity: "error",
          code: "layer_not_found",
          message: `Audio track not found: ${command.trackId}`,
        },
      ]);
    }
    const previousTrack = clone(original.audio.tracks[trackIndex]!);
    const next = clone(original);
    next.audio.tracks[trackIndex] =
      command.type === "patch-audio-track"
        ? mergePatch(next.audio.tracks[trackIndex]!, command.patch)
        : clone(command.track);
    return commit(next, {
      type: "replace-audio-track",
      trackId: previousTrack.id,
      track: previousTrack,
    });
  }

  if (
    command.type === "patch-audio-clip" ||
    command.type === "replace-audio-clip"
  ) {
    const track = original.audio.tracks.find(
      (candidate) => candidate.id === command.trackId,
    );
    const clipIndex = track?.clips.findIndex(
      (candidate) => candidate.id === command.clipId,
    ) ?? -1;
    if (!track || clipIndex < 0) {
      return reject(original, [
        {
          severity: "error",
          code: "layer_not_found",
          message: `Audio clip not found: ${command.trackId}/${command.clipId}`,
        },
      ]);
    }
    const previousClip = clone(track.clips[clipIndex]!);
    const next = clone(original);
    const nextTrack = next.audio.tracks.find(
      (candidate) => candidate.id === command.trackId,
    )!;
    nextTrack.clips[clipIndex] =
      command.type === "patch-audio-clip"
        ? mergePatch(nextTrack.clips[clipIndex]!, command.patch)
        : clone(command.clip);
    return commit(next, {
      type: "replace-audio-clip",
      trackId: command.trackId,
      clipId: command.clipId,
      clip: previousClip,
    });
  }

  if (command.type === "patch-layers" || command.type === "replace-layers") {
    const ids = Object.keys(
      command.type === "patch-layers" ? command.patches : command.layers,
    );
    const indexes = new Map(
      original.layers.map((layer, index) => [layer.id, index]),
    );
    const missing = ids.find((id) => !indexes.has(id));
    if (missing) {
      return reject(original, [
        {
          severity: "error",
          code: "layer_not_found",
          message: `Layer not found: ${missing}`,
        },
      ]);
    }
    const previousLayers: Record<string, V2Layer> = {};
    const next = clone(original);
    for (const id of ids) {
      const index = indexes.get(id)!;
      previousLayers[id] = clone(original.layers[index]!);
      next.layers[index] =
        command.type === "patch-layers"
          ? mergePatch(next.layers[index]!, command.patches[id]!)
          : clone(command.layers[id]!);
    }
    return commit(next, { type: "replace-layers", layers: previousLayers });
  }

  if (command.type === "reorder-layers") {
    const siblings = original.layers
      .filter((layer) => layer.parentLayerId === command.parentLayerId)
      .sort((left, right) => left.order - right.order);
    const siblingIds = new Set(siblings.map((layer) => layer.id));
    const requestedIds = new Set(command.orderedLayerIds);
    const validShape =
      siblings.length === command.orderedLayerIds.length &&
      requestedIds.size === siblings.length &&
      command.orderedLayerIds.every((id) => siblingIds.has(id));
    if (!validShape) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: "Reorder must contain every sibling exactly once.",
        },
      ]);
    }
    const previousLayers: Record<string, V2Layer> = {};
    const next = clone(original);
    for (const sibling of siblings) previousLayers[sibling.id] = clone(sibling);
    for (const [order, id] of command.orderedLayerIds.entries()) {
      const index = next.layers.findIndex((layer) => layer.id === id);
      const previous = next.layers[index]!;
      next.layers[index] = {
        ...mergePatch(previous, command.patches?.[id] ?? {}),
        order,
      } as V2Layer;
    }
    return commit(next, { type: "replace-layers", layers: previousLayers });
  }

  const layerIndex = original.layers.findIndex(
    (layer) => layer.id === command.layerId,
  );
  if (layerIndex < 0) {
    return reject(original, [
      {
        severity: "error",
        code: "layer_not_found",
        message: `Layer not found: ${command.layerId}`,
      },
    ]);
  }

  const previousLayer = clone(original.layers[layerIndex]!);
  const next = clone(original);
  if (command.type === "remove-layer") {
    if (original.layers.some((layer) => layer.parentLayerId === command.layerId)) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: "A layer with children cannot be removed yet.",
        },
      ]);
    }
    next.layers.splice(layerIndex, 1);
    return commit(next, { type: "add-layer", layer: previousLayer });
  }

  next.layers[layerIndex] =
    command.type === "patch-layer"
      ? mergePatch(next.layers[layerIndex]!, command.patch)
      : clone(command.layer);

  return commit(next, {
    type: "replace-layer",
    layerId: previousLayer.id,
    layer: previousLayer,
  });
}
