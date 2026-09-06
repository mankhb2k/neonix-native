import { samplePreviewLayerAtTime } from "@/lib/docs/preview-animation";
import type { LayerPatch } from "@motionvideo/editor-core";
import type { V2Layer, V2Track } from "@motionvideo/motion-protocol/v2";

export const KEYFRAME_TIME_TOLERANCE_MS = 0.5;

export type PlayheadTransformEdit = {
  translateDelta?: { x?: number; y?: number };
  scaleMultiplier?: { x?: number; y?: number };
  rotationDelta?: number;
  opacity?: number;
  frameDelta?: { width?: number; height?: number };
};

export type PlayheadTransformOptions = {
  /** Create a keyframe when a property has no keyframe at the playhead. */
  autoKey?: boolean;
};

export function layerLocalTimeAtPlayhead(
  layer: V2Layer,
  timeSeconds: number,
): number {
  return Math.max(0, timeSeconds * 1000) - layer.timing.start;
}

/** Return the same V2 layer with all existing tracks sampled at the playhead. */
export function evaluateLayerAtPlayhead(
  layer: V2Layer,
  timeSeconds: number,
): V2Layer {
  return samplePreviewLayerAtTime(layer, timeSeconds);
}

export function isLayerKeyframedAtTime(
  layer: V2Layer,
  path: string,
  timeMs: number,
  tolerance = KEYFRAME_TIME_TOLERANCE_MS,
): boolean {
  return Boolean(
    layer.tracks?.some(
      (track) =>
        track.path === path &&
        track.keyframes.some((keyframe) => Math.abs(keyframe.time - timeMs) < tolerance),
    ),
  );
}

function exactKeyframeIndex(track: V2Track, timeMs: number): number {
  return track.keyframes.findIndex(
    (keyframe) => Math.abs(keyframe.time - timeMs) < KEYFRAME_TIME_TOLERANCE_MS,
  );
}

function setNumericProperty(
  layer: V2Layer,
  path: string,
  timeMs: number,
  evaluatedValue: number,
  autoKey: boolean,
  track: V2Track | undefined,
): { track?: V2Track } {
  const keyframeIndex = track ? exactKeyframeIndex(track, timeMs) : -1;
  const shouldKeyframe = keyframeIndex >= 0 || autoKey;

  if (shouldKeyframe) {
    if (track) {
      const keyframes = [...track.keyframes];
      const nextKeyframe = { type: "number" as const, value: evaluatedValue };
      if (keyframeIndex >= 0) {
        keyframes[keyframeIndex] = { ...keyframes[keyframeIndex], value: nextKeyframe };
      } else {
        keyframes.push({ time: timeMs, value: nextKeyframe, easing: { type: "linear" } });
        keyframes.sort((left, right) => left.time - right.time);
      }
      return { track: { ...track, keyframes } };
    }
    return {
      track: {
        id: `track-${layer.id}-${path.replace(/\./g, "-")}`,
        path,
        keyframes: [{ time: timeMs, value: { type: "number", value: evaluatedValue } }],
      },
    };
  }
  return {};
}

function assignBaseTransformValue(
  patch: LayerPatch,
  path: string,
  value: number,
): LayerPatch {
  const segments = path.split(".");
  if (path === "opacity") {
    return { ...patch, opacity: value };
  }
  if (segments[0] === "transform" && segments[1] === "translate") {
    return { ...patch, transform: {
      ...(patch.transform ?? {}),
      translate: {
        ...(patch.transform?.translate ?? {}),
        [segments[2]]: value,
      },
    } };
  }
  if (segments[0] === "transform" && segments[1] === "scale") {
    return { ...patch, transform: {
      ...(patch.transform ?? {}),
      scale: {
        ...(patch.transform?.scale ?? {}),
        [segments[2]]: value,
      },
    } };
  }
  if (segments[0] === "transform" && segments[1] === "rotate") {
    return { ...patch, transform: {
      ...(patch.transform ?? {}),
      rotate: {
        ...(patch.transform?.rotate ?? {}),
        [segments[2]]: value,
      },
    } };
  }
  if (segments[0] === "frame") {
    return { ...patch, frame: { ...(patch.frame ?? {}), [segments[1]]: value } };
  }
  return patch;
}

/**
 * Convert a stage transform gesture into a V2 patch at the current playhead.
 * Existing keyframes are edited in-place; without auto-key, unkeyed properties
 * remain document-level base values. This keeps a drag from silently creating
 * a new animation track while still making edits at an existing keyframe exact.
 */
export function buildPlayheadTransformPatch(
  layer: V2Layer,
  timeSeconds: number,
  edit: PlayheadTransformEdit,
  options: PlayheadTransformOptions = {},
): LayerPatch {
  const timeMs = layerLocalTimeAtPlayhead(layer, timeSeconds);
  const evaluated = evaluateLayerAtPlayhead(layer, timeSeconds);
  const tracks = [...(layer.tracks ?? [])];
  let patch: LayerPatch = {};
  const autoKey = options.autoKey ?? false;

  const applyNumeric = (
    path: string,
    evaluatedValue: number,
    baseValue: number,
  ): void => {
    const track = tracks.find((candidate) => candidate.path === path);
    const result = setNumericProperty(layer, path, timeMs, evaluatedValue, autoKey, track);
    if (result.track) {
      const trackIndex = tracks.findIndex((candidate) => candidate.path === path);
      if (trackIndex >= 0) tracks[trackIndex] = result.track;
      else tracks.push(result.track);
    } else {
      patch = assignBaseTransformValue(patch, path, baseValue);
    }
  };

  const translateX = edit.translateDelta?.x;
  if (translateX !== undefined) {
    applyNumeric("transform.translate.x", evaluated.transform.translate.x + translateX, layer.transform.translate.x + translateX);
  }
  const translateY = edit.translateDelta?.y;
  if (translateY !== undefined) {
    applyNumeric("transform.translate.y", evaluated.transform.translate.y + translateY, layer.transform.translate.y + translateY);
  }

  const scaleX = edit.scaleMultiplier?.x;
  if (scaleX !== undefined) {
    applyNumeric("transform.scale.x", evaluated.transform.scale.x * scaleX, layer.transform.scale.x * scaleX);
  }
  const scaleY = edit.scaleMultiplier?.y;
  if (scaleY !== undefined) {
    applyNumeric("transform.scale.y", evaluated.transform.scale.y * scaleY, layer.transform.scale.y * scaleY);
  }

  if (edit.rotationDelta !== undefined) {
    applyNumeric("transform.rotate.z", evaluated.transform.rotate.z + edit.rotationDelta, layer.transform.rotate.z + edit.rotationDelta);
  }

  if (edit.opacity !== undefined) {
    applyNumeric("opacity", edit.opacity, edit.opacity);
  }

  if (edit.frameDelta?.width !== undefined) {
    applyNumeric("frame.width", evaluated.frame.width + edit.frameDelta.width, layer.frame.width + edit.frameDelta.width);
  }
  if (edit.frameDelta?.height !== undefined) {
    applyNumeric("frame.height", evaluated.frame.height + edit.frameDelta.height, layer.frame.height + edit.frameDelta.height);
  }

  if (tracks.length > 0 && ((layer.tracks?.length ?? 0) > 0 || autoKey)) {
    patch.tracks = tracks;
  }
  return patch;
}

export function buildPlayheadTransformPatches(
  layers: readonly V2Layer[],
  timeSeconds: number,
  edit: PlayheadTransformEdit,
  options: PlayheadTransformOptions = {},
): Record<string, LayerPatch> {
  return Object.fromEntries(
    layers.map((layer) => [layer.id, buildPlayheadTransformPatch(layer, timeSeconds, edit, options)]),
  );
}
