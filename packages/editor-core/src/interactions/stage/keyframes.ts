import type { LayerPatch } from "../../document/commands";
import type { V2Layer, V2Track } from "@motionvideo/motion-protocol/v2";

export const KEYFRAME_TIME_TOLERANCE_MS = 0.5;

export type PlayheadTransformEdit = {
  translateDelta?: { x?: number; y?: number };
  scaleMultiplier?: { x?: number; y?: number };
  rotationDelta?: number;
  opacity?: number;
  frameDelta?: { width?: number; height?: number };
};

export type PlayheadTransformOptions = { autoKey?: boolean };

export type PlayheadPropertyPath =
  | "transform.translate.x"
  | "transform.translate.y"
  | "transform.scale.x"
  | "transform.scale.y"
  | "transform.rotate.z"
  | "frame.width"
  | "frame.height"
  | "opacity";

export function layerLocalTimeAtPlayhead(layer: V2Layer, timeSeconds: number): number {
  return Math.max(0, timeSeconds * 1000) - layer.timing.start;
}

export function isLayerKeyframedAtTime(
  layer: V2Layer,
  path: string,
  timeMs: number,
  tolerance = KEYFRAME_TIME_TOLERANCE_MS,
): boolean {
  return Boolean(layer.tracks?.some((track) =>
    track.path === path && track.keyframes.some((keyframe) => Math.abs(keyframe.time - timeMs) < tolerance)));
}

function exactKeyframeIndex(track: V2Track, timeMs: number): number {
  return track.keyframes.findIndex((keyframe) => Math.abs(keyframe.time - timeMs) < KEYFRAME_TIME_TOLERANCE_MS);
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
  if (keyframeIndex < 0 && !autoKey) return {};
  if (track) {
    const keyframes = [...track.keyframes];
    const value = { type: "number" as const, value: evaluatedValue };
    if (keyframeIndex >= 0) keyframes[keyframeIndex] = { ...keyframes[keyframeIndex], value };
    else {
      keyframes.push({ time: timeMs, value, easing: { type: "linear" } });
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

function assignBaseTransformValue(patch: LayerPatch, path: string, value: number): LayerPatch {
  const segments = path.split(".");
  if (path === "opacity") return { ...patch, opacity: value };
  if (segments[0] === "transform" && segments[1] === "translate") {
    return { ...patch, transform: { ...(patch.transform ?? {}), translate: { ...(patch.transform?.translate ?? {}), [segments[2]!]: value } } };
  }
  if (segments[0] === "transform" && segments[1] === "scale") {
    return { ...patch, transform: { ...(patch.transform ?? {}), scale: { ...(patch.transform?.scale ?? {}), [segments[2]!]: value } } };
  }
  if (segments[0] === "transform" && segments[1] === "rotate") {
    return { ...patch, transform: { ...(patch.transform ?? {}), rotate: { ...(patch.transform?.rotate ?? {}), [segments[2]!]: value } } };
  }
  if (segments[0] === "frame") return { ...patch, frame: { ...(patch.frame ?? {}), [segments[1]!]: value } };
  return patch;
}

/** Build a keyframe-aware patch from an already sampled runtime layer. */
export function buildPlayheadTransformPatch(
  layer: V2Layer,
  evaluated: V2Layer,
  timeSeconds: number,
  edit: PlayheadTransformEdit,
  options: PlayheadTransformOptions = {},
): LayerPatch {
  const timeMs = layerLocalTimeAtPlayhead(layer, timeSeconds);
  const tracks = [...(layer.tracks ?? [])];
  let patch: LayerPatch = {};
  const autoKey = options.autoKey ?? false;
  const applyNumeric = (path: string, evaluatedValue: number, baseValue: number): void => {
    const track = tracks.find((candidate) => candidate.path === path);
    const result = setNumericProperty(layer, path, timeMs, evaluatedValue, autoKey, track);
    if (result.track) {
      const trackIndex = tracks.findIndex((candidate) => candidate.path === path);
      if (trackIndex >= 0) tracks[trackIndex] = result.track;
      else tracks.push(result.track);
    } else patch = assignBaseTransformValue(patch, path, baseValue);
  };

  if (edit.translateDelta?.x !== undefined) applyNumeric("transform.translate.x", evaluated.transform.translate.x + edit.translateDelta.x, layer.transform.translate.x + edit.translateDelta.x);
  if (edit.translateDelta?.y !== undefined) applyNumeric("transform.translate.y", evaluated.transform.translate.y + edit.translateDelta.y, layer.transform.translate.y + edit.translateDelta.y);
  if (edit.scaleMultiplier?.x !== undefined) applyNumeric("transform.scale.x", evaluated.transform.scale.x * edit.scaleMultiplier.x, layer.transform.scale.x * edit.scaleMultiplier.x);
  if (edit.scaleMultiplier?.y !== undefined) applyNumeric("transform.scale.y", evaluated.transform.scale.y * edit.scaleMultiplier.y, layer.transform.scale.y * edit.scaleMultiplier.y);
  if (edit.rotationDelta !== undefined) applyNumeric("transform.rotate.z", evaluated.transform.rotate.z + edit.rotationDelta, layer.transform.rotate.z + edit.rotationDelta);
  if (edit.opacity !== undefined) applyNumeric("opacity", edit.opacity, edit.opacity);
  if (edit.frameDelta?.width !== undefined) applyNumeric("frame.width", evaluated.frame.width + edit.frameDelta.width, layer.frame.width + edit.frameDelta.width);
  if (edit.frameDelta?.height !== undefined) applyNumeric("frame.height", evaluated.frame.height + edit.frameDelta.height, layer.frame.height + edit.frameDelta.height);
  if (tracks.length > 0 && ((layer.tracks?.length ?? 0) > 0 || autoKey)) patch.tracks = tracks;
  return patch;
}

export function buildPlayheadTransformPatches(
  layers: readonly V2Layer[],
  evaluatedLayers: readonly V2Layer[],
  timeSeconds: number,
  edit: PlayheadTransformEdit,
  options: PlayheadTransformOptions = {},
): Record<string, LayerPatch> {
  const evaluatedById = new Map(evaluatedLayers.map((layer) => [layer.id, layer]));
  return Object.fromEntries(layers.map((layer) => [
    layer.id,
    buildPlayheadTransformPatch(layer, evaluatedById.get(layer.id) ?? layer, timeSeconds, edit, options),
  ]));
}

/** Build a keyframe toggle patch without exposing track mutation policy to UI. */
export function toggleNumericKeyframePatch(
  layer: V2Layer,
  path: PlayheadPropertyPath,
  timeSeconds: number,
  value: number,
): LayerPatch {
  const timeMs = layerLocalTimeAtPlayhead(layer, timeSeconds);
  const tracks = [...(layer.tracks ?? [])];
  const trackIndex = tracks.findIndex((track) => track.path === path);
  if (trackIndex === -1) {
    tracks.push({
      id: `track-${layer.id}-${path.replace(/\./g, "-")}`,
      path,
      keyframes: [{ time: timeMs, value: { type: "number", value } }],
    });
    return { tracks };
  }
  const track = tracks[trackIndex]!;
  const keyframes = [...track.keyframes];
  const keyframeIndex = exactKeyframeIndex(track, timeMs);
  if (keyframeIndex < 0) {
    keyframes.push({ time: timeMs, value: { type: "number", value }, easing: { type: "linear" } });
    keyframes.sort((left, right) => left.time - right.time);
    tracks[trackIndex] = { ...track, keyframes };
  } else if (keyframes.length === 1) {
    tracks.splice(trackIndex, 1);
  } else {
    keyframes.splice(keyframeIndex, 1);
    tracks[trackIndex] = { ...track, keyframes };
  }
  return { tracks };
}

/** Translate an inspector numeric edit into the canonical playhead edit. */
export function buildPlayheadPropertyPatch(
  layer: V2Layer,
  evaluated: V2Layer,
  timeSeconds: number,
  path: PlayheadPropertyPath,
  value: number,
): LayerPatch {
  switch (path) {
    case "transform.translate.x":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        translateDelta: { x: value - evaluated.transform.translate.x },
      });
    case "transform.translate.y":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        translateDelta: { y: value - evaluated.transform.translate.y },
      });
    case "transform.scale.x":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        scaleMultiplier: { x: value / Math.max(0.001, evaluated.transform.scale.x) },
      });
    case "transform.scale.y":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        scaleMultiplier: { y: value / Math.max(0.001, evaluated.transform.scale.y) },
      });
    case "transform.rotate.z":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        rotationDelta: value - evaluated.transform.rotate.z,
      });
    case "frame.width":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        frameDelta: { width: value - evaluated.frame.width },
      });
    case "frame.height":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, {
        frameDelta: { height: value - evaluated.frame.height },
      });
    case "opacity":
      return buildPlayheadTransformPatch(layer, evaluated, timeSeconds, { opacity: value });
  }
}
