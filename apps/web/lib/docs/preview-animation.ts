import { sampleMotionProtocolAtTime } from "@motionvideo/motion-compiler";
import type {
  MotionProtocolV2,
  V2AnimatableValue,
  V2Track,
} from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];

/** Sample one layer without requiring a complete project wrapper. */
export function samplePreviewLayerAtTime(
  layer: V2Layer,
  timeSeconds: number,
): V2Layer {
  if (!layer.tracks || layer.tracks.length === 0) return layer;
  const localTimeMs = Math.max(0, timeSeconds * 1000) - layer.timing.start;
  let sampledLayer: V2Layer = layer;
  for (const track of layer.tracks) {
    const sampled = sampleTrack(track, localTimeMs);
    if (sampled === undefined) continue;
    sampledLayer = applyTrackValue(sampledLayer, track.path, toPropertyValue(sampled));
  }
  return sampledLayer;
}

/**
 * Samples Protocol V2 visual tracks for the documentation preview.
 *
 * The production compiler still receives the original project for resource
 * ownership. This function creates the sampled V2 snapshot that is compiled
 * into the RuntimeFrameV3 supplied to both the SVG reference and native renderer. Track
 * keyframes are local to their owning layer and use protocol milliseconds.
 */
export function samplePreviewProtocolAtTime(
  project: MotionProtocolV2,
  timeSeconds: number,
): MotionProtocolV2 {
  return sampleMotionProtocolAtTime(project, timeSeconds);
}

function sampleTrack(track: V2Track, timeMs: number): V2AnimatableValue | undefined {
  const keyframes = track.keyframes;
  const first = keyframes[0];
  if (!first) return undefined;
  if (timeMs <= first.time) return first.value;
  const last = keyframes[keyframes.length - 1];
  if (!last || timeMs >= last.time) return last?.value;

  const rightIndex = keyframes.findIndex((keyframe) => keyframe.time >= timeMs);
  if (rightIndex <= 0) return first.value;
  const left = keyframes[rightIndex - 1];
  const right = keyframes[rightIndex];
  const span = right.time - left.time;
  const normalized = span > 0 ? (timeMs - left.time) / span : 1;
  const progress = applyEasing(left.easing, normalized);
  if (track.interpolation?.type === "discrete" || left.easing?.type === "step") {
    return progress < 1 ? left.value : right.value;
  }
  return interpolateValue(left.value, right.value, progress);
}

function interpolateValue(
  left: V2AnimatableValue,
  right: V2AnimatableValue,
  progress: number,
): V2AnimatableValue {
  if (left.type !== right.type) return progress < 1 ? left : right;
  if (left.type === "number" && right.type === "number") {
    return { type: "number", value: left.value + (right.value - left.value) * progress };
  }
  if (
    (left.type === "vec2" && right.type === "vec2")
    || (left.type === "vec3" && right.type === "vec3")
    || (left.type === "vec4" && right.type === "vec4")
    || (left.type === "color" && right.type === "color")
  ) {
    const values = left.value.map((value, index) => value + (right.value[index] - value) * progress);
    if (left.type === "vec2") return { type: "vec2", value: [values[0], values[1]] };
    if (left.type === "vec3") return { type: "vec3", value: [values[0], values[1], values[2]] };
    if (left.type === "vec4") return { type: "vec4", value: [values[0], values[1], values[2], values[3]] };
    return { type: "color", value: [values[0], values[1], values[2], values[3]] };
  }
  return progress < 1 ? left : right;
}

function applyEasing(
  easing: V2Track["keyframes"][number]["easing"],
  progress: number,
): number {
  const t = Math.max(0, Math.min(1, progress));
  if (!easing || easing.type === "linear") return t;
  if (easing.type === "step") return t < 1 ? 0 : 1;
  if (easing.type === "cubicBezier") {
    let low = 0;
    let high = 1;
    for (let index = 0; index < 18; index += 1) {
      const guess = (low + high) / 2;
      if (cubicBezierAxis(guess, easing.x1, easing.x2) < t) low = guess;
      else high = guess;
    }
    return cubicBezierAxis((low + high) / 2, easing.y1, easing.y2);
  }
  return springProgress(easing.mass, easing.stiffness, easing.damping, easing.velocity ?? 0, t);
}

function cubicBezierAxis(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

/** Deterministic normalized spring response for preview-only sampling. */
function springProgress(
  mass: number,
  stiffness: number,
  damping: number,
  velocity: number,
  t: number,
): number {
  const angular = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  if (dampingRatio < 1) {
    const dampedAngular = angular * Math.sqrt(1 - dampingRatio * dampingRatio);
    const envelope = Math.exp(-dampingRatio * angular * t);
    return 1 - envelope * (
      Math.cos(dampedAngular * t)
      + ((dampingRatio * angular - velocity) / dampedAngular) * Math.sin(dampedAngular * t)
    );
  }
  return 1 - Math.exp(-angular * t) * (1 + (angular - velocity) * t);
}

function toPropertyValue(value: V2AnimatableValue): unknown {
  if (value.type !== "color") return value.value;
  const channels = value.value.map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255));
  const hex = channels.slice(0, 3).map((channel) => channel.toString(16).padStart(2, "0")).join("");
  return channels[3] === 255 ? `#${hex}` : `#${hex}${channels[3].toString(16).padStart(2, "0")}`;
}

function applyTrackValue(layer: V2Layer, path: string, value: unknown): V2Layer {
  const segments = path.split(".");
  if (segments[0] === "effects") {
    const effectId = segments[1];
    if (!effectId || !("effects" in layer) || !layer.effects) return layer;
    const effects = layer.effects.map((effect) => effect.id === effectId
      ? assignPath(effect, segments.slice(2), value)
      : effect);
    return { ...layer, effects } as V2Layer;
  }
  if (
    layer.type === "text" &&
    segments[0] === "payload" &&
    segments[1] === "chunks" &&
    segments[2] === "spans" &&
    segments[3]
  ) {
    const spanId = segments[3];
    const chunks = layer.payload.chunks.map((chunk) => ({
      ...chunk,
      spans: chunk.spans.map((span) => span.id === spanId
        ? assignPath(span, segments.slice(4), value) as typeof span
        : span),
    }));
    return { ...layer, payload: { ...layer.payload, chunks } };
  }
  return assignPath(layer, segments, value) as V2Layer;
}

function assignPath(source: unknown, segments: readonly string[], value: unknown): unknown {
  const segment = segments[0];
  if (!segment) return value;
  if (Array.isArray(source)) {
    const index = Number(segment);
    if (!Number.isInteger(index) || index < 0 || index >= source.length) return source;
    const copy = source.slice();
    copy[index] = assignPath(copy[index], segments.slice(1), value);
    return copy;
  }
  if (source === null || typeof source !== "object") return source;
  const record = source as Record<string, unknown>;
  if (!(segment in record)) return source;
  return { ...record, [segment]: assignPath(record[segment], segments.slice(1), value) };
}
